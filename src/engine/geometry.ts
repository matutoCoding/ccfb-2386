import type { ArtObject, Pt, SubPath } from '@/types/doc'
import { deg2rad } from '@/utils/common'

// 矩形 -> 单轮廓多边形（本地坐标，中心原点）
export const rectToPaths = (w: number, h: number): SubPath[] => [
  {
    hole: false,
    points: [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 },
    ],
  },
]

// 椭圆多边形化，64 段足够平滑
export const ellipseToPaths = (w: number, h: number): SubPath[] => {
  const points: Pt[] = []
  const seg = 64
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2
    points.push({ x: (Math.cos(a) * w) / 2, y: (Math.sin(a) * h) / 2 })
  }
  return [{ hole: false, points }]
}

// 本地坐标 -> 世界坐标（先旋转后平移）
export const localToWorld = (p: Pt, obj: ArtObject): Pt => {
  const r = deg2rad(obj.rotation)
  const c = Math.cos(r)
  const s = Math.sin(r)
  return {
    x: p.x * c - p.y * s + obj.x,
    y: p.x * s + p.y * c + obj.y,
  }
}

// 世界 -> 本地
export const worldToLocal = (p: Pt, obj: ArtObject): Pt => {
  const dx = p.x - obj.x
  const dy = p.y - obj.y
  const r = -deg2rad(obj.rotation)
  const c = Math.cos(r)
  const s = Math.sin(r)
  return { x: dx * c - dy * s, y: dx * s + dy * c }
}

// 对象全部轮廓的世界坐标形式
export const objectWorldPaths = (obj: ArtObject): SubPath[] =>
  obj.subPaths.map((sp) => ({
    hole: sp.hole,
    points: sp.points.map((p) => localToWorld(p, obj)),
  }))

// 射线法点在多边形内
const pointInPolygon = (p: Pt, poly: Pt[]): boolean => {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x
    const yi = poly[i].y
    const xj = poly[j].x
    const yj = poly[j].y
    const cross =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi || 1e-12) + xi
    if (cross) inside = !inside
  }
  return inside
}

// even-odd 规则：外轮廓减内轮廓
export const pointInObject = (p: Pt, obj: ArtObject): boolean => {
  const local = worldToLocal(p, obj)
  let crossings = 0
  for (const sp of obj.subPaths) {
    if (pointInPolygon(local, sp.points)) crossings++
  }
  return crossings % 2 === 1
}

// 对象包围盒（世界 AABB）
export const objectBounds = (obj: ArtObject): { min: Pt; max: Pt } => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const sp of obj.subPaths) {
    for (const p0 of sp.points) {
      const p = localToWorld(p0, obj)
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    }
  }
  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } }
}

// 三次贝塞尔按容差扁平化为折线
export const flattenCubic = (
  p0: Pt,
  p1: Pt,
  p2: Pt,
  p3: Pt,
  tolerance = 0.05,
): Pt[] => {
  const out: Pt[] = []
  const walk = (a: Pt, b: Pt, c: Pt, d: Pt, depth: number) => {
    if (depth > 16) return
    // 控制点到弦的距离估计
    const dx = d.x - a.x
    const dy = d.y - a.y
    const len2 = dx * dx + dy * dy || 1e-12
    const d1 = Math.abs((b.x - a.x) * dy - (b.y - a.y) * dx) / Math.sqrt(len2)
    const d2 = Math.abs((c.x - a.x) * dy - (c.y - a.y) * dx) / Math.sqrt(len2)
    if (d1 + d2 <= 3 * tolerance) {
      out.push(d)
      return
    }
    const ab = mid(a, b)
    const bc = mid(b, c)
    const cd = mid(c, d)
    const abc = mid(ab, bc)
    const bcd = mid(bc, cd)
    const abcd = mid(abc, bcd)
    walk(a, ab, abc, abcd, depth + 1)
    walk(abcd, bcd, cd, d, depth + 1)
  }
  walk(p0, p1, p2, p3, 0)
  return out
}

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
