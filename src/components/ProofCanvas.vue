<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { ProofEngine, type ViewState } from '@/engine/proof_engine'
import { pointInObject } from '@/engine/geometry'
import { useDocStore } from '@/stores/doc_store'
import type { Pt } from '@/types/doc'

const props = defineProps<{
  soloPlate?: number
  showOverlay?: boolean
}>()

const docStore = useDocStore()
const wrap = ref<HTMLDivElement>()
const canvas = ref<HTMLCanvasElement>()
const overlay = ref<HTMLCanvasElement>()
const engine = ref<ProofEngine>()
const view = ref<ViewState>({ scale: 1, panX: 0, panY: 0, soloPlate: -1 })
const error = ref('')

let raf = 0
let dragging = false
let panning = false
let lastX = 0
let lastY = 0
let moved = 0
let dragCommitted = false

const drawOverlay = (): void => {
  const cv = overlay.value
  const eng = engine.value
  if (!cv || !eng || !docStore.doc) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  cv.width = cv.clientWidth * dpr
  cv.height = cv.clientHeight * dpr
  const ctx = cv.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cv.clientWidth, cv.clientHeight)
  // 选框坐标需与引擎相机一致，这里简化用包围盒映射
  const { w: tw, h: th } = eng.textureSize
  const fit = Math.min(
    (cv.clientWidth * 0.86) / tw,
    (cv.clientHeight * 0.86) / th,
  )
  const scalePx = fit * view.value.scale
  const ox = cv.clientWidth / 2 + view.value.panX - (tw * scalePx) / 2
  const oy = cv.clientHeight / 2 + view.value.panY - (th * scalePx) / 2
  const pxPerMm = (tw / docStore.doc.width) * scalePx
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#4f46e5'
  ctx.fillStyle = 'rgb(79 70 229 / 0.08)'
  for (const obj of docStore.selectedObjects) {
    if (obj.hidden) continue
    const x = ox + obj.x * pxPerMm
    const y = oy + obj.y * pxPerMm
    const w = obj.width * pxPerMm
    const h = obj.height * pxPerMm
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate((obj.rotation * Math.PI) / 180)
    ctx.fillRect(-w / 2, -h / 2, w, h)
    ctx.strokeRect(-w / 2, -h / 2, w, h)
    ctx.restore()
  }
}

const frame = (): void => {
  if (engine.value && docStore.doc) {
    view.value.soloPlate = props.soloPlate ?? -1
    engine.value.render(view.value)
    if (props.showOverlay !== false) drawOverlay()
  }
  raf = requestAnimationFrame(frame)
}

const screenToDoc = (clientX: number, clientY: number): Pt => {
  const cv = canvas.value!
  const eng = engine.value!
  const rect = cv.getBoundingClientRect()
  const sx = clientX - rect.left
  const sy = clientY - rect.top
  const { w: tw, h: th } = eng.textureSize
  const fit = Math.min(
    (cv.clientWidth * 0.86) / tw,
    (cv.clientHeight * 0.86) / th,
  )
  const scalePx = fit * view.value.scale
  const ox = cv.clientWidth / 2 + view.value.panX - (tw * scalePx) / 2
  const oy = cv.clientHeight / 2 + view.value.panY - (th * scalePx) / 2
  const pxPerMm = (tw / docStore.doc!.width) * scalePx
  return { x: (sx - ox) / pxPerMm, y: (sy - oy) / pxPerMm }
}

const onDown = (e: MouseEvent): void => {
  dragging = true
  moved = 0
  dragCommitted = false
  lastX = e.clientX
  lastY = e.clientY
  panning = e.button === 1 || e.shiftKey || e.altKey
}

const onMove = (e: MouseEvent): void => {
  if (!dragging) return
  const dx = e.clientX - lastX
  const dy = e.clientY - lastY
  moved += Math.abs(dx) + Math.abs(dy)
  lastX = e.clientX
  lastY = e.clientY
  if (panning) {
    view.value.panX += dx
    view.value.panY += dy
    return
  }
  if (!docStore.selectedObjects.length) return
  if (moved >= 4 && !dragCommitted) {
    // 首次位移前入栈，保证一次拖拽对应一次撤销
    docStore.snapshot()
    dragCommitted = true
  }
  if (dragCommitted) {
    const eng = engine.value!
    const pxPerMm =
      (eng.textureSize.w / docStore.doc!.width) *
      Math.min(
        (canvas.value!.clientWidth * 0.86) / eng.textureSize.w,
        (canvas.value!.clientHeight * 0.86) / eng.textureSize.h,
      ) *
      view.value.scale
    const dxmm = dx / pxPerMm
    const dymm = dy / pxPerMm
    for (const obj of docStore.selectedObjects) {
      if (!obj.locked) {
        obj.x += dxmm
        obj.y += dymm
      }
    }
    engine.value?.markDirty()
  }
}

const onUp = (e: MouseEvent): void => {
  if (!dragging) return
  dragging = false
  if (dragCommitted) {
    docStore.touch()
    return
  }
  if (!panning && moved < 4) {
    // 点选：顶层优先
    const p = screenToDoc(e.clientX, e.clientY)
    const hit = [...docStore.doc!.objects]
      .reverse()
      .find((o) => !o.hidden && !o.locked && pointInObject(p, o))
    docStore.select(hit ? [hit.id] : [], e.shiftKey)
  }
}

const onWheel = (e: WheelEvent): void => {
  e.preventDefault()
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
  view.value.scale = Math.min(4, Math.max(0.2, view.value.scale * factor))
}

const zoom = (dir: 1 | -1): void => {
  const factor = dir > 0 ? 1.2 : 1 / 1.2
  view.value.scale = Math.min(4, Math.max(0.2, view.value.scale * factor))
}

const resetView = (): void => {
  view.value = { scale: 1, panX: 0, panY: 0, soloPlate: props.soloPlate ?? -1 }
}

onMounted(() => {
  try {
    engine.value = new ProofEngine(canvas.value!)
  } catch (e) {
    error.value = (e as Error).message
    return
  }
  watch(
    () => docStore.doc,
    (d) => {
      if (d && engine.value) {
        engine.value.setDoc(d)
      }
    },
    { deep: true, immediate: true },
  )
  const cv = canvas.value!
  cv.addEventListener('wheel', onWheel, { passive: false })
  raf = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  canvas.value?.removeEventListener('wheel', onWheel)
})

defineExpose({ engine, zoom, resetView })
</script>

<template>
  <div ref="wrap" class="relative w-full h-full">
        <canvas
      v-if="!error"
      ref="canvas"
      class="absolute inset-0 w-full h-full cursor-crosshair"
      @mousedown="onDown"
      @mousemove="onMove"
      @mouseup="onUp"
    />
    <canvas
      v-if="!error && showOverlay !== false"
      ref="overlay"
      class="absolute inset-0 w-full h-full pointer-events-none"
    />
    <div
      v-if="error"
      class="absolute inset-0 flex items-center justify-center"
      style="color: #fca5a5"
    >
      {{ error }}
    </div>
    <div
      class="absolute bottom-4 right-4 flex flex-col gap-2"
      style="font-size: var(--text-xs)"
    >
      <button class="btn btn-icon panel" title="放大" @click="zoom(1)">
        <AppIcon name="plus" :size="16" />
      </button>
      <button class="btn btn-icon panel" title="缩小" @click="zoom(-1)">
        <AppIcon name="search" :size="16" />
      </button>
      <button class="btn btn-icon panel" title="复位视图" @click="resetView">
        <AppIcon name="target" :size="16" />
      </button>
    </div>
    <div
      class="absolute bottom-4 left-4 px-3 py-2 rounded-md panel"
      style="font-size: var(--text-xs); color: var(--color-muted)"
    >
      滚轮缩放 · Shift/Alt 拖拽平移 · 单击选中 · 拖拽移动
    </div>
  </div>
</template>
