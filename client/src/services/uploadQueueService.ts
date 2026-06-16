import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { uploadPhotoWithMetadata } from './photoService';
import { toast } from 'sonner';
import { scrubExif } from '../utils/exifScrubber';
import { encryptFile } from './cryptoService';

export interface UploadItem {
  id: string; // unique internal id
  file: File;
  eventId: string;
  roomId: string;
  userId: string;
  status: 'queued' | 'uploading' | 'error' | 'done';
  progress: number;
  error?: string;
  addedAt: number;
  isEncrypted?: boolean;
  /** Number of retry attempts so far */
  retryCount?: number;
  /** Content hash for deduplication */
  contentHash?: string;
}

interface CoGalleryDB extends DBSchema {
  uploads: {
    key: string;
    value: UploadItem;
    indexes: { 'by-status': string };
  };
}

const MAX_CONCURRENT = 3; // Prevent mobile network congestion
const MAX_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 1000; // 1s → 2s → 4s → 8s → 16s

let dbPromise: Promise<IDBPDatabase<CoGalleryDB>> | null = null;
let isProcessing = false;
const activeAbortControllers = new Map<string, AbortController>();

type Listener = (items: UploadItem[]) => void;
const listeners = new Set<Listener>();

let memoryItems: UploadItem[] = []; // In-memory cache for UI reactivity

// ─── Content Hash for Deduplication ──────────────────────────────────────────

async function computeFileHash(file: File | Blob): Promise<string> {
  // For large files, hash only the first 1MB + last 1MB + size for speed
  const HASH_CHUNK = 1024 * 1024; // 1MB
  let buffer: ArrayBuffer;

  if (file.size <= HASH_CHUNK * 2) {
    buffer = await file.arrayBuffer();
  } else {
    const first = await file.slice(0, HASH_CHUNK).arrayBuffer();
    const last = await file.slice(-HASH_CHUNK).arrayBuffer();
    const sizeBytes = new TextEncoder().encode(file.size.toString());
    const combined = new Uint8Array(first.byteLength + last.byteLength + sizeBytes.byteLength);
    combined.set(new Uint8Array(first), 0);
    combined.set(new Uint8Array(last), first.byteLength);
    combined.set(sizeBytes, first.byteLength + last.byteLength);
    buffer = combined.buffer;
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const uploadQueueService = {
  async init() {
    if (!dbPromise) {
      dbPromise = openDB<CoGalleryDB>('cogallery-uploads', 1, {
        upgrade(db) {
          const store = db.createObjectStore('uploads', { keyPath: 'id' });
          store.createIndex('by-status', 'status');
        },
      });
    }

    const db = await dbPromise;
    memoryItems = await db.getAll('uploads');
    this.notify();

    // If the app was closed mid-upload, revert 'uploading' back to 'queued'
    for (const item of memoryItems) {
      if (item.status === 'uploading') {
        item.status = 'queued';
        item.progress = 0;
        await db.put('uploads', item);
      }
    }
    this.notify();

    // Auto-resume if online, and listen for reconnections
    window.addEventListener('online', () => {
      toast.success('Back online! Resuming uploads...');
      this.processQueue();
    });
    
    window.addEventListener('offline', () => {
      // Cancel all active uploads gracefully
      activeAbortControllers.forEach((controller) => controller.abort());
      activeAbortControllers.clear();
      toast.error('Offline. Uploads paused safely in the background.');
    });

    if (navigator.onLine) {
      this.processQueue();
    }
  },

  notify() {
    listeners.forEach(l => l([...memoryItems]));
  },

  subscribe(listener: Listener) {
    listener([...memoryItems]);
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async addFiles(
    files: File[], 
    metadata: { eventId: string; roomId: string; userId: string },
    isVault?: boolean,
    vaultKey?: CryptoKey
  ) {
    const db = await dbPromise;
    if (!db) return;

    for (const file of files) {
      // Zero-Knowledge Privacy: Scrub EXIF GPS data before it even enters the queue
      const cleanFile = await scrubExif(file);
      
      // Deduplication: compute content hash and check for existing uploads
      const contentHash = await computeFileHash(cleanFile);
      const isDuplicate = memoryItems.some(
        existing => existing.contentHash === contentHash && 
                    existing.eventId === metadata.eventId &&
                    (existing.status === 'queued' || existing.status === 'uploading' || existing.status === 'done')
      );
      if (isDuplicate) {
        toast.info(`Skipped duplicate: ${file.name}`);
        continue;
      }

      // If Vault, encrypt the file payload immediately before putting in IndexedDB
      let payloadToStore: File | Blob = cleanFile;
      if (isVault) {
        if (!vaultKey) {
          toast.error('Vault key missing. Cannot upload.');
          continue;
        }
        payloadToStore = await encryptFile(cleanFile, vaultKey);
      }
      
      const item: UploadItem = {
        id: crypto.randomUUID(),
        file: payloadToStore as File, // we typecast to File for interface compatibility
        eventId: metadata.eventId,
        roomId: metadata.roomId,
        userId: metadata.userId,
        status: 'queued',
        progress: 0,
        addedAt: Date.now(),
        isEncrypted: isVault,
        retryCount: 0,
        contentHash,
      };
      await db.put('uploads', item);
      memoryItems.push(item);
    }
    this.notify();
    this.processQueue();
  },

  async updateItem(id: string, patch: Partial<UploadItem>) {
    const db = await dbPromise;
    if (!db) return;

    const index = memoryItems.findIndex(i => i.id === id);
    if (index === -1) return;
    
    memoryItems[index] = { ...memoryItems[index], ...patch };
    await db.put('uploads', memoryItems[index]);
    this.notify();
  },

  async removeItem(id: string) {
    const db = await dbPromise;
    if (!db) return;

    // Cancel active upload if running
    const controller = activeAbortControllers.get(id);
    if (controller) {
      controller.abort();
      activeAbortControllers.delete(id);
    }

    await db.delete('uploads', id);
    memoryItems = memoryItems.filter(i => i.id !== id);
    this.notify();
  },

  async processQueue() {
    if (isProcessing) return; // Workers are already running
    if (!navigator.onLine) return; // Wait for internet

    isProcessing = true;
    let activeWorkers = 0;

    const worker = async () => {
      activeWorkers++;
      try {
        while (navigator.onLine) {
          // Find next queued item
          const itemIndex = memoryItems.findIndex(i => i.status === 'queued');
          if (itemIndex === -1) break; // Queue empty
          
          const item = memoryItems[itemIndex];
          
          // Eagerly mark to prevent other workers from grabbing it
          item.status = 'uploading';
          await this.updateItem(item.id, { status: 'uploading', progress: 0 });

          // Create AbortController for this upload
          const abortController = new AbortController();
          activeAbortControllers.set(item.id, abortController);

          try {
            const { error } = await uploadPhotoWithMetadata({
              file: item.file,
              eventId: item.eventId,
              roomId: item.roomId,
              userId: item.userId,
              isEncrypted: item.isEncrypted,
              signal: abortController.signal,
              onProgress: (progress) => {
                // Update memory instantly for UI, avoid spamming IndexedDB disk writes for every % tick
                const memItem = memoryItems.find(i => i.id === item.id);
                if (memItem) {
                  memItem.progress = progress;
                  this.notify();
                }
              }
            });

            if (error) throw new Error(error);

            activeAbortControllers.delete(item.id);
            await this.updateItem(item.id, { status: 'done', progress: 100 });
            
            // Remove from queue 3 seconds after completion
            setTimeout(() => this.removeItem(item.id), 3000);
            
            if (navigator.vibrate) navigator.vibrate(50);
            toast.success(`Uploaded: ${item.file.name}`);

          } catch (err: any) {
            activeAbortControllers.delete(item.id);

            if (!navigator.onLine) {
              // Internet dropped mid-upload, requeue for later
              await this.updateItem(item.id, { status: 'queued', progress: 0 });
              break; 
            } else if (err.message === 'Upload cancelled') {
              // User-initiated cancellation — remove from queue
              await this.removeItem(item.id);
            } else {
              // Actual failure — apply exponential backoff retry
              const currentRetries = item.retryCount || 0;
              if (currentRetries < MAX_RETRIES) {
                const delay = BASE_RETRY_DELAY_MS * Math.pow(2, currentRetries);
                console.warn(`[UploadQueue] Retry ${currentRetries + 1}/${MAX_RETRIES} for ${item.file.name} in ${delay}ms`);
                await this.updateItem(item.id, { 
                  status: 'queued', 
                  progress: 0, 
                  retryCount: currentRetries + 1,
                  error: err.message || 'Upload failed'
                });
                // Wait before retrying
                await new Promise(res => setTimeout(res, delay));
              } else {
                // Max retries exhausted
                await this.updateItem(item.id, { 
                  status: 'error', 
                  error: `Failed after ${MAX_RETRIES} attempts: ${err.message || 'Upload failed'}` 
                });
                toast.error(`Failed: ${item.file.name}`);
              }
            }
          }
        }
      } finally {
        activeWorkers--;
        if (activeWorkers === 0) {
          isProcessing = false;
        }
      }
    };

    // Spin up concurrent workers with proper error handling
    const workerPromises = Array.from({ length: MAX_CONCURRENT }, () => 
      worker().catch(err => {
        console.error('[UploadQueue] Worker crashed:', err);
      })
    );

    // Don't await — let them run in background
    Promise.allSettled(workerPromises).then(() => {
      isProcessing = false;
    });
  },

  retryItem(id: string) {
    this.updateItem(id, { status: 'queued', error: undefined, progress: 0, retryCount: 0 }).then(() => {
      this.processQueue();
    });
  },

  cancelItem(id: string) {
    const controller = activeAbortControllers.get(id);
    if (controller) {
      controller.abort();
      activeAbortControllers.delete(id);
    }
    this.removeItem(id);
  },

  clearCompleted() {
    const completed = memoryItems.filter(i => i.status === 'done');
    completed.forEach(item => this.removeItem(item.id));
  },

  async cancelAll() {
    // Abort all active uploads
    activeAbortControllers.forEach((controller) => controller.abort());
    activeAbortControllers.clear();

    const db = await dbPromise;
    if (!db) return;
    
    // Clear everything from the db
    await db.clear('uploads');
    memoryItems = [];
    this.notify();
  }
};
