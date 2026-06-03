import { useState, useEffect } from 'react';
import { uploadQueueService, type UploadItem } from '@/services/uploadQueueService';

export function useUploadQueue() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  useEffect(() => {
    const unsubscribe = uploadQueueService.subscribe((items) => {
      setUploads(items);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    uploads,
    retryItem: uploadQueueService.retryItem.bind(uploadQueueService),
    removeItem: uploadQueueService.removeItem.bind(uploadQueueService),
    clearCompleted: uploadQueueService.clearCompleted.bind(uploadQueueService),
  };
}
