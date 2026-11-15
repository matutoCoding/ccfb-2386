import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ArtObject, JobDoc, Plate } from '@/types/doc'
import { cloneDoc, uid } from '@/utils/common'
import { idbDelete, idbGet, idbPut } from '@/services/storage'
import { buildGiftBoxJob } from '@/services/demo_factory'
import { ellipseToPaths, rectToPaths } from '@/engine/geometry'
import { fontReady, layoutText, loadFonts } from '@/engine/font_service'

const HISTORY_LIMIT = 50

export const useDocStore = defineStore('doc', () => {
  const doc = ref<JobDoc | null>(null)
  const selectedIds = ref<string[]>([])
  const past = ref<JobDoc[]>([])
  const future = ref<JobDoc[]>([])
  const saving = ref(false)

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)
  const selectedObjects = computed(() =>
    doc.value
      ? doc.value.objects.filter((o) => selectedIds.value.includes(o.id))
      : [],
  )

  // 任何结构性修改前压栈
  const snapshot = (): void => {
    if (!doc.value) return
    past.value.push(cloneDoc(doc.value))
    if (past.value.length > HISTORY_LIMIT) past.value.shift()
    future.value = []
  }

  const touch = (): void => {
    if (!doc.value) return
    doc.value.updatedAt = Date.now()
    void persist()
  }

  const persist = async (): Promise<void> => {
    if (!doc.value) return
    saving.value = true
    await idbPut(cloneDoc(doc.value))
    saving.value = false
  }

  const load = async (id: string): Promise<void> => {
    const d = await idbGet(id)
    if (!d) throw new Error('印件不存在')
    doc.value = d
    selectedIds.value = []
    past.value = []
    future.value = []
  }

  const openGiftBox = async (seed: number): Promise<void> => {
    await loadFonts()
    doc.value = buildGiftBoxJob(seed)
    selectedIds.value = []
    past.value = []
    future.value = []
    void persist()
  }

  const replaceDoc = (d: JobDoc): void => {
    doc.value = cloneDoc(d)
    selectedIds.value = []
    past.value = []
    future.value = []
    void persist()
  }

  const undo = (): void => {
    const prev = past.value.pop()
    if (!prev || !doc.value) return
    future.value.push(cloneDoc(doc.value))
    doc.value = prev
    selectedIds.value = []
    void persist()
  }

  const redo = (): void => {
    const next = future.value.pop()
    if (!next || !doc.value) return
    past.value.push(cloneDoc(doc.value))
    doc.value = next
    selectedIds.value = []
    void persist()
  }

  const select = (ids: string[], additive = false): void => {
    selectedIds.value = additive
      ? [...new Set([...selectedIds.value, ...ids])]
      : ids
  }

  // ---- 色版操作 ----
  const addPlate = (): void => {
    if (!doc.value) return
    snapshot()
    const order = doc.value.plates.length + 1
    const plate: Plate = {
      id: uid('plate'),
      name: `专色 ${order}`,
      color: '#0f766e',
      inkOrder: order,
      opacity: 0.9,
      angle: 45,
      offsetX: 0,
      offsetY: 0,
      locked: false,
      hidden: false,
    }
    doc.value.plates.push(plate)
    touch()
  }

  const removePlate = (plateId: string): void => {
    if (!doc.value) return
    snapshot()
    doc.value.plates = doc.value.plates.filter((p) => p.id !== plateId)
    doc.value.objects = doc.value.objects.filter(
      (o) => o.plateId !== plateId,
    )
    selectedIds.value = selectedIds.value.filter(
      (id) => doc.value?.objects.some((o) => o.id === id),
    )
    touch()
  }

  const updatePlate = (plateId: string, patch: Partial<Plate>): void => {
    if (!doc.value) return
    snapshot()
    const p = doc.value.plates.find((x) => x.id === plateId)
    if (p) Object.assign(p, patch)
    touch()
  }

  // 滑杆拖动中的实时更新，不入历史（聚焦时已由调用方 snapshot）
  const patchPlateLive = (plateId: string, patch: Partial<Plate>): void => {
    if (!doc.value) return
    const p = doc.value.plates.find((x) => x.id === plateId)
    if (p) Object.assign(p, patch)
    doc.value.updatedAt = Date.now()
    void persist()
  }

  // 墨序调整：交换并重排连续序号
  const movePlateOrder = (plateId: string, dir: -1 | 1): void => {
    if (!doc.value) return
    const sorted = [...doc.value.plates].sort((a, b) => a.inkOrder - b.inkOrder)
    const i = sorted.findIndex((p) => p.id === plateId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= sorted.length) return
    snapshot()
    const tmp = sorted[i].inkOrder
    sorted[i].inkOrder = sorted[j].inkOrder
    sorted[j].inkOrder = tmp
    touch()
  }

  // ---- 对象操作 ----
  const addObject = (type: ArtObject['type'], plateId: string): void => {
    if (!doc.value) return
    snapshot()
    const base: ArtObject = {
      id: uid('obj'),
      type,
      name: `${type}-${doc.value.objects.length + 1}`,
      plateId,
      x: doc.value.width / 2,
      y: doc.value.height / 2,
      rotation: 0,
      width: 40,
      height: 24,
      opacity: 1,
      overprint: false,
      locked: false,
      hidden: false,
      text: '文字',
      fontFamily: 'SimHei',
      fontStyle: 'regular',
      fontSize: 32,
      subPaths: [],
    }
    if (type === 'rect') base.subPaths = rectToPaths(base.width, base.height)
    if (type === 'ellipse') {
      base.subPaths = ellipseToPaths(base.width, base.height)
    }
    if (type === 'text') refreshTextGeometry(base)
    if (type === 'path') base.subPaths = rectToPaths(30, 30)
    doc.value.objects.push(base)
    selectedIds.value = [base.id]
    touch()
  }

  const refreshTextGeometry = (obj: ArtObject): void => {
    if (!fontReady(obj.fontFamily, obj.fontStyle)) return
    const laid = layoutText(obj.text, obj.fontFamily, obj.fontStyle, obj.fontSize)
    if (laid) {
      obj.subPaths = laid.subPaths
      obj.width = laid.width
      obj.height = laid.height
    }
  }

  const updateObject = (id: string, patch: Partial<ArtObject>): void => {
    if (!doc.value) return
    const obj = doc.value.objects.find((o) => o.id === id)
    if (!obj) return
    snapshot()
    Object.assign(obj, patch)
    if (
      obj.type === 'text' &&
      ('text' in patch || 'fontFamily' in patch ||
        'fontStyle' in patch || 'fontSize' in patch)
    ) {
      refreshTextGeometry(obj)
    }
    if (obj.type !== 'text' && ('width' in patch || 'height' in patch)) {
      obj.subPaths =
        obj.type === 'ellipse'
          ? ellipseToPaths(obj.width, obj.height)
          : rectToPaths(obj.width, obj.height)
    }
    touch()
  }

  const removeObjects = (ids: string[]): void => {
    if (!doc.value || !ids.length) return
    snapshot()
    doc.value.objects = doc.value.objects.filter((o) => !ids.includes(o.id))
    selectedIds.value = selectedIds.value.filter((id) => !ids.includes(id))
    touch()
  }

  // 层级重排（数组尾部 = 顶层）
  const reorderObject = (id: string, dir: -1 | 1): void => {
    if (!doc.value) return
    const arr = doc.value.objects
    const i = arr.findIndex((o) => o.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= arr.length) return
    snapshot()
    const [item] = arr.splice(i, 1)
    arr.splice(j, 0, item)
    touch()
  }

  const toggleObjectFlag = (
    id: string,
    flag: 'locked' | 'hidden' | 'overprint',
  ): void => {
    if (!doc.value) return
    const obj = doc.value.objects.find((o) => o.id === id)
    if (!obj || (flag === 'overprint' && obj.locked)) return
    snapshot()
    obj[flag] = !obj[flag]
    touch()
  }

  const duplicateJob = async (): Promise<string> {
    if (!doc.value) throw new Error('无文档')
    snapshot()
    const copy = cloneDoc(doc.value)
    copy.id = uid('job')
    copy.name = `${doc.value.name} 副本`
    copy.updatedAt = Date.now()
    await idbPut(copy)
    return copy.id
  }

  const removeCurrent = async (): Promise<void> => {
    if (!doc.value) return
    await idbDelete(doc.value.id)
    doc.value = null
    selectedIds.value = []
    past.value = []
    future.value = []
  }

  return {
    doc,
    selectedIds,
    selectedObjects,
    canUndo,
    canRedo,
    saving,
    snapshot,
    touch,
    persist,
    load,
    openGiftBox,
    replaceDoc,
    undo,
    redo,
    select,
    addPlate,
    removePlate,
    updatePlate,
    patchPlateLive,
    movePlateOrder,
    addObject,
    updateObject,
    removeObjects,
    reorderObject,
    toggleObjectFlag,
    duplicateJob,
    removeCurrent,
  }
})
