// Web Crypto API utility for End-to-End Encryption

const ALGO = 'AES-GCM';
// OWASP 2024+ recommends 600,000 iterations for PBKDF2 with SHA-256
const PBKDF2_ITERATIONS = 600_000;

export async function deriveKeyFromPassword(password: string, saltHex: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const saltBuffer = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGO, length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function generateSaltHex(): Promise<string> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const MAGIC_HEADER = new TextEncoder().encode('CHUNKED_V1');

export async function encryptFile(file: File | Blob, key: CryptoKey): Promise<Blob> {
  const isOPFS = !!(navigator.storage && navigator.storage.getDirectory);
  
  if (isOPFS) {
    try {
      const root = await navigator.storage.getDirectory();
      const filename = `enc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const fileHandle = await root.getFileHandle(filename, { create: true });
      // OPFS write
      // The typings for createWritable might be missing in some TS configs, using any
      const writable = await (fileHandle as any).createWritable();
      
      await writable.write(MAGIC_HEADER);
      
      const masterIv = window.crypto.getRandomValues(new Uint8Array(12));
      await writable.write(masterIv);
      
      let offset = 0;
      let chunkIndex = 0;
      
      while (offset < file.size) {
        const chunk = file.slice(offset, offset + CHUNK_SIZE);
        const buffer = await chunk.arrayBuffer();
        
        const chunkIv = new Uint8Array(12);
        for (let i = 0; i < 12; i++) {
          chunkIv[i] = masterIv[i] ^ ((chunkIndex >> (i * 8)) & 0xff);
        }
        
        const encryptedChunk = await window.crypto.subtle.encrypt(
          { name: ALGO, iv: chunkIv },
          key,
          buffer
        );
        
        await writable.write(encryptedChunk);
        
        offset += CHUNK_SIZE;
        chunkIndex++;
      }
      
      await writable.close();
      const encryptedFile = await fileHandle.getFile();
      return encryptedFile;
    } catch (e) {
      console.warn("OPFS encryption failed, falling back to RAM", e);
    }
  }

  // Fallback to RAM (Warning: OOM risk on large files)
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const buffer = await file.arrayBuffer();
  
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: ALGO,
      iv: iv,
    },
    key,
    buffer
  );

  const finalBuffer = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  finalBuffer.set(iv, 0);
  finalBuffer.set(new Uint8Array(encryptedBuffer), iv.length);

  return new Blob([finalBuffer], { type: 'application/octet-stream' });
}

// Keep this around if any part expects stream
export async function encryptStream(file: File | Blob, key: CryptoKey): Promise<{ stream: ReadableStream, size: number }> {
  const encryptedBlob = await encryptFile(file, key);
  return { stream: encryptedBlob.stream(), size: encryptedBlob.size };
}

export async function decryptBuffer(encryptedBuffer: ArrayBuffer, key: CryptoKey, originalType: string): Promise<Blob> {
  const bytes = new Uint8Array(encryptedBuffer);
  
  // Check for MAGIC_HEADER (CHUNKED_V1)
  const headerText = new TextDecoder().decode(bytes.slice(0, 10));
  if (headerText === 'CHUNKED_V1') {
    const masterIv = bytes.slice(10, 22);
    let offset = 22;
    let chunkIndex = 0;
    const decryptedChunks: Uint8Array[] = [];
    
    // Auth tag adds 16 bytes per chunk
    const ENCRYPTED_CHUNK_SIZE = CHUNK_SIZE + 16;
    
    while (offset < bytes.length) {
      const chunk = bytes.slice(offset, offset + ENCRYPTED_CHUNK_SIZE);
      
      const chunkIv = new Uint8Array(12);
      for (let i = 0; i < 12; i++) {
        chunkIv[i] = masterIv[i] ^ ((chunkIndex >> (i * 8)) & 0xff);
      }
      
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: ALGO, iv: chunkIv },
        key,
        chunk
      );
      
      decryptedChunks.push(new Uint8Array(decryptedBuffer));
      offset += ENCRYPTED_CHUNK_SIZE;
      chunkIndex++;
    }
    
    return new Blob(decryptedChunks as any[], { type: originalType });
  }

  // Legacy Non-Chunked Format
  const iv = bytes.slice(0, 12);
  const data = bytes.slice(12);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: ALGO,
      iv: iv,
    },
    key,
    data
  );

  return new Blob([decryptedBuffer], { type: originalType });
}

export async function decryptResponseToBlob(response: Response, key: CryptoKey, originalType: string): Promise<Blob> {
  const isOPFS = !!(navigator.storage && navigator.storage.getDirectory);
  
  if (isOPFS && response.body) {
    try {
      const root = await navigator.storage.getDirectory();
      const filename = `dec_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const fileHandle = await root.getFileHandle(filename, { create: true });
      const writable = await (fileHandle as any).createWritable();
      
      const reader = response.body.getReader();
      
      // Read header (10 bytes) + master IV (12 bytes) = 22 bytes
      let isChunked = false;
      let masterIv = new Uint8Array(12);
      let isHeaderParsed = false;
      
      let chunkIndex = 0;
      let pendingBuffer = new Uint8Array(0);
      const ENCRYPTED_CHUNK_SIZE = CHUNK_SIZE + 16;
      
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        
        if (value) {
          const merged = new Uint8Array(pendingBuffer.length + value.length);
          merged.set(pendingBuffer);
          merged.set(value, pendingBuffer.length);
          pendingBuffer = merged;
        }
        
        if (!isHeaderParsed && pendingBuffer.length >= 22) {
          const headerText = new TextDecoder().decode(pendingBuffer.slice(0, 10));
          if (headerText === 'CHUNKED_V1') {
            isChunked = true;
            masterIv = pendingBuffer.slice(10, 22);
            pendingBuffer = pendingBuffer.slice(22); // Consume header
          }
          isHeaderParsed = true;
        }
        
        if (isHeaderParsed) {
          if (!isChunked) {
             // Abort OPFS streaming if it's a legacy file (easier to just dump to RAM)
             break;
          }
          
          while (pendingBuffer.length >= ENCRYPTED_CHUNK_SIZE || (done && pendingBuffer.length > 0)) {
             const bytesToRead = done ? pendingBuffer.length : ENCRYPTED_CHUNK_SIZE;
             const chunk = pendingBuffer.slice(0, bytesToRead);
             
             const chunkIv = new Uint8Array(12);
             for (let i = 0; i < 12; i++) {
               chunkIv[i] = masterIv[i] ^ ((chunkIndex >> (i * 8)) & 0xff);
             }
             
             const decryptedBuffer = await window.crypto.subtle.decrypt(
               { name: ALGO, iv: chunkIv },
               key,
               chunk
             );
             
             await writable.write(decryptedBuffer);
             
             pendingBuffer = pendingBuffer.slice(bytesToRead);
             chunkIndex++;
          }
        }
        
        if (done) break;
      }
      
      if (isChunked) {
        await writable.close();
        const decryptedFile = await fileHandle.getFile();
        // Spoof type
        return new File([decryptedFile], 'decrypted', { type: originalType });
      } else {
        // Cleanup OPFS file and fallback to RAM
        await writable.close();
        await root.removeEntry(filename);
      }
      
    } catch (e) {
      console.warn("OPFS decryption failed, falling back to RAM", e);
    }
  }

  // Fallback to memory
  const encryptedBuffer = await response.arrayBuffer();
  return decryptBuffer(encryptedBuffer, key, originalType);
}

// Generates a hash to verify the password later without storing the password
export async function hashPasswordForVerification(password: string, saltHex: string): Promise<string> {
  const key = await deriveKeyFromPassword(password, saltHex);
  const rawKey = await window.crypto.subtle.exportKey('raw', key);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', rawKey);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Binary-safe base64 encoding ─────────────────────────────────────────────
// The built-in btoa() breaks on non-Latin1 characters. These helpers
// work with raw Uint8Arrays and are safe for any binary payload.

function uint8ToBase64(bytes: Uint8Array): string {
  // Use chunks to avoid stack overflow on large arrays
  const CHUNK_SIZE = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function encryptString(text: string, key: CryptoKey): Promise<string> {
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const buffer = enc.encode(text);
  
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: ALGO, iv: iv },
    key,
    buffer
  );

  const finalBuffer = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  finalBuffer.set(iv, 0);
  finalBuffer.set(new Uint8Array(encryptedBuffer), iv.length);

  return uint8ToBase64(finalBuffer);
}

export async function decryptString(encryptedBase64: string, key: CryptoKey): Promise<string> {
  const bytes = base64ToUint8(encryptedBase64);

  const iv = bytes.slice(0, 12);
  const data = bytes.slice(12);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: ALGO, iv: iv },
    key,
    data
  );

  const dec = new TextDecoder();
  return dec.decode(decryptedBuffer);
}
