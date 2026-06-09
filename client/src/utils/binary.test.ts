import { describe, it, expect } from 'vitest'
import { uint8ToBase64, base64ToUint8 } from './binary'

describe('binary utils', () => {
  it('round-trips empty array', () => {
    const original = new Uint8Array([])
    expect(base64ToUint8(uint8ToBase64(original))).toEqual(original)
  })

  it('round-trips arbitrary bytes', () => {
    const original = new Uint8Array([0, 1, 127, 255, 42, 99])
    const restored = base64ToUint8(uint8ToBase64(original))
    expect(Array.from(restored)).toEqual(Array.from(original))
  })

  it('handles large payloads without corruption', () => {
    const original = new Uint8Array(100_000)
    for (let i = 0; i < original.length; i++) {
      original[i] = i % 256
    }
    const restored = base64ToUint8(uint8ToBase64(original))
    expect(restored.length).toBe(original.length)
    expect(restored[0]).toBe(0)
    expect(restored[99999]).toBe(99999 % 256)
  })
})
