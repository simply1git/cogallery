// Worker for computing SHA-256 hashes of files to avoid blocking the main thread
// This worker receives a File or Blob and returns its SHA-256 hash as a hex string

let hashInProgress = false;

// Message handler for the worker
self.onmessage = async (event) => {
  // Prevent concurrent hashing (though we could handle multiple if needed)
  if (hashInProgress) {
    self.postMessage({ error: 'Hash computation already in progress' });
    return;
  }

  hashInProgress = true;

  try {
    const { file, chunkSize } = event.data;

    // Default chunk size: 1MB
    const HASH_CHUNK = chunkSize || 1024 * 1024;

    let buffer;

    // For large files, hash only the first 1MB + last 1MB + size for speed
    // This is a common optimization for file deduplication
    if (file.size <= HASH_CHUNK * 2) {
      // Small file: hash the entire thing
      buffer = await file.arrayBuffer();
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

    // Convert to hex string
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Send result back to main thread
    self.postMessage({ hash: hashHex });
  } catch (error) {
    // Send error back to main thread
    self.postMessage({ error: error.message });
  } finally {
    hashInProgress = false;
  }
};

// Handle errors in the worker itself
self.onerror = (event) => {
  console.error('Worker error:', event);
  self.postMessage({ error: 'Internal worker error' });
};