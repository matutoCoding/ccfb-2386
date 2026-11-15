// 审版台领域模型：单位统一毫米(mm)，颜色为 0-1 sRGB
export type ObjectType = 'rect' | 'ellipse' | 'path' | 'text'

// 多边形轮廓点，mm 坐标
export interface Pt {
  x: number
  y: number
}

// 子路径：闭合多边形；hole=true 为内轮廓（字孔/镂空）
export interface SubPath {
  points: Pt[]
  hole: boolean
}

export interface ArtObject {
  id: string
  type: ObjectType
  name: string
  plateId: string
  // 变换：中心位置 + 旋转角(度)
  x: number
  y: number
  rotation: number
  // rect / ellipse
  width: number
  height: number
  // 通用不透明度，参与覆盖率
  opacity: number
  overprint: boolean
  locked: boolean
  hidden: boolean
  // text 专用
  text: string
  fontFamily: string
  fontStyle: 'regular' | 'bold'
  fontSize: number
  // path 专用，mm 本地坐标（以对象中心为原点）
  subPaths: SubPath[]
}

export interface Plate {
  id: string
  name: string
  color: string // #rrggbb
  // 墨序：小的先印
  inkOrder: number
  opacity: number // 墨层遮盖率 0-1
  angle: number // 网点角度，度
  // 套准偏移 mm
  offsetX: number
  offsetY: number
  locked: boolean
  hidden: boolean
}

export interface TrapSettings {
  enabled: boolean
  width: number // mm
  miterLimit: number // 尖角限幅倍数
}

export interface JobDoc {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  seed: number
  width: number
  height: number
  paperColor: string
  paperOpacity: number // 纸色不透明度（衬底强度）
  halftone: boolean // 网点预览开关
  leakLocate: boolean // 漏白定位开关
  trap: TrapSettings
  plates: Plate[]
  objects: ArtObject[]
}

export interface JobSummary {
  id: string
  name: string
  updatedAt: number
  plateCount: number
  objectCount: number
  thumbnail?: string
}

export const DEFAULT_TRAP: TrapSettings = {
  enabled: true,
  width: 0.15,
  miterLimit: 3,
}
