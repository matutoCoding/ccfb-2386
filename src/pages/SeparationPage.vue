<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import ProofCanvas from '@/components/ProofCanvas.vue'
import { useDocStore } from '@/stores/doc_store'
import { FONT_FAMILIES } from '@/engine/font_service'

const router = useRouter()
const docStore = useDocStore()
const solo = ref(-1)

const doc = computed(() => docStore.doc)
const platesSorted = computed(() =>
  doc.value ? [...doc.value.plates].sort((a, b) => a.inkOrder - b.inkOrder) : [],
)
const objectsReversed = computed(() =>
  doc.value ? [...doc.value.objects].reverse() : [],
)
const selected = computed(() => docStore.selectedObjects[0])

const plateName = (id: string): string =>
  doc.value?.plates.find((p) => p.id === id)?.name || '—'

const addToPlate = ref('')
const ensurePlateTarget = (): string => {
  if (addToPlate.value) return addToPlate.value
  return doc.value?.plates[0]?.id || ''
}

const add = (type: 'rect' | 'ellipse' | 'text' | 'path'): void => {
  const pid = ensurePlateTarget()
  if (!pid) return
  docStore.addObject(type, pid)
}

const onKey = (e: KeyboardEvent): void => {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    e.shiftKey ? docStore.redo() : docStore.undo()
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
    e.preventDefault()
    docStore.redo()
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && docStore.selectedIds.length) {
    docStore.removeObjects(docStore.selectedIds)
  }
}
</script>

<template>
  <div
    v-if="doc"
    class="h-full flex"
    tabindex="0"
    @keydown="onKey"
  >
    <!-- 左：画布 -->
    <div class="flex-1 min-w-0 relative">
      <ProofCanvas :solo-plate="solo" />
      <div
        class="absolute top-4 left-4 flex gap-2 panel rounded-md p-1"
      >
        <button
          class="btn btn-ghost"
          :class="{ active: solo === -1 }"
          @click="solo = -1"
        >
          合成
        </button>
        <button
          v-for="(p, i) in platesSorted"
          :key="p.id"
          class="btn btn-ghost"
          :class="{ active: solo === i }"
          @click="solo = solo === i ? -1 : i"
        >
          <span
            class="w-3 h-3 rounded-full border"
            :style="{ background: p.color, borderColor: 'var(--color-line-strong)' }"
          />
          {{ p.name }}
        </button>
      </div>
    </div>

    <!-- 右：控制面板 -->
    <aside
      class="w-80 shrink-0 border-l overflow-auto flex flex-col gap-4 p-4"
      style="border-color: var(--color-line); background: var(--color-sunken)"
    >
      <div class="flex gap-2">
        <button
          class="btn flex-1"
          :disabled="!docStore.canUndo"
          @click="docStore.undo()"
        >
          <AppIcon name="undo" :size="16" />撤销
        </button>
        <button
          class="btn flex-1"
          :disabled="!docStore.canRedo"
          @click="docStore.redo()"
        >
          <AppIcon name="redo" :size="16" />重做
        </button>
      </div>

      <!-- 色版列表 -->
      <section class="panel">
        <div class="panel-title flex items-center justify-between">
          <span>色版与墨序</span>
          <button class="btn btn-icon" title="新增色版" @click="docStore.addPlate()">
            <AppIcon name="plus" :size="15" />
          </button>
        </div>
        <div class="p-3 flex flex-col gap-2">
          <div
            v-for="(p, i) in platesSorted"
            :key="p.id"
            class="rounded-md border p-3 flex flex-col gap-2"
            style="border-color: var(--color-line)"
          >
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium" style="width: 20px; color: var(--color-faint)">
                {{ i + 1 }}
              </span>
              <input
                :value="p.name"
                class="input flex-1"
                @change="docStore.updatePlate(p.id, { name: ($event.target as HTMLInputElement).value })"
              />
              <input
                type="color"
                class="w-9 h-8"
                :value="p.color"
                @focus="docStore.snapshot()"
                @input="docStore.patchPlateLive(p.id, { color: ($event.target as HTMLInputElement).value })"
              />
            </div>
            <div class="flex items-center gap-2">
              <label class="field-label mb-0 w-16">遮盖率</label>
              <input
                type="range" min="0.1" max="1" step="0.01"
                :value="p.opacity"
                @focus="docStore.snapshot()"
                @input="docStore.patchPlateLive(p.id, { opacity: Number(($event.target as HTMLInputElement).value) })"
              />
              <span class="w-10 text-right" style="font-size: var(--text-xs)">
                {{ Math.round(p.opacity * 100) }}%
              </span>
            </div>
            <div class="flex items-center gap-2">
              <label class="field-label mb-0 w-16">网点角</label>
              <input
                type="number"
                class="input"
                :value="p.angle"
                @change="docStore.updatePlate(p.id, { angle: Number(($event.target as HTMLInputElement).value) })"
              />
              <span style="color: var(--color-faint); font-size: var(--text-xs)">°</span>
            </div>
            <div class="flex items-center gap-2">
              <label class="field-label mb-0 w-16">套准 X/Y</label>
              <input
                type="number" step="0.05" class="input"
                :value="p.offsetX"
                @change="docStore.updatePlate(p.id, { offsetX: Number(($event.target as HTMLInputElement).value) })"
              />
              <input
                type="number" step="0.05" class="input"
                :value="p.offsetY"
                @change="docStore.updatePlate(p.id, { offsetY: Number(($event.target as HTMLInputElement).value) })"
              />
            </div>
            <div class="flex gap-1">
              <button
                class="btn btn-icon flex-1" :disabled="i === 0"
                title="上移墨序"
                @click="docStore.movePlateOrder(p.id, -1)"
              >
                <AppIcon name="up" :size="15" />
              </button>
              <button
                class="btn btn-icon flex-1" :disabled="i === platesSorted.length - 1"
                title="下移墨序"
                @click="docStore.movePlateOrder(p.id, 1)"
              >
                <AppIcon name="down" :size="15" />
              </button>
              <button
                class="btn btn-icon flex-1"
                :title="p.hidden ? '显示' : '隐藏'"
                @click="docStore.updatePlate(p.id, { hidden: !p.hidden })"
              >
                <AppIcon :name="p.hidden ? 'eyeOff' : 'eye'" :size="15" />
              </button>
              <button
                class="btn btn-icon btn-danger flex-1"
                title="删除色版"
                @click="docStore.removePlate(p.id)"
              >
                <AppIcon name="trash" :size="15" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- 对象图层 -->
      <section class="panel">
        <div class="panel-title">对象与层级</div>
        <div class="p-3 flex flex-col gap-2">
          <select v-model="addToPlate" class="select">
            <option value="" disabled>选择归属色版</option>
            <option v-for="p in doc.plates" :key="p.id" :value="p.id">
              {{ p.name }}
            </option>
          </select>
          <div class="grid grid-cols-4 gap-1">
            <button class="btn" title="矩形" @click="add('rect')">
              <AppIcon name="square" :size="15" />
            </button>
            <button class="btn" title="椭圆" @click="add('ellipse')">
              <AppIcon name="circle" :size="15" />
            </button>
            <button class="btn" title="文字" @click="add('text')">
              <AppIcon name="text" :size="15" />
            </button>
            <button class="btn" title="路径" @click="add('path')">
              <AppIcon name="pen" :size="15" />
            </button>
          </div>
          <div
            class="max-h-64 overflow-auto flex flex-col gap-1"
          >
            <button
              v-for="o in objectsReversed"
              :key="o.id"
              class="btn justify-start"
              :class="{ active: docStore.selectedIds.includes(o.id) }"
              @click="docStore.select([o.id], $event.shiftKey)"
            >
              <AppIcon
                :name="{ rect: 'square', ellipse: 'circle', text: 'text', path: 'pen' }[o.type]"
                :size="14"
              />
              <span class="flex-1 text-left truncate">{{ o.name }}</span>
              <AppIcon
                :name="o.locked ? 'lock' : 'unlock'"
                :size="13"
                @click.stop="docStore.toggleObjectFlag(o.id, 'locked')"
              />
              <AppIcon
                :name="o.hidden ? 'eyeOff' : 'eye'"
                :size="13"
                @click.stop="docStore.toggleObjectFlag(o.id, 'hidden')"
              />
            </button>
          </div>
        </div>
      </section>

      <!-- 选中对象属性 -->
      <section v-if="selected" class="panel">
        <div class="panel-title">对象属性 · {{ selected.name }}</div>
        <div class="p-3 flex flex-col gap-3">
          <div v-if="selected.type === 'text'" class="flex flex-col gap-2">
            <label class="field-label">文字内容（改后自动重建曲线）</label>
            <input
              :value="selected.text"
              class="input"
              @change="docStore.updateObject(selected.id, { text: ($event.target as HTMLInputElement).value })"
            />
            <div class="flex gap-2">
              <select
                class="select flex-1"
                :value="selected.fontFamily"
                @change="docStore.updateObject(selected.id, { fontFamily: ($event.target as HTMLSelectElement).value })"
              >
                <option v-for="f in FONT_FAMILIES" :key="f" :value="f">{{ f }}</option>
              </select>
              <button
                class="btn"
                :class="{ active: selected.fontStyle === 'bold' }"
                title="粗体"
                @click="docStore.updateObject(selected.id, { fontStyle: selected.fontStyle === 'bold' ? 'regular' : 'bold' })"
              >
                B
              </button>
              <input
                type="number" class="input w-24"
                :value="selected.fontSize"
                @change="docStore.updateObject(selected.id, { fontSize: Number(($event.target as HTMLInputElement).value) })"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="field-label">X (mm)</label>
              <input
                type="number" step="0.5" class="input" :value="selected.x"
                @change="docStore.updateObject(selected.id, { x: Number(($event.target as HTMLInputElement).value) })"
              />
            </div>
            <div>
              <label class="field-label">Y (mm)</label>
              <input
                type="number" step="0.5" class="input" :value="selected.y"
                @change="docStore.updateObject(selected.id, { y: Number(($event.target as HTMLInputElement).value) })"
              />
            </div>
            <div v-if="selected.type !== 'text'">
              <label class="field-label">宽 (mm)</label>
              <input
                type="number" step="0.5" class="input" :value="selected.width"
                @change="docStore.updateObject(selected.id, { width: Number(($event.target as HTMLInputElement).value) })"
              />
            </div>
            <div v-if="selected.type !== 'text'">
              <label class="field-label">高 (mm)</label>
              <input
                type="number" step="0.5" class="input" :value="selected.height"
                @change="docStore.updateObject(selected.id, { height: Number(($event.target as HTMLInputElement).value) })"
              />
            </div>
            <div>
              <label class="field-label">旋转°</label>
              <input
                type="number" class="input" :value="selected.rotation"
                @change="docStore.updateObject(selected.id, { rotation: Number(($event.target as HTMLInputElement).value) })"
              />
            </div>
            <div>
              <label class="field-label">不透明度</label>
              <input
                type="number" min="0.05" max="1" step="0.05" class="input" :value="selected.opacity"
                @change="docStore.updateObject(selected.id, { opacity: Number(($event.target as HTMLInputElement).value) })"
              />
            </div>
          </div>
          <div class="flex gap-2">
            <button
              class="btn flex-1"
              :class="{ active: selected.overprint }"
              @click="docStore.toggleObjectFlag(selected.id, 'overprint')"
            >
              <AppIcon name="overlap" :size="15" />
              {{ selected.overprint ? '叠印中' : '挖空' }}
            </button>
            <button
              class="btn"
              title="上移层级"
              @click="docStore.reorderObject(selected.id, 1)"
            >
              <AppIcon name="up" :size="15" />
            </button>
            <button
              class="btn"
              title="下移层级"
              @click="docStore.reorderObject(selected.id, -1)"
            >
              <AppIcon name="down" :size="15" />
            </button>
            <button
              class="btn btn-danger"
              @click="docStore.removeObjects([selected.id])"
            >
              <AppIcon name="trash" :size="15" />
            </button>
          </div>
          <div style="color: var(--color-faint); font-size: var(--text-xs)">
            归属：{{ plateName(selected.plateId) }}
          </div>
        </div>
      </section>

      <button class="btn" @click="router.push('/overprint')">
        前往套印设置
        <AppIcon name="overlap" :size="15" />
      </button>
    </aside>
  </div>

  <div v-else class="h-full flex items-center justify-center">
    <div class="empty-state panel w-96">
      <AppIcon name="library" :size="40" />
      <div class="empty-title">尚未打开印件</div>
      <div class="empty-sub">去印件库打开内置双色礼盒工程</div>
      <RouterLink to="/library" class="btn btn-primary">前往印件库</RouterLink>
    </div>
  </div>
</template>
