/**
 * Photo Cache (IndexedDB)
 * Persistently stores full-resolution files in the browser's IndexedDB.
 * Files survive page refreshes, tab closes, and browser restarts.
 * This is the backbone of the P2P system — files are served from here.
 */

const DB_NAME = 'cogallery-cache'
const DB_VERSION = 1
const STORE_NAME = 'files'

interface CachedFile {
  /** Photo ID from the database */
  id: string
  /** The actual file blob */
  blob: Blob
  /** Original filename */
  filename: string
  /** MIME type */
  mimeType: string
  /** When this was cached */
  cachedAt: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

/**
 * Store a file in IndexedDB, keyed by photo ID.
 */
export async function cacheFile(photoId: string, file: File | Blob, filename: string, mimeType: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    const entry: CachedFile = {
      id: photoId,
      blob: file,
      filename,
      mimeType,
      cachedAt: Date.now(),
    }

    const request = store.put(entry)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * Retrieve a cached file by photo ID.
 */
export async function getCachedFile(photoId: string): Promise<CachedFile | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(photoId)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || null)
  })
}

/**
 * Check if a file exists in cache.
 */
export async function hasFile(photoId: string): Promise<boolean> {
  const entry = await getCachedFile(photoId)
  return entry !== null
}

/**
 * Remove a file from cache.
 */
export async function removeCachedFile(photoId: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(photoId)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * Get all cached photo IDs (useful for announcing what we can serve).
 */
export async function getAllCachedIds(): Promise<string[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAllKeys()
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result as string[])
  })
}

/**
 * Get total cache size in bytes.
 */
export async function getCacheSize(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const entries = request.result as CachedFile[]
      const total = entries.reduce((sum, e) => sum + e.blob.size, 0)
      resolve(total)
    }
  })
}
