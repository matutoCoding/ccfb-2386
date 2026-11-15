import { DEFAULT_TRAP, type ArtObject, type JobDoc, type Plate } from '@/types/doc'
import { createRng, uid } from '@/utils/common'
import { ellipseToPaths, rectToPaths } from '@/engine/geometry'
import { fontReady, layoutText } from '@/engine/font_service'

const PALE_GOLD = '#b8860b'
const DEEP_RED = '#9f1d22'

const basePlates = (): Plate[] => [
  {
    id: uid('plate'),
    name: '深红版',
    color: DEEP_RED,
    inkOrder: 1,
    opacity: 0.92,
    angle: 75,
    offsetX: 0,
    offsetY: 0,
    locked: false,
    hidden: false,
  },
  {
    id: uid('plate'),
    name: '烫金版',
    color: PALE_GOLD,
    inkOrder: 2,
    opacity: 0.85,
    angle: 15,
    offsetX: 0,
    offsetY: 0,
    locked: false,
    hidden: false,
  },
]

const makeRect = (
  plateId: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Partial<ArtObject> = {},
): ArtObject => ({
  id: uid('obj'),
  type: 'rect',
  name,
  plateId,
  x,
  y,
  rotation: 0,
  width: w,
  height: h,
  opacity: 1,
  overprint: false,
  locked: false,
  hidden: false,
  text: '',
  fontFamily: 'SimHei',
  fontStyle: 'regular',
  fontSize: 48,
  subPaths: rectToPaths(w, h),
  ...extra,
})

const makeEllipse = (
  plateId: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Partial<ArtObject> = {},
): ArtObject => ({
  ...makeRect(plateId, name, x, y, w, h, extra),
  type: 'ellipse',
  subPaths: ellipseToPaths(w, h),
})

const makeText = (
  plateId: string,
  name: string,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  family: string,
  extra: Partial<ArtObject> = {},
): ArtObject => {
  const obj: ArtObject = {
    id: uid('obj'),
    type: 'text',
    name,
    plateId,
    x,
    y,
    rotation: 0,
    width: 0,
    height: 0,
    opacity: 1,
    overprint: false,
    locked: false,
    hidden: false,
    text,
    fontFamily: family,
    fontStyle: 'regular',
    fontSize,
    subPaths: [],
    ...extra,
  }
  if (fontReady(family, obj.fontStyle)) {
    const laid = layoutText(text, family, obj.fontStyle, fontSize)
    if (laid) {
      obj.subPaths = laid.subPaths
      obj.width = laid.width
      obj.height = laid.height
    }
  }
  return obj
}

// 固定种子生成双色礼盒：同一 seed 结果完全一致
export const buildGiftBoxJob = (
  seed: number,
  id = uid('job'),
  name = '双色礼盒·内置工程',
): JobDoc => {
  const rng = createRng(seed)
  const plates = basePlates()
  const red = plates[0].id
  const gold = plates[1].id
  const W = 210
  const H = 285

  const objects: ArtObject[] = []
  // 红版：盒面底色 + 装饰圆
  objects.push(makeRect(red, '盒面底色', W / 2, H / 2, 180, 240))
  objects.push(
    makeRect(gold, '内框金线', W / 2, H / 2, 150, 200, {
      opacity: 0.9,
      overprint: true, // 金线叠印在红底上
    }),
  )
  // 随机但确定的圆点装饰
  for (let i = 0; i < 6; i++) {
    const px = 40 + Math.round(rng() * 130)
    const py = 30 + Math.round(rng() * 220)
    const r = 4 + Math.round(rng() * 6)
    objects.push(
      makeEllipse(gold, `金箔圆点 ${i + 1}`, px, py, r, r, {
        overprint: true,
      }),
    )
  }
  // 主标题（中文曲线）与副标（英文曲线）
  objects.push(
    makeText(gold, '主标题', '佳节好礼', W / 2, 110, 64, 'SimHei', {
      overprint: true,
    }),
  )
  objects.push(
    makeText(gold, '英文副标', 'GIFT BOX', W / 2, 150, 30, 'Arial', {
      overprint: true,
    }),
  )
  // 红版飘带（挖空关系的典型件）
  objects.push(
    makeRect(red, '横向飘带', W / 2, 200, 180, 26, {
      rotation: -6,
    }),
  )
  objects.push(
    makeText(red, '飘带文字', 'SPECIAL', W / 2, 200, 26, 'Arial', {
      rotation: -6,
      overprint: false,
    }),
  )
  // 底部厂牌
  objects.push(
    makeText(gold, '厂牌小字', 'PACKAGING CO.', W / 2, 262, 16, 'Arial', {
      overprint: true,
    }),
  )

  return {
    id,
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    seed,
    width: W,
    height: H,
    paperColor: '#f4ecd8',
    paperOpacity: 1,
    halftone: false,
    leakLocate: false,
    trap: { ...DEFAULT_TRAP },
    plates,
    objects,
  }
}

export const createBlankJob = (name: string): JobDoc => ({
  id: uid('job'),
  name,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  seed: 2386,
  width: 210,
  height: 285,
  paperColor: '#ffffff',
  paperOpacity: 1,
  halftone: false,
  leakLocate: false,
  trap: { ...DEFAULT_TRAP },
  plates: [],
  objects: [],
})
