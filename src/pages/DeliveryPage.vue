<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import ProofCanvas from '@/components/ProofCanvas.vue'
import { useDocStore } from '@/stores/doc_store'
import {
  buildAllPlatesSvg,
  buildPlateSvg,
  downloadDataUrl,
  downloadText,
} from '@/services/exporter'
import { verifyExport, type ReadbackReport } from '@/services/readback'
import { docToFile } from '@/services/storage'

const router = useRouter()
const docStore = useDocStore()
const doc = computed(() => docStore.doc)
const canvasRef = ref<InstanceType<typeof ProofCanvas>>()
const report = ref<ReadbackReport>()
const pngUrl = ref('')
const busy = ref(false)

const exportPlate = (plateId: string, name: string): void => {
  if (!doc.value) return
  downloadText(
    `${doc.value.name}-${name}.svg`,
    buildPlateSvg(doc.value, plateId),
    'image/svg+xml',
  )
}

const exportAllSvg = (): void => {
  if (!doc.value) return
  downloadText(
    `${doc.value.name}-全部分版.svg`,
    buildAllPlatesSvg(doc.value),
    'image/svg+xml',
  )
}

const runPngAndVerify = async (): Promise<void> => {
  const engine = canvasRef.value?.engine
  if (!engine || !doc.value) return
  busy.value = true
  try {
    // 导出与预览同源：同一套光栅纹理出图
    const url = engine.exportPng()
    pngUrl.value = url
    downloadDataUrl(`${doc.value.name}-合成.png`, url)
    // 自动回读：解码导出文件再与实时渲染逐像素叠加比对
    report.value = await verifyExport(engine, url)
  } finally {
    busy.value = false
  }
}

const duplicate = async (): Promise<void> => {
  const id = await docStore.duplicateJob()
  await docStore.load(id)
}

const saveJson = (): void => {
  if (doc.value) docToFile(doc.value)
}
</script>

<template>
  <div v-if="doc" class="h-full flex">
    <div class="flex-1 min-w-0 relative">
      <ProofCanvas ref="canvasRef" :show-overlay="false" />
    </div>

    <aside
      class="w-96 shrink-0 border-l overflow-auto p-4 flex flex-col gap-4"
      style="border-color: var(--color-line); background: var(--color-sunken)"
    >
      <section class="panel">
        <div class="panel-title">SVG 分版导出</div>
        <div class="p-3 flex flex-col gap-2">
          <button class="btn btn-primary w-full" @click="exportAllSvg">
            <AppIcon name="layers" :size="16" />
            导出全部分版（单文件分层）
          </button>
          <div
            v-for="p in [...doc.plates].sort((a, b) => a.inkOrder - b.inkOrder)"
            :key="p.id"
            class="flex items-center gap-2 rounded-md border px-3 py-2"
            style="border-color: var(--color-line)"
          >
            <span class="w-3 h-3 rounded-full" :style="{ background: p.color }" />
            <span class="flex-1" style="font-size: var(--text-xs)">{{ p.name }}</span>
            <button class="btn btn-icon" @click="exportPlate(p.id, p.name)">
              <AppIcon name="download" :size="15" />
            </button>
          </div>
          <p style="color: var(--color-faint); font-size: var(--text-xs); line-height: 1.6">
            版片与预览同一份几何：矢量路径 + 陷印外扩多边形，叠印对象带 data-overprint 标记
          </p>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">PNG 合成与自动回读</div>
        <div class="p-3 flex flex-col gap-3">
          <button
            class="btn btn-primary w-full"
            :disabled="busy"
            @click="runPngAndVerify"
          >
            <AppIcon name="image" :size="16" />
            {{ busy ? '回读比对中…' : '合成出图并自动回读校验' }}
          </button>

          <div v-if="pngUrl" class="flex flex-col gap-2">
            <img
              :src="pngUrl"
              alt="合成出图"
              class="w-full rounded-md border"
              style="border-color: var(--color-line)"
            />
          </div>

          <div v-if="report" class="rounded-md border p-3 flex flex-col gap-2"
            style="border-color: var(--color-line)"
          >
            <div class="flex items-center gap-2 font-medium"
              :style="{ color: report.passed ? 'var(--color-ok)' : 'var(--color-danger)' }"
            >
              <AppIcon :name="report.passed ? 'check' : 'alert'" :size="16" />
              {{ report.passed ? '回读一致，版片与预览同版' : '发现差异，请检查' }}
            </div>
            <div class="grid grid-cols-2 gap-2"
              style="font-size: var(--text-xs); color: var(--color-muted)"
            >
              <span>分辨率：{{ report.width }} × {{ report.height }}</span>
              <span>总像素：{{ report.totalPixels.toLocaleString() }}</span>
              <span>最大通道差：{{ report.maxDelta }}</span>
              <span>平均差：{{ report.meanDelta.toFixed(3) }}</span>
              <span>差异像素：{{ report.mismatchPixels.toLocaleString() }}</span>
              <span>差异率：{{ (report.mismatchRate * 100).toFixed(4) }}%</span>
            </div>
            <div>
              <div class="field-label">差异热图（越红差异越大）</div>
              <img
                :src="report.heatmap"
                alt="差异热图"
                class="w-full rounded-md border"
                style="border-color: var(--color-line)"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">印件管理</div>
        <div class="p-3 flex flex-col gap-2">
          <button class="btn w-full" @click="saveJson">
            <AppIcon name="save" :size="16" />导出工程 JSON
          </button>
          <button class="btn w-full" @click="duplicate">
            <AppIcon name="copy" :size="16" />复制当前印件
          </button>
          <button class="btn w-full" @click="router.push('/library')">
            <AppIcon name="library" :size="16" />返回印件库
          </button>
        </div>
      </section>
    </aside>
  </div>

  <div v-else class="h-full flex items-center justify-center">
    <div class="empty-state panel w-96">
      <AppIcon name="delivery" :size="40" />
      <div class="empty-title">尚未打开印件</div>
      <RouterLink to="/library" class="btn btn-primary">前往印件库</RouterLink>
    </div>
  </div>
</template>
