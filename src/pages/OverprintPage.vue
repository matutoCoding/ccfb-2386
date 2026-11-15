<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import ProofCanvas from '@/components/ProofCanvas.vue'
import { useDocStore } from '@/stores/doc_store'

const docStore = useDocStore()
const doc = computed(() => docStore.doc)
const compareMode = ref<'composite' | 'split'>('composite')

const setTrap = (patch: Partial<{ enabled: boolean; width: number; miterLimit: number }>): void => {
  if (!doc.value) return
  docStore.snapshot()
  Object.assign(doc.value.trap, patch)
  docStore.touch()
}

// 滑杆拖动实时更新，不入历史
const setTrapLive = (patch: Partial<{ width: number; miterLimit: number }>): void => {
  if (!doc.value) return
  Object.assign(doc.value.trap, patch)
  docStore.touch()
}

const setDoc = <K extends keyof NonNullable<typeof doc.value>>(
  key: K,
  value: NonNullable<typeof doc.value>[K],
): void => {
  if (!doc.value) return
  docStore.snapshot()
  ;(doc.value as Record<string, unknown>)[key as string] = value
  docStore.touch()
}

const setDocLive = (key: 'paperColor' | 'paperOpacity', value: string | number): void => {
  if (!doc.value) return
  ;(doc.value as Record<string, unknown>)[key] = value
  docStore.touch()
}

const platesSorted = computed(() =>
  doc.value ? [...doc.value.plates].sort((a, b) => a.inkOrder - b.inkOrder) : [],
)
</script>

<template>
  <div v-if="doc" class="h-full flex">
    <div class="flex-1 min-w-0 relative">
      <div class="absolute inset-0 flex">
        <template v-if="compareMode === 'split'">
          <div
            v-for="(p, i) in platesSorted"
            :key="p.id"
            class="flex-1 relative border-r"
            style="border-color: var(--color-line-strong)"
          >
            <ProofCanvas :solo-plate="i" :show-overlay="false" />
            <div
              class="absolute top-3 left-3 px-3 py-2 rounded-md panel flex items-center gap-2"
              style="font-size: var(--text-xs)"
            >
              <span
                class="w-3 h-3 rounded-full"
                :style="{ background: p.color }"
              />
              {{ p.name }} · {{ p.angle }}°
            </div>
          </div>
        </template>
        <ProofCanvas v-else />
      </div>
      <div class="absolute top-4 left-4 flex gap-2 panel rounded-md p-1">
        <button
          class="btn btn-ghost"
          :class="{ active: compareMode === 'composite' }"
          @click="compareMode = 'composite'"
        >
          <AppIcon name="overlap" :size="15" />合成预览
        </button>
        <button
          class="btn btn-ghost"
          :class="{ active: compareMode === 'split' }"
          @click="compareMode = 'split'"
        >
          <AppIcon name="grid" :size="15" />分版对照
        </button>
      </div>
    </div>

    <aside
      class="w-80 shrink-0 border-l overflow-auto p-4 flex flex-col gap-4"
      style="border-color: var(--color-line); background: var(--color-sunken)"
    >
      <section class="panel">
        <div class="panel-title">陷印（自动补漏白）</div>
        <div class="p-4 flex flex-col gap-4">
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              :checked="doc.trap.enabled"
              @change="setTrap({ enabled: ($event.target as HTMLInputElement).checked })"
            />
            <span style="font-size: var(--text-xs)">启用自动陷印（仅外轮廓扩边，不描字孔）</span>
          </label>
          <div>
            <label class="field-label">
              陷印宽度 {{ doc.trap.width.toFixed(2) }} mm
            </label>
            <input
              type="range" min="0" max="0.6" step="0.01"
              :value="doc.trap.width"
              :disabled="!doc.trap.enabled"
              @focus="docStore.snapshot()"
              @input="setTrapLive({ width: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>
          <div>
            <label class="field-label">
              尖角限幅 miterLimit（超限自动转斜切）
            </label>
            <input
              type="range" min="1" max="8" step="0.5"
              :value="doc.trap.miterLimit"
              :disabled="!doc.trap.enabled"
              @focus="docStore.snapshot()"
              @input="setTrapLive({ miterLimit: Number(($event.target as HTMLInputElement).value) })"
            />
            <div class="text-right" style="font-size: var(--text-xs); color: var(--color-muted)">
              {{ doc.trap.miterLimit.toFixed(1) }} 倍
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">纸张与预览</div>
        <div class="p-4 flex flex-col gap-4">
          <div class="flex items-center gap-3">
            <label class="field-label mb-0 w-20">纸色</label>
            <input
              type="color" class="w-10 h-9"
              :value="doc.paperColor"
              @focus="docStore.snapshot()"
              @input="setDocLive('paperColor', ($event.target as HTMLInputElement).value)"
            />
            <input
              class="input flex-1"
              :value="doc.paperColor"
              @change="setDoc('paperColor', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div>
            <label class="field-label">纸色衬底强度</label>
            <input
              type="range" min="0.3" max="1" step="0.02"
              :value="doc.paperOpacity"
              @focus="docStore.snapshot()"
              @input="setDocLive('paperOpacity', Number(($event.target as HTMLInputElement).value))"
            />
          </div>
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              :checked="doc.halftone"
              @change="setDoc('halftone', ($event.target as HTMLInputElement).checked)"
            />
            <span style="font-size: var(--text-xs)">网点预览（按各色版角度生成圆网屏）</span>
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              :checked="doc.leakLocate"
              @change="setDoc('leakLocate', ($event.target as HTMLInputElement).checked)"
            />
            <span style="font-size: var(--text-xs)">漏白定位（套准缝隙红色警示）</span>
          </label>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">各版墨层遮盖率与套准</div>
        <div class="p-3 flex flex-col gap-3">
          <div v-for="p in platesSorted" :key="p.id" class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full" :style="{ background: p.color }" />
              <span class="flex-1" style="font-size: var(--text-xs)">{{ p.name }}</span>
              <span style="font-size: var(--text-xs); color: var(--color-muted)">
                {{ Math.round(p.opacity * 100) }}%
              </span>
            </div>
            <input
              type="range" min="0.1" max="1" step="0.01"
              :value="p.opacity"
              @focus="docStore.snapshot()"
              @input="docStore.patchPlateLive(p.id, { opacity: Number(($event.target as HTMLInputElement).value) })"
            />
            <div class="flex gap-2">
              <input
                type="number" step="0.05" class="input"
                :value="p.offsetX"
                title="套准偏移 X mm"
                @change="docStore.updatePlate(p.id, { offsetX: Number(($event.target as HTMLInputElement).value) })"
              />
              <input
                type="number" step="0.05" class="input"
                :value="p.offsetY"
                title="套准偏移 Y mm"
                @change="docStore.updatePlate(p.id, { offsetY: Number(($event.target as HTMLInputElement).value) })"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="panel p-4 flex flex-col gap-2">
        <div class="flex items-center gap-2" style="font-size: var(--text-xs); color: var(--color-muted)">
          <AppIcon name="alert" :size="15" style="color: var(--color-warn)" />
          挖空时下层版片留白；叠印保留下层并做油墨乘算；字孔区域不参与挖空与陷印
        </div>
      </section>
    </aside>
  </div>

  <div v-else class="h-full flex items-center justify-center">
    <div class="empty-state panel w-96">
      <AppIcon name="overlap" :size="40" />
      <div class="empty-title">尚未打开印件</div>
      <RouterLink to="/library" class="btn btn-primary">前往印件库</RouterLink>
    </div>
  </div>
</template>
