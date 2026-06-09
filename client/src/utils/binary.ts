/** Efficient Uint8Array ↔ base64 for Yjs broadcast transport */

export function uint8ToBase64(bytes: Uint8Array): string {
  if (bytes.length === 0) return ''
  // Chunked encoding avoids call stack limits on large updates
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK)
    binary += String.fromCharCode(...slice)
  }
  return btoa(binary)
}

export function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
