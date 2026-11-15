import type { Pt } from '@/types/doc'

export interface TriMesh {
  // x,y 交错顶点
  verts: number[]
}

// 沿单条闭合轮廓向外描边生成三角带（半宽 width）
// miterLimit 超限时该角降级为斜切，实现尖角限幅
export const strokeOutline = (
  poly: Pt[],
  width: number,
  miterLimit: number,
): TriMesh => {
  const n = poly.length
  if (n < 3) return { verts: [] }
  const half = width / 2
  const verts: number[] = []

  // 外法线（多边形按顺时针为外轮廓时，右侧即外侧；方向由调用方保证）
  const normals: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % n]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1e-9
    normals.push({ x: dy / len, y: -dx / len })
  }

  for (let i = 0; i < n; i++) {
    const prev = normals[(i - 1 + n) % n]
    const next = normals[i]
    const p = poly[i]
    // 角平分线
    let nx = prev.x + next.x
    let ny = prev.y + next.y
    const nl = Math.hypot(nx, ny)
    if (nl < 1e-9) {
      nx = next.x
      ny = next.y
    } else {
      nx /= nl
      ny /= nl
    }
    // miter 长度 = 1 / sin(半夹角)
    const dot = Math.abs(prev.x * next.x + prev.y * next.y)
    const sinHalf = Math.sqrt(Math.max(0, (1 - dot) / 2))
    const miterLen = half / Math.max(sinHalf, 1e-6)
    const useBevel = miterLen / half > miterLimit

    // 内点（轮廓上）
    verts.push(p.x, p.y)
    if (useBevel) {
      // 斜切：用相邻两段各自的法线点，避免尖角刺穿
      const ox1 = p.x + prev.x * half
      const oy1 = p.y + prev.y * half
      verts.push(ox1, oy1)
      verts.push(p.x, p.y)
      const ox2 = p.x + next.x * half
      const oy2 = p.y + next.y * half
      verts.push(ox2, oy2)
    } else {
      verts.push(p.x + nx * miterLen, p.y + ny * miterLen)
    }
  }
  return { verts }
}

// 轮廓定向：保证外轮廓为顺时针（屏幕坐标 y 向下，顺时针面积为正）
export const signedArea = (poly: Pt[]): number => {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
}
