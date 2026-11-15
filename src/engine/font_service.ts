import opentype from 'opentype.js'
import type { Font } from 'opentype.js'
import type { Pt, SubPath } from '@/types/doc'
import { flattenCubic } from '@/engine/geometry'
import { signedArea } from '@/engine/stroke'

// 每逻辑像素对应的毫米数（96dpi）
const PX_TO_MM = 25.4 / 96

interface FontEntry {
  font: Font
  family: string
  style: 'regular' | 'bold'
}

const FONT_FILES: Record<string, Record<string, string>> = {
  Arial: {
    regular: '/fonts/arial.ttf',
    bold: '/fonts/arialbd.ttf',
  },
  SimHei: {
    regular: '/fonts/simhei.ttf',
    bold: '/fonts/simhei.ttf',
  },
}

const cache = new Map<string, FontEntry>()

const keyOf = (family: string, style: 'regular' | 'bold') =>
  `${family}:${style}`

// 预载全部字体，失败不致命，文字对象将走 canvas 降级
export const loadFonts = async (): Promise<void> => {
  const jobs: Promise<void>[] = []
  for (const [family, styles] of Object.entries(FONT_FILES)) {
    for (const style of ['regular', 'bold'] as const) {
      jobs.push(
        fetch(styles[style])
          .then((r) => {
            if (!r.ok) throw new Error(`font ${r.status}`)
            return r.arrayBuffer()
          })
          .then((buf) => {
            cache.set(keyOf(family, style), {
              font: opentype.parse(buf),
              family,
              style,
            })
          })
          .catch(() => undefined),
      )
    }
  }
  await Promise.all(jobs)
}

export const fontReady = (
  family: string,
  style: 'regular' | 'bold',
): boolean => cache.has(keyOf(family, style))

export const FONT_FAMILIES = Object.keys(FONT_FILES)

interface TextLayout {
  subPaths: SubPath[]
  width: number
  height: number
}

// 文字 -> 本地坐标系（中心原点）mm 多边形
export const layoutText = (
  text: string,
  family: string,
  style: 'regular' | 'bold',
  fontSizePx: number,
): TextLayout | null => {
  const entry = cache.get(keyOf(family, style))
  if (!entry || !text.trim()) return null
  const scale = (1 / entry.font.unitsPerEm) * fontSizePx * PX_TO_MM
  const path = entry.font.getPath(text, 0, 0, fontSizePx)
  const subPaths: SubPath[] = []
  let cursor: Pt | null = null
  let current: Pt[] = []

  const pushCurrent = () => {
    if (current.length < 3) {
      current = []
      return
    }
    // opentype y 轴向上，翻转为屏幕坐标
    const points = current.map((p) => ({ x: p.x, y: -p.y }))
    const area = signedArea(points)
    subPaths.push({
      points,
      // 翻转后顺时针(面积正)为外轮廓，逆时针为字孔
      hole: area < 0,
    })
    current = []
  }

  for (const cmd of path.commands) {
    if (cmd.type === 'M') {
      pushCurrent()
      cursor = { x: cmd.x * scale, y: cmd.y * scale }
      current = [{ ...cursor }]
    } else if (cmd.type === 'L' && cursor) {
      current.push({ x: cmd.x * scale, y: cmd.y * scale })
    } else if (cmd.type === 'Q' && cursor) {
      // 二次转三次近似（字体里罕见）
      const end = { x: cmd.x * scale, y: cmd.y * scale }
      const c1 = {
        x: cursor.x + (2 / 3) * (cmd.x1 * scale - cursor.x),
        y: cursor.y + (2 / 3) * (cmd.y1 * scale - cursor.y),
      }
      current.push(...flattenCubic(cursor, c1, c1, end))
      cursor = end
    } else if (cmd.type === 'C' && cursor) {
      const end = { x: cmd.x * scale, y: cmd.y * scale }
      current.push(
        ...flattenCubic(
          cursor,
          { x: cmd.x1 * scale, y: cmd.y1 * scale },
          { x: cmd.x2 * scale, y: cmd.y2 * scale },
          end,
        ),
      )
      cursor = end
    } else if (cmd.type === 'Z') {
      pushCurrent()
      cursor = null
    }
  }
  pushCurrent()
  if (!subPaths.length) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const sp of subPaths) {
    for (const p of sp.points) {
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    }
  }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  for (const sp of subPaths) {
    for (const p of sp.points) {
      p.x -= cx
      p.y -= cy
    }
  }
  return {
    subPaths,
    width: maxX - minX,
    height: maxY - minY,
  }
}
