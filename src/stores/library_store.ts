import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { JobDoc, JobSummary } from '@/types/doc'
import {
  idbAll,
  idbDelete,
  idbPut,
  listSummaries,
  parseDocFile,
} from '@/services/storage'
import { uid } from '@/utils/common'

export const useLibraryStore = defineStore('library', () => {
  const summaries = ref<JobSummary[]>([])
  const loading = ref(false)

  const refresh = async (): Promise<void> => {
    loading.value = true
    summaries.value = await listSummaries()
    loading.value = false
  }

  const remove = async (id: string): Promise<void> => {
    await idbDelete(id)
    await refresh()
  }

  const duplicate = async (id: string): Promise<void> => {
    const all = await idbAll()
    const src = all.find((d) => d.id === id)
    if (!src) return
    const copy: JobDoc = structuredClone(src)
    copy.id = uid('job')
    copy.name = `${src.name} 副本`
    copy.updatedAt = Date.now()
    await idbPut(copy)
    await refresh()
  }

  const importFile = async (file: File): Promise<string> => {
    const d = await parseDocFile(file)
    d.id = uid('job')
    d.updatedAt = Date.now()
    await idbPut(d)
    await refresh()
    return d.id
  }

  return { summaries, loading, refresh, remove, duplicate, importFile }
})
