import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = path.join(__dirname, 'file-cache')

// Ensure cache directory exists
async function ensureDir() {
  try {
    await fs.access(CACHE_DIR)
  } catch {
    await fs.mkdir(CACHE_DIR, { recursive: true })
  }
}

export async function initStore() {
  await ensureDir()
  console.log(`[Store] Initialized at ${CACHE_DIR}`)
}

export async function hasFile(photoId) {
  try {
    await fs.access(path.join(CACHE_DIR, `${photoId}.meta.json`))
    await fs.access(path.join(CACHE_DIR, `${photoId}.data`))
    return true
  } catch {
    return false
  }
}

export async function saveFile(photoId, buffer, filename, mimeType) {
  await ensureDir()
  const dataPath = path.join(CACHE_DIR, `${photoId}.data`)
  const metaPath = path.join(CACHE_DIR, `${photoId}.meta.json`)

  await fs.writeFile(dataPath, buffer)
  await fs.writeFile(metaPath, JSON.stringify({ filename, mimeType, size: buffer.byteLength }))
  
  console.log(`[Store] Saved ${filename} (${buffer.byteLength} bytes)`)
}

export async function getFile(photoId) {
  if (!(await hasFile(photoId))) return null

  const dataPath = path.join(CACHE_DIR, `${photoId}.data`)
  const metaPath = path.join(CACHE_DIR, `${photoId}.meta.json`)

  try {
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'))
    const buffer = await fs.readFile(dataPath)
    return { buffer, ...meta }
  } catch (err) {
    console.error(`[Store] Error reading ${photoId}:`, err)
    return null
  }
}

export async function getCacheSize() {
  try {
    const files = await fs.readdir(CACHE_DIR)
    let total = 0
    for (const file of files) {
      const stat = await fs.stat(path.join(CACHE_DIR, file))
      total += stat.size
    }
    return total
  } catch {
    return 0
  }
}
