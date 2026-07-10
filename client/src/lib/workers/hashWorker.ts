// Web Worker for SHA-256 Hashing
// Offloads file hashing to a Web Worker to prevent blocking the main thread

// Convert ArrayBuffer to hex string
function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Convert Blob to ArrayBuffer for hashing
async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return await blob.arrayBuffer();
}

self.onmessage = async (e: MessageEvent) => {
  const { id, file, chunkSize } = e.data;

  try {
    // For large files, hash only the first chunkSize + last chunkSize + size for speed
    // Default to 1MB chunks if not specified
    const HASH_CHUNK = chunkSize || 1024 * 1024; // 1MB
    let buffer: ArrayBuffer;

    if (file.size <= HASH_CHUNK * 2) {
      // Small file: hash entire file
      buffer = await blobToArrayBuffer(file);
    } else {
      // Large file: hash first chunk, last chunk, and size
      const first = await file.slice(0, HASH_CHUNK).arrayBuffer();
      const last = await file.slice(-HASH_CHUNK).arrayBuffer();
      const sizeBytes = new TextEncoder().encode(file.size.toString());
      const combined = new Uint8Array(first.byteLength + last.byteLength + sizeBytes.byteLength);
      combined.set(new Uint8Array(first), 0);
      combined.set(new Uint8Array(last), first.byteLength);
      combined.set(sizeBytes, first.byteLength + last.byteLength);
      buffer = combined.buffer;
    }

    // Compute SHA-256 hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashHex = arrayBufferToHex(hashBuffer);

    // Send result back to main thread
    self.postMessage({ id, success: true, hash: hashHex });
  } catch (error: any) {
    // Send error back to main thread
    self.postMessage({ id, success: false, error: error.message });
  }
};