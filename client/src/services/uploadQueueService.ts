import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { uploadPhotoWithMetadata } from './photoService';
import { toast } from 'sonner';
import { scrubExif } from '../utils/exifScrubber';

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
}

interface CoGalleryDB extends DBSchema {
  uploads: {
    key: string;
    value: UploadItem;
    indexes: { 'by-status': string };
  };
}

let dbPromise: Promise<IDBPDatabase<CoGalleryDB>> | null = null;
let isProcessing = false;
const MAX_CONCURRENT = 3; // Prevent mobile network congestion

type Listener = (items: UploadItem[]) => void;
const listeners = new Set<Listener>();

let memoryItems: UploadItem[] = []; // In-memory cache for UI reactivity

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

  async addFiles(files: File[], metadata: { eventId: string; roomId: string; userId: string }) {
    const db = await dbPromise;
    if (!db) return;

    for (const file of files) {
      // Zero-Knowledge Privacy: Scrub EXIF GPS data before it even enters the queue
      const cleanFile = await scrubExif(file);
      
      const item: UploadItem = {
        id: crypto.randomUUID(),
        file: cleanFile,
        eventId: metadata.eventId,
        roomId: metadata.roomId,
        userId: metadata.userId,
        status: 'queued',
        progress: 0,
        addedAt: Date.now(),
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

          try {
            const { error } = await uploadPhotoWithMetadata({
              file: item.file,
              eventId: item.eventId,
              roomId: item.roomId,
              userId: item.userId,
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

            await this.updateItem(item.id, { status: 'done', progress: 100 });
            
            // Remove from queue 3 seconds after completion
            setTimeout(() => this.removeItem(item.id), 3000);
            
            if (navigator.vibrate) navigator.vibrate(50);
            toast.success(`Uploaded: ${item.file.name}`);

          } catch (err: any) {
            if (!navigator.onLine) {
              // Internet dropped mid-upload, requeue for later
              await this.updateItem(item.id, { status: 'queued', progress: 0 });
              break; 
            } else {
              // Actual failure (e.g. server 500)
              await this.updateItem(item.id, { status: 'error', error: err.message || 'Upload failed' });
              toast.error(`Failed: ${item.file.name}`);
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

    // Spin up concurrent workers
    for (let i = 0; i < MAX_CONCURRENT; i++) {
      worker();
    }
  },

  retryItem(id: string) {
    this.updateItem(id, { status: 'queued', error: undefined, progress: 0 }).then(() => {
      this.processQueue();
    });
  },

  clearCompleted() {
    const completed = memoryItems.filter(i => i.status === 'done');
    completed.forEach(item => this.removeItem(item.id));
  },

  async cancelAll() {
    const db = await dbPromise;
    if (!db) return;
    
    // Clear everything from the db
    await db.clear('uploads');
    memoryItems = [];
    this.notify();
  }
};
