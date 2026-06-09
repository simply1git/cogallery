import { describe, it, expect, beforeAll } from 'vitest'
import { webcrypto } from 'node:crypto'
import { deriveKeyFromPassword, generateSaltHex, encryptFile, decryptBuffer } from './cryptoService'

beforeAll(() => {
  (globalThis as typeof globalThis & { window: { crypto: Crypto } }).window = {
    crypto: webcrypto as unknown as Crypto,
  } as any
})

describe('cryptoService', () => {
  it('generates valid salt hex', async () => {
    const salt = await generateSaltHex()
    expect(salt).toMatch(/^[0-9a-f]{32}$/)
  })

  it('encrypts and decrypts a file', async () => {
    const salt = await generateSaltHex()
    const key = await deriveKeyFromPassword('test-password', salt)
    const plaintext = new Blob(['hello cogallery'], { type: 'text/plain' })
    const encrypted = await encryptFile(plaintext, key)
    const decrypted = await decryptBuffer(await encrypted.arrayBuffer(), key, 'text/plain')
    const text = await decrypted.text()
    expect(text).toBe('hello cogallery')
  })
})
