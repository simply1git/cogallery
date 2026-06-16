import { openDB, DBSchema } from 'idb'

interface VaultDB extends DBSchema {
  keys: {
    key: string // roomId
    value: CryptoKey
  }
}

let dbPromise: ReturnType<typeof openDB<VaultDB>> | null = null

async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<VaultDB>('cogallery-vault', 1, {
      upgrade(db) {
        db.createObjectStore('keys')
      },
    })
  }
  return dbPromise
}

export const vaultKeyService = {
  async saveKey(roomId: string, key: CryptoKey): Promise<void> {
    const db = await getDB()
    await db.put('keys', key, roomId)
  },

  async getKey(roomId: string): Promise<CryptoKey | undefined> {
    const db = await getDB()
    return db.get('keys', roomId)
  },

  async deleteKey(roomId: string): Promise<void> {
    const db = await getDB()
    await db.delete('keys', roomId)
  },

  async clearAllKeys(): Promise<void> {
    const db = await getDB()
    await db.clear('keys')
  }
}
