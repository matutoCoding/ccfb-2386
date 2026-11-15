import type { JobDoc } from '@/types/doc'
import { hexToRgb } from '@/utils/common'
import { objectWorldPaths } from '@/engine/geometry'
import { signedArea, strokeOutline } from '@/engine/stroke'
import { RASTER_FS, RASTER_VS, SCREEN_FS, SCREEN_VS } from '@/engine/shaders'

const MAX_PLATES = 12
const PX_PER_MM = 5 // 离屏纹理分辨率，兼顾精度与显存

interface PlateTarget {
  fbo: WebGLFramebuffer
  tex: WebGLTexture
  stencil: WebGLRenderbuffer
}

export interface ViewState {
  scale: number
  panX: number
  panY: number
  soloPlate: number // -1 合成
}

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const sh = gl.createShader(type)
  if (!sh) throw new Error('shader alloc failed')
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) || 'shader compile error')
  }
  return sh
}

const makeProgram = (gl: WebGL2RenderingContext, vs: string, fs: string) => {
  const p = gl.createProgram()
  if (!p) throw new Error('program alloc failed')
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs))
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) || 'program link error')
  }
  return p
}

export class ProofEngine {
  private gl: WebGL2RenderingContext
  private rasterProg: WebGLProgram
  private screenProg: WebGLProgram
  private vbo: WebGLBuffer
  private texW = 0
  private texH = 0
  private targets: PlateTarget[] = []
  private doc: JobDoc | null = null
  private dirty = true

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      preserveDrawingBuffer: true,
    })
    if (!gl) throw new Error('当前浏览器不支持 WebGL2')
    this.gl = gl
    this.rasterProg = makeProgram(gl, RASTER_VS, RASTER_FS)
    this.screenProg = makeProgram(gl, SCREEN_VS, SCREEN_FS)
    this.vbo = gl.createBuffer()!
  }

  markDirty(): void {
    this.dirty = true
  }

  private makeTarget(): PlateTarget {
    const gl = this.gl
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA8, this.texW, this.texH, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, null,
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    const stencil = gl.createRenderbuffer()!
    gl.bindRenderbuffer(gl.RENDERBUFFER, stencil)
    gl.renderbufferStorage(
      gl.RENDERBUFFER, gl.STENCIL_INDEX8, this.texW, this.texH,
    )
    const fbo = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0,
    )
    gl.framebufferRenderbuffer(
      gl.FRAMEBUFFER, gl.STENCIL_ATTACHMENT, gl.RENDERBUFFER, stencil,
    )
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return { fbo, tex, stencil }
  }

  private disposeTargets(): void {
    const gl = this.gl
    for (const t of this.targets) {
      gl.deleteFramebuffer(t.fbo)
      gl.deleteTexture(t.tex)
      gl.deleteRenderbuffer(t.stencil)
    }
    this.targets = []
  }

  private ensureCapacity(doc: JobDoc): void {
    const texW = Math.max(2, Math.round(doc.width * PX_PER_MM))
    const texH = Math.max(2, Math.round(doc.height * PX_PER_MM))
    const need = Math.min(doc.plates.length, MAX_PLATES)
    if (
      texW === this.texW &&
      texH === this.texH &&
      this.targets.length === need
    ) {
      return
    }
    this.disposeTargets()
    this.texW = texW
    this.texH = texH
    for (let i = 0; i < need; i++) this.targets.push(this.makeTarget())
  }

  setDoc(doc: JobDoc): void {
    this.doc = doc
    this.ensureCapacity(doc)
    this.dirty = true
  }

  get textureSize(): { w: number; h: number } {
    return { w: this.texW, h: this.texH }
  }

  private upload(verts: number[]): void {
    const gl = this.gl
    // 屏幕程序的 a_uv 属性若保持启用，会以旧步长越界读取，这里显式关闭
    const uvLoc = gl.getAttribLocation(this.screenProg, 'a_uv')
    if (uvLoc >= 0) gl.disableVertexAttribArray(uvLoc)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW)
    const loc = gl.getAttribLocation(this.rasterProg, 'a_pos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  }

  private fullScreenQuad(doc: JobDoc): void {
    this.upload([
      0, 0, doc.width, 0, doc.width, doc.height,
      0, 0, doc.width, doc.height, 0, doc.height,
    ])
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6)
  }

  // stencil even-odd 填充，颜色由 u_rgba 决定写入通道
  private fillEvenOdd(
    gl: WebGL2RenderingContext,
    doc: JobDoc,
    paths: { x: number; y: number }[][],
  ): void {
    gl.clear(gl.STENCIL_BUFFER_BIT)
    gl.enable(gl.STENCIL_TEST)
    gl.stencilFunc(gl.ALWAYS, 0, 0xff)
    gl.stencilOp(gl.INVERT, gl.INVERT, gl.INVERT)
    gl.colorMask(false, false, false, false)
    for (const points of paths) {
      const verts: number[] = []
      for (const p of points) verts.push(p.x, p.y)
      this.upload(verts)
      gl.drawArrays(gl.TRIANGLE_FAN, 0, points.length)
    }
    gl.colorMask(true, true, true, true)
    gl.stencilFunc(gl.NOTEQUAL, 0, 0xff)
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP)
    this.fullScreenQuad(doc)
    gl.disable(gl.STENCIL_TEST)
  }

  // 光栅化全部色版：R=覆盖率 G=字孔 B=陷印
  private rasterize(): void {
    const gl = this.gl
    const doc = this.doc!
    gl.useProgram(this.rasterProg)
    gl.uniform2f(
      gl.getUniformLocation(this.rasterProg, 'u_pxPerMm'),
      PX_PER_MM, PX_PER_MM,
    )
    gl.uniform2f(
      gl.getUniformLocation(this.rasterProg, 'u_halfSize'),
      this.texW / 2, this.texH / 2,
    )
    const uRgba = gl.getUniformLocation(this.rasterProg, 'u_rgba')
    const visible = doc.objects.filter((o) => !o.hidden)

    doc.plates.forEach((plate, idx) => {
      const target = this.targets[idx]
      if (!target) return
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo)
      gl.viewport(0, 0, this.texW, this.texH)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT)
      const objs = visible.filter(
        (o) => o.plateId === plate.id && !plate.hidden,
      )

      gl.enable(gl.BLEND)
      // 颜色与 alpha 均为预乘值，用预乘混合保证覆盖率叠加正确
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      for (const obj of objs) {
        const a = obj.opacity
        const worldPaths = objectWorldPaths(obj)
        // R 通道：整体覆盖率
        gl.uniform4f(uRgba, a, 0, 0, a)
        this.fillEvenOdd(
          gl, doc, worldPaths.map((sp) => sp.points),
        )
        // G 通道：挖空掩膜，仅非叠印对象写入（叠印对象不挖空下层）
        if (!obj.overprint) {
          gl.uniform4f(uRgba, 0, a, 0, a)
          this.fillEvenOdd(gl, doc, worldPaths.map((sp) => sp.points))
        }
        // A 通道：字孔掩膜（保护字孔不被挖空、不被陷印堵塞）
        const holes = worldPaths.filter((sp) => sp.hole)
        if (holes.length) {
          gl.uniform4f(uRgba, 0, 0, 0, a)
          this.fillEvenOdd(gl, doc, holes.map((sp) => sp.points))
        }
      }

      // B 通道：陷印外扩带，仅描外轮廓 -> 不堵字孔
      if (doc.trap.enabled && doc.trap.width > 0 && !plate.locked) {
        gl.colorMask(false, false, true, false)
        gl.blendFunc(gl.ONE, gl.ONE)
        for (const obj of objs) {
          for (const sp of objectWorldPaths(obj)) {
            if (sp.hole) continue
            const poly =
              signedArea(sp.points) < 0
                ? [...sp.points].reverse()
                : sp.points
            const mesh = strokeOutline(
              poly, doc.trap.width, doc.trap.miterLimit,
            )
            if (!mesh.verts.length) continue
            this.upload(mesh.verts)
            gl.uniform4f(uRgba, 0, 0, obj.opacity, 1)
            gl.drawArrays(gl.TRIANGLES, 0, mesh.verts.length / 2)
          }
        }
        gl.colorMask(true, true, true, true)
      }
      gl.disable(gl.BLEND)
    })
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  private bindScreenUniforms(view: ViewState): void {
    const gl = this.gl
    const doc = this.doc!
    const plates = [...doc.plates]
      .sort((a, b) => a.inkOrder - b.inkOrder)
      .slice(0, MAX_PLATES)
    gl.useProgram(this.screenProg)
    const get = (name: string) => gl.getUniformLocation(this.screenProg, name)

    plates.forEach((p, i) => {
      gl.activeTexture(gl.TEXTURE0 + i)
      const idx = doc.plates.indexOf(p)
      gl.bindTexture(gl.TEXTURE_2D, this.targets[idx].tex)
    })
    gl.uniform1iv(get('u_plates'), plates.map((_, i) => i))
    gl.uniform1i(get('u_count'), plates.length)

    const inks = plates.flatMap((p) => hexToRgb(p.color))
    gl.uniform3fv(get('u_ink'), new Float32Array(inks))
    gl.uniform1fv(
      get('u_opacity'),
      new Float32Array(plates.map((p) => p.opacity)),
    )
    gl.uniform1fv(
      get('u_angle'),
      new Float32Array(plates.map((p) => p.angle)),
    )
    gl.uniform2fv(
      get('u_offset'),
      new Float32Array(
        plates.flatMap((p) => [
          p.offsetX * PX_PER_MM,
          p.offsetY * PX_PER_MM,
        ]),
      ),
    )
    gl.uniform2f(get('u_texSize'), this.texW, this.texH)
    const paper = hexToRgb(doc.paperColor)
    gl.uniform3f(get('u_paper'), paper[0], paper[1], paper[2])
    gl.uniform1f(get('u_paperOpacity'), doc.paperOpacity)
    // 入参 soloPlate 为墨序排序后的位置，转成色版纹理真实索引
    const realSolo =
      view.soloPlate >= 0 ? doc.plates.indexOf(plates[view.soloPlate]) : -1
    gl.uniform1i(get('u_solo'), realSolo)
    gl.uniform1i(get('u_halftone'), doc.halftone ? 1 : 0)
    gl.uniform1i(get('u_leakLocate'), doc.leakLocate ? 1 : 0)
    gl.uniform2f(
      get('u_leakPx'),
      Math.max(1, doc.trap.width * PX_PER_MM),
      Math.max(1, doc.trap.width * PX_PER_MM),
    )
  }

  // 交错顶点 [x,y,u,v]，分别挂两个属性
  private uploadScreen(quad: number[]): void {
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quad), gl.DYNAMIC_DRAW)
    const stride = 4 * 4
    const pLoc = gl.getAttribLocation(this.screenProg, 'a_pos')
    const uvLoc = gl.getAttribLocation(this.screenProg, 'a_uv')
    gl.enableVertexAttribArray(pLoc)
    gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, stride, 0)
    gl.enableVertexAttribArray(uvLoc)
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, stride, 2 * 4)
  }

  // 像素空间正射矩阵（y 向下）
  private pixelOrtho(w: number, h: number): Float32Array {
    return new Float32Array([
      2 / w, 0, 0, 0,
      0, -2 / h, 0, 0,
      0, 0, 1, 0,
      -1, 1, 0, 1,
    ])
  }

  private clipOrtho(): Float32Array {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
  }

  // 主画布渲染（带相机缩放平移）
  render(view: ViewState): void {
    const gl = this.gl
    if (!this.doc) return
    if (this.dirty) {
      this.rasterize()
      this.dirty = false
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const cssW = this.canvas.clientWidth
    const cssH = this.canvas.clientHeight
    if (this.canvas.width !== cssW * dpr || this.canvas.height !== cssH * dpr) {
      this.canvas.width = cssW * dpr
      this.canvas.height = cssH * dpr
    }
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(0.11, 0.13, 0.17, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(this.screenProg)
    this.bindScreenUniforms(view)

    const fit = Math.min(
      (cssW * dpr * 0.86) / this.texW,
      (cssH * dpr * 0.86) / this.texH,
    )
    const baseScale = fit * view.scale
    const screenW = this.texW * baseScale
    const screenH = this.texH * baseScale
    const ox = this.canvas.width / 2 + view.panX * dpr - screenW / 2
    const oy = this.canvas.height / 2 + view.panY * dpr - screenH / 2

    gl.uniformMatrix4fv(
      gl.getUniformLocation(this.screenProg, 'u_ortho'),
      false, this.pixelOrtho(this.canvas.width, this.canvas.height),
    )
    this.uploadScreen([
      ox, oy, 0, 0,
      ox + screenW, oy, 1, 0,
      ox + screenW, oy + screenH, 1, 1,
      ox, oy, 0, 0,
      ox + screenW, oy + screenH, 1, 1,
      ox, oy + screenH, 0, 1,
    ])
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  // 离屏按纹理原始分辨率出图，返回 PNG dataURL（导出版与预览同版同源）
  exportPng(): string {
    const gl = this.gl
    if (!this.doc) throw new Error('无文档')
    if (this.dirty) {
      this.rasterize()
      this.dirty = false
    }
    const fbo = gl.createFramebuffer()!
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA8, this.texW, this.texH, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, null,
    )
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0,
    )
    gl.viewport(0, 0, this.texW, this.texH)
    gl.clearColor(1, 1, 1, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    this.bindScreenUniforms({ scale: 1, panX: 0, panY: 0, soloPlate: -1 })
    gl.uniformMatrix4fv(
      gl.getUniformLocation(this.screenProg, 'u_ortho'),
      false, this.clipOrtho(),
    )
    this.uploadScreen([
      -1, -1, 0, 0,
      1, -1, 1, 0,
      1, 1, 1, 1,
      -1, -1, 0, 0,
      1, 1, 1, 1,
      -1, 1, 0, 1,
    ])
    gl.drawArrays(gl.TRIANGLES, 0, 6)

    const pixels = new Uint8Array(this.texW * this.texH * 4)
    gl.readPixels(0, 0, this.texW, this.texH, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.deleteFramebuffer(fbo)
    gl.deleteTexture(tex)

    // readPixels 原点在左下，翻转到画布坐标
    const c2 = document.createElement('canvas')
    c2.width = this.texW
    c2.height = this.texH
    const ctx = c2.getContext('2d')!
    const image = ctx.createImageData(this.texW, this.texH)
    for (let y = 0; y < this.texH; y++) {
      const src = (this.texH - 1 - y) * this.texW * 4
      image.data.set(
        pixels.subarray(src, src + this.texW * 4),
        y * this.texW * 4,
      )
    }
    ctx.putImageData(image, 0, 0)
    return c2.toDataURL('image/png')
  }

  // 回读指定色版的覆盖率字节（分版对照/导出校验用）
  readPlateCoverage(plateIndex: number): Uint8Array {
    if (this.dirty) {
      this.rasterize()
      this.dirty = false
    }
    const gl = this.gl
    const t = this.targets[plateIndex]
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo)
    const px = new Uint8Array(this.texW * this.texH * 4)
    gl.readPixels(0, 0, this.texW, this.texH, gl.RGBA, gl.UNSIGNED_BYTE, px)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return px
  }

  get plateCount(): number {
    return this.doc ? this.doc.plates.length : 0
  }
}
