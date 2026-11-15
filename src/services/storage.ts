import type { JobDoc, JobSummary } from '@/types/doc'

const DB_NAME = 'proof-bench'
const STORE = 'jobs'
const DB_VERSION = 1

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

const tx = <T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> =>
  openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const store = db.transaction(STORE, mode).objectStore(STORE)
        const req = fn(store)
        req.onsuccess = () => {
          db.close()
          resolve(req.result)
        }
        req.onerror = () => {
          db.close()
          reject(req.error)
        }
      }),
  )

export const idbPut = (doc: JobDoc): Promise<IDBValidKey> =>
  tx('readwrite', (s) => s.put(doc))

export const idbGet = (id: string): Promise<JobDoc | undefined> =>
  tx('readonly', (s) => s.get(id) as IDBRequest<JobDoc | undefined>)

export const idbDelete = (id: string): Promise<undefined> =>
  tx('readwrite', (s) => s.delete(id) as IDBRequest<undefined>)

export const idbAll = (): Promise<JobDoc[]> =>
  tx('readonly', (s) => s.getAll() as IDBRequest<JobDoc[]>)

export const listSummaries = async (): Promise<JobSummary[]> => {
  const all = await idbAll()
  return all
    .map((d) => ({
      id: d.id,
      name: d.name,
      updatedAt: d.updatedAt,
      plateCount: d.plates.length,
      objectCount: d.objects.length,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

// JSON 文件导出/导入，便于跨机器流转
export const docToFile = (doc: JobDoc): void => {
  const blob = new Blob([JSON.stringify(doc, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${doc.name}.proof.json`
  a.click()
  URL.revokeObjectURL(url)
}

export const parseDocFile = (file: File): Promise<JobDoc> =>
  file.text().then((t) => JSON.parse(t) as JobDoc)
