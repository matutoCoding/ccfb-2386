import type { JobDoc, SubPath } from '@/types/doc'
import { objectWorldPaths } from '@/engine/geometry'
import { signedArea, strokeOutline } from '@/engine/stroke'

const pathD = (sp: SubPath): string => {
  const d = sp.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ')
  return `${d} Z`
}

const escapeXml = (s: string): string =>
  s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  )

// 单色版 SVG：黑膜版片，含陷印外扩路径，overprint 对象加数据标记
export const buildPlateSvg = (doc: JobDoc, plateId: string): string => {
  const plate = doc.plates.find((p) => p.id === plateId)
  if (!plate) throw new Error('色版不存在')
  const objs = doc.objects.filter(
    (o) => o.plateId === plateId && !o.hidden && !plate.hidden,
  )
  const body: string[] = []
  const trapBody: string[] = []

  for (const obj of objs) {
    const paths = objectWorldPaths(obj)
    const fillRule = paths.some((p) => p.hole) ? 'evenodd' : 'nonzero'
    const d = paths.map(pathD).join(' ')
    body.push(
      `  <path d="${d}" fill="#000" fill-rule="${fillRule}" fill-opacity="${obj.opacity}"` +
        ` data-overprint="${obj.overprint}" data-name="${escapeXml(obj.name)}"/>`,
    )
    if (doc.trap.enabled && doc.trap.width > 0 && !plate.locked) {
      for (const sp of paths) {
        if (sp.hole) continue
        const poly =
          signedArea(sp.points) < 0 ? [...sp.points].reverse() : sp.points
        const mesh = strokeOutline(poly, doc.trap.width, doc.trap.miterLimit)
        if (!mesh.verts.length) continue
        // 三角带转填充多边形（描边外轮廓近似）
        const pts: string[] = []
        for (let i = 0; i < mesh.verts.length; i += 2) {
          pts.push(`${mesh.verts[i].toFixed(2)},${mesh.verts[i + 1].toFixed(2)}`)
        }
        trapBody.push(
          `  <polygon points="${pts.join(' ')}" fill="#000" fill-opacity="${obj.opacity * 0.6}" data-trap="1"/>`,
        )
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}mm" height="${doc.height}mm"
  viewBox="0 0 ${doc.width} ${doc.height}" data-plate="${escapeXml(plate.name)}"
  data-ink-order="${plate.inkOrder}" data-screen-angle="${plate.angle}">
  <rect width="${doc.width}" height="${doc.height}" fill="#fff"/>
  <g id="trap" data-width-mm="${doc.trap.width}" data-miter-limit="${doc.trap.miterLimit}">
${trapBody.join('\n')}
  </g>
  <g id="artwork" data-offset-x-mm="${plate.offsetX}" data-offset-y-mm="${plate.offsetY}">
${body.join('\n')}
  </g>
</svg>`
}

export const downloadText = (filename: string, content: string, mime: string): void => {
  const blob = new Blob([content], { type: mime })
  triggerDownload(URL.createObjectURL(blob), filename)
}

export const downloadDataUrl = (filename: string, dataUrl: string): void => {
  triggerDownload(dataUrl, filename)
}

const triggerDownload = (href: string, filename: string): void => {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
  if (href.startsWith('blob:')) URL.revokeObjectURL(href)
}

// 全部分版打包为单一 SVG（每层一 <g>，墨序即层序）
export const buildAllPlatesSvg = (doc: JobDoc): string => {
  const sorted = [...doc.plates].sort((a, b) => a.inkOrder - b.inkOrder)
  const groups = sorted.map((plate) => {
    const inner = buildPlateSvg(doc, plate.id)
    const fragment = inner
      .slice(inner.indexOf('<svg'))
      .replace(/^<svg[^>]*>/, '')
      .replace('</svg>', '')
    return `<g id="plate-${escapeXml(plate.name)}" data-color="${plate.color}" data-ink-order="${plate.inkOrder}">\n${fragment}\n  </g>`
  })
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}mm" height="${doc.height}mm"
  viewBox="0 0 ${doc.width} ${doc.height}">
  <rect width="${doc.width}" height="${doc.height}" fill="${doc.paperColor}"/>
${groups.join('\n')}
</svg>`
}
