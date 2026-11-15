<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import { useLibraryStore } from '@/stores/library_store'
import { useDocStore } from '@/stores/doc_store'

const router = useRouter()
const library = useLibraryStore()
const docStore = useDocStore()
const seedInput = ref(2386)
const fileInput = ref<HTMLInputElement>()

onMounted(() => void library.refresh())

const openBuiltIn = async (): Promise<void> => {
  await docStore.openGiftBox(seedInput.value)
  void router.push('/separation')
}

const openJob = async (id: string): Promise<void> => {
  await docStore.load(id)
  void router.push('/separation')
}

const onImport = async (e: Event): Promise<void> => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const id = await library.importFile(file)
  await openJob(id)
}

const fmtTime = (t: number): string => {
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<template>
  <div class="h-full overflow-auto p-6">
    <div class="max-w-6xl mx-auto flex flex-col gap-6">
      <section class="panel p-6 flex items-center gap-6">
        <div
          class="w-14 h-14 rounded-lg flex items-center justify-center shrink-0"
          style="background: var(--color-primary-soft); color: var(--color-primary)"
        >
          <AppIcon name="droplet" :size="26" />
        </div>
        <div class="flex-1">
          <h1 style="font-size: var(--text-xl); font-weight: 600">
            内置双色礼盒工程
          </h1>
          <p
            class="mt-1"
            style="color: var(--color-muted); font-size: var(--text-xs)"
          >
            打开即得深红 + 烫金双色礼盒，文字已转曲线可编辑；固定种子重建，同种子结果完全一致
          </p>
        </div>
        <div class="flex items-center gap-3">
          <label class="field-label mb-0">重建种子</label>
          <input
            v-model.number="seedInput"
            type="number"
            class="input w-28"
          />
          <button class="btn btn-primary" @click="openBuiltIn">
            <AppIcon name="refresh" :size="16" />
            按种子重建并打开
          </button>
        </div>
      </section>

      <section>
        <div class="flex items-center justify-between mb-4">
          <h2
            style="font-size: var(--text-lg); font-weight: 600"
          >
            浏览器存档
          </h2>
          <div class="flex gap-3">
            <input
              ref="fileInput"
              type="file"
              accept="application/json"
              class="hidden"
              @change="onImport"
            />
            <button class="btn" @click="fileInput?.click()">
              <AppIcon name="download" :size="16" />
              导入 JSON
            </button>
          </div>
        </div>

        <div
          v-if="!library.summaries.length"
          class="panel empty-state"
        >
          <AppIcon name="library" :size="40" />
          <div class="empty-title">还没有存档印件</div>
          <div class="empty-sub">
            先打开内置礼盒，编辑后会自动存入浏览器 IndexedDB
          </div>
        </div>

        <div v-else class="grid grid-cols-3 gap-4">
          <article
            v-for="s in library.summaries"
            :key="s.id"
            class="panel p-5 flex flex-col gap-3 transition-shadow hover:shadow-md"
            style="transition: box-shadow var(--animate-base)"
          >
            <div class="flex items-start justify-between gap-3">
              <h3
                class="font-semibold leading-snug"
                style="font-size: var(--text-base)"
              >
                {{ s.name }}
              </h3>
            </div>
            <div
              class="flex gap-4"
              style="color: var(--color-muted); font-size: var(--text-xs)"
            >
              <span>{{ s.plateCount }} 色版</span>
              <span>{{ s.objectCount }} 对象</span>
            </div>
            <div
              style="color: var(--color-faint); font-size: var(--text-xs)"
            >
              更新于 {{ fmtTime(s.updatedAt) }}
            </div>
            <div class="flex gap-2 mt-auto pt-2">
              <button class="btn btn-primary flex-1" @click="openJob(s.id)">
                打开
              </button>
              <button
                class="btn"
                title="复制印件"
                @click="library.duplicate(s.id)"
              >
                <AppIcon name="copy" :size="16" />
              </button>
              <button
                class="btn btn-danger"
                title="删除"
                @click="library.remove(s.id)"
              >
                <AppIcon name="trash" :size="16" />
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>
