// 通用小工具
export const uid = (prefix = 'id'): string =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v))

export const deg2rad = (deg: number): number => (deg * Math.PI) / 180

// 固定种子伪随机（mulberry32），重建按钮要求结果可复现
export const createRng = (seed: number): (() => number) => {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// #rrggbb -> [r,g,b] 0-1
export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

// 深拷贝（文档均为可结构化数据）
export const cloneDoc = <T>(v: T): T => structuredClone(v)
