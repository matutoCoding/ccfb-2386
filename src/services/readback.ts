import type { ProofEngine } from '@/engine/proof_engine'

export interface ReadbackReport {
  width: number
  height: number
  totalPixels: number
  maxDelta: number
  meanDelta: number
  mismatchPixels: number // 单通道差 > 容差的像素数
  mismatchRate: number
  passed: boolean
  heatmap: string // dataURL，差异热图
}

const TOLERANCE = 8 // 0-255 单通道容差

const loadImage = (dataUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataUrl
  })

// 自动回读：引擎出 PNG，再解码回 canvas 做逐像素 diff
export const verifyExport = async (
  engine: ProofEngine,
  exportedPng: string,
): Promise<ReadbackReport> => {
  const { w, h } = engine.textureSize
  const img = await loadImage(exportedPng)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  const decoded = ctx.getImageData(0, 0, w, h).data

  // 实时渲染侧再出一次图作为基准（同源光栅）
  const livePng = engine.exportPng()
  const liveImg = await loadImage(livePng)
  const liveCanvas = document.createElement('canvas')
  liveCanvas.width = w
  liveCanvas.height = h
  const liveCtx = liveCanvas.getContext('2d')!
  liveCtx.drawImage(liveImg, 0, 0, w, h)
  const live = liveCtx.getImageData(0, 0, w, h).data

  const heat = document.createElement('canvas')
  heat.width = w
  heat.height = h
  const heatCtx = heat.getContext('2d')!
  const heatData = heatCtx.createImageData(w, h)

  let sum = 0
  let max = 0
  let bad = 0
  const count = w * h
  for (let i = 0; i < count; i++) {
    const k = i * 4
    const dr = Math.abs(decoded[k] - live[k])
    const dg = Math.abs(decoded[k + 1] - live[k + 1])
    const db = Math.abs(decoded[k + 2] - live[k + 2])
    const localMax = Math.max(dr, dg, db)
    sum += dr + dg + db
    max = Math.max(max, localMax)
    if (localMax > TOLERANCE) bad++
    // 热图：无差异浅灰，差异越大越红
    heatData.data[k] = 220
    heatData.data[k + 1] = 220 - Math.min(220, localMax * 4)
    heatData.data[k + 2] = 220 - Math.min(220, localMax * 4)
    heatData.data[k + 3] = 255
  }
  heatCtx.putImageData(heatData, 0, 0)

  return {
    width: w,
    height: h,
    totalPixels: count,
    maxDelta: max,
    meanDelta: sum / (count * 3),
    mismatchPixels: bad,
    mismatchRate: bad / count,
    passed: bad / count < 0.001,
    heatmap: heat.toDataURL('image/png'),
  }
}
