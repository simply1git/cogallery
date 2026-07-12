import { useEffect, useState, useRef, useCallback } from 'react'
import Uppy from '@uppy/core'
import Tus from '@uppy/tus'
import Dashboard from '@uppy/react/dashboard'
import '@uppy/core/css/style.min.css'
import '@uppy/dashboard/css/style.min.css'
import { supabase } from '@/lib/supabase'
import { getMediaType } from '@/services/uploadService'
import { encryptStream, encryptString } from '@/services/cryptoService'
import { generateThumbnail } from '@/services/thumbnailService'
import { useRoomStore } from '@/store/roomStore'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { uploadQueueService } from '@/services/uploadQueueService'
import type { UploadItem } from '@/services/uploadQueueService'
import type { Photo } from '@/types'

interface UploadZoneProps {
  eventId: string
  roomId: string
  userId: string
  onUploadSuccess?: (photo: Photo) => void
}

export function UploadZone({ eventId, roomId, userId, onUploadSuccess }: UploadZoneProps) {
  const [uppy, setUppy] = useState<Uppy | null>(null)
  const isOnline = useNetworkStatus()
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState<number>(0)
  const [queueItems, setQueueItems] = useState<UploadItem[]>([])
  const [isProcessingQueue, setIsProcessingQueue] = useState<boolean>(false)

  const propsRef = useRef({ eventId, roomId, userId, onUploadSuccess })
  const offlineCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const uppyInstanceRef = useRef<Uppy | null>(null)

  useEffect(() => {
    propsRef.current = { eventId, roomId, userId, onUploadSuccess }
  }, [eventId, roomId, userId, onUploadSuccess])

  // Subscribe to upload queue service to get updates
  useEffect(() => {
    const unsubscribe = uploadQueueService.subscribe((items) => {
      setQueueItems(items)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  // Check for online status to process queue
  useEffect(() => {
    if (isOnline) {
      // Clear any existing interval
      if (offlineCheckIntervalRef.current) {
        clearInterval(offlineCheckIntervalRef.current)
        offlineCheckIntervalRef.current = null
      }

      // Process queue when coming online
      processQueue()
    } else {
      // Set up interval to check for online status while offline
      if (!offlineCheckIntervalRef.current) {
        offlineCheckIntervalRef.current = setInterval(() => {
          if (navigator.onLine) {
            // This will trigger the useEffect above to process the queue
          }
        }, 5000) // Check every 5 seconds
      }
    }

    return () => {
      if (offlineCheckIntervalRef.current) {
        clearInterval(offlineCheckIntervalRef.current)
      }
    }
  }, [isOnline])

  const processQueue = useCallback(async () => {
    if (isProcessingQueue || !isOnline) return

    setIsProcessingQueue(true)
    try {
      // Process the queue using the upload queue service
      await uploadQueueService.processQueue()
    } catch (error) {
      console.error('Error processing upload queue:', error)
    } finally {
      setIsProcessingQueue(false)
    }
  }, [isProcessingQueue, isOnline])

  // Handle upload errors from uppy and add to queue for retry
  const handleUppyUploadError = useCallback((error: any) => {
    if (!isOnline) {
      // When offline, we'll rely on the upload queue service to persist
      setUploadError('You are offline. Files will upload automatically when you regain connection.')
    } else {
      // When online but upload failed, add to queue for retry
      const file = error.file?.data
      if (file) {
        // Add to upload queue service for retry
        uploadQueueService.addFiles([file], {
          eventId: propsRef.current.eventId,
          roomId: propsRef.current.roomId,
          userId: propsRef.current.userId
        }).then(() => {
          setUploadError('Upload failed. Will retry automatically.')
        })
      }
    }
  }, [isOnline])

  useEffect(() => {
    let uppyInstance: Uppy | null = null;
    let isMounted = true;

    const initUppy = async () => {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
      const tusEndpoint = `${backendUrl}/upload/tus`

      if (!isMounted) return;

      const localThumbMap = new Map<string, string>();

      uppyInstance = new Uppy({
        id: 'cogallery-uploader',
        autoProceed: false,
        restrictions: {
          maxFileSize: null, // Unlimited!
        }
      }).use(Tus, {
        endpoint: tusEndpoint,
        onBeforeRequest: async (req: any) => {
          const { data } = await supabase.auth.getSession();
          const currentToken = data.session?.access_token;
          if (currentToken) {
            req.setHeader('Authorization', `Bearer ${currentToken}`);
          }
        },
        chunkSize: 5 * 1024 * 1024,
        limit: 3,
        removeFingerprintOnSuccess: true,
        // Disable resume properly for tus-js-client v2
        // @ts-ignore
        urlStorage: {
          findAllUploads: async () => [],
          findUploadsByFingerprint: async () => [],
          removeUpload: async () => {},
          addUpload: async () => ''
        },
      })

      // Pre-processor to handle WebAssembly compression and Stream Encryption BEFORE upload starts
      uppyInstance.addPreProcessor(async (fileIDs: string[]) => {
        const { roomId: currentRoomId } = propsRef.current;
        const concurrencyLimit = 3;
        for (let i = 0; i < fileIDs.length; i += concurrencyLimit) {
          const batch = fileIDs.slice(i, i + concurrencyLimit);
          await Promise.all(batch.map(async (fileID: string) => {
            const file = uppyInstance!.getFile(fileID)
            let payloadToUpload: File | Blob = file.data as File;
            const mediaType = getMediaType(payloadToUpload as File) || 'image'

            // Generate a real thumbnail via Web Worker BEFORE encryption
            let thumbBase64 = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
            try {
              const generatedThumb = await generateThumbnail(payloadToUpload as File);
              if (generatedThumb) thumbBase64 = generatedThumb.base64;
            } catch (err) {
              console.error('Thumbnail generation failed:', err);
            }

            // PHASE 3: Streaming Encryption
            const { currentRoom, vaultKeys } = useRoomStore.getState()
            const isVault = currentRoom?.isVault
            const vaultKey = vaultKeys[currentRoomId]

            if (isVault) {
               if (!vaultKey) throw new Error('Vault key missing. Cannot encrypt.');
               const { stream } = await encryptStream(payloadToUpload, vaultKey);

               const reader = stream.getReader();
               const chunks: Uint8Array[] = [];
               for (;;) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  chunks.push(value);
               }
               // Keep the original name from compression step (if applicable) but change type to octet-stream
               const currentName = (payloadToUpload as File).name || file.name;
               payloadToUpload = new File(chunks as any[], currentName, { type: 'application/octet-stream' });

               // Encrypt the thumbnail using the Vault Key
               if (thumbBase64.length > 50) {
                 try {
                   thumbBase64 = await encryptString(thumbBase64, vaultKey);
                 } catch (e) {
                   console.error('Thumbnail encryption failed:', e);
                 }
               }
            }

            // ALWAYS update Uppy file state so compression/encryption changes are applied
            uppyInstance!.setFileState(fileID, {
              data: payloadToUpload,
              size: payloadToUpload.size,
              name: (payloadToUpload as File).name || file.name,
              type: (payloadToUpload as File).type || file.type,
            });

            const updatedFile = uppyInstance!.getFile(fileID);

            // We no longer insert to DB here. We generate an ID and pass it along.
            const photoId = crypto.randomUUID()
            localThumbMap.set(photoId, thumbBase64)

            // Pass metadata to TUS and for the success handler
            uppyInstance!.setFileMeta(fileID, {
              photoId: photoId,
              filename: updatedFile.name,
              filetype: updatedFile.type || 'application/octet-stream',
              mediaType: mediaType,
              isEncrypted: isVault || false
            })
          }))
        }
      })

      // Handle upload errors - add to queue for retry when offline
      uppyInstance.on('upload-error', (error: any) => {
        handleUppyUploadError(error)
      })

      // Handle upload success
      uppyInstance.on('upload-success', async (file: any) => {
        if (!file) return;
        const { eventId: currentEventId, roomId: currentRoomId, userId: currentUserId, onUploadSuccess: currentOnUploadSuccess } = propsRef.current;

        const { photoId, filename, mediaType, isEncrypted } = file.meta;
        const backendBase = tusEndpoint.replace('/upload/tus', '');

        // Wait for the backend TUS server POST_FINISH handler to complete the fs.rename
        // by polling the /upload/status endpoint instead of a fixed sleep.
        let isComplete = false;
        const { data } = await supabase.auth.getSession();
        const currentToken = data.session?.access_token;

        for (let i = 0; i < 20; i++) {
          try {
            const res = await fetch(`${backendBase}/upload/status/${photoId}`, {
              headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : {}
            });
            if (res.ok) {
              const status = await res.json();
              if (status.completed) {
                isComplete = true;
                break;
              }
            }
          } catch (e) {
            // Ignore fetch errors during polling
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (!isComplete) {
          console.warn(`[UploadZone] Backend processing for ${photoId} timed out or failed`);
        }
        const thumbBase64 = localThumbMap.get(photoId) || '';
        const finalUrl = `${tusEndpoint.replace('/upload/tus', '')}/stream/${photoId}`;

        const { data: finalPhoto, error } = await supabase.from('photos').insert({
          id: photoId,
          event_id: currentEventId,
          room_id: currentRoomId,
          uploader_id: currentUserId,
          filename: filename,
          media_type: mediaType,
          thumbnail_base64: thumbBase64,
          s3_url: finalUrl,
          s3_key: photoId,
          is_encrypted: isEncrypted,
        }).select('*').single()

        if (error) {
          console.error('Failed to insert final photo:', error)
          return
        }

        if (finalPhoto && currentOnUploadSuccess) {
          currentOnUploadSuccess(finalPhoto as any);
        }
      })

      setUppy(uppyInstance)
      uppyInstanceRef.current = uppyInstance
    }

    initUppy()

    return () => {
      isMounted = false;
      if (uppyInstance) uppyInstance.destroy()
    }
  }, [handleUppyUploadError])

  // Handle manual retry - retry all failed uploads from the queue
  const handleRetry = useCallback(async () => {
    setUploadError(null)
    setRetryCount(prev => Math.min(prev + 1, 3)) // Cap at 3 retries
    // Trigger queue processing
    await uploadQueueService.processQueue()
  }, [])

  // Retry failed uploads from the queue by re-adding them to uppy
  const retryFailedUploads = useCallback(async () => {
    const failedItems = queueItems.filter(item =>
      item.status === 'error' &&
      (item.retryCount ?? 0) < 5 // Match MAX_RETRIES from uploadQueueService
    )

    for (const item of failedItems) {
      if (uppyInstanceRef.current && item.file) {
        try {
          // Add the file back to uppy for retry
          await uppyInstanceRef.current.addFile(item.file)
          // Reset error status in queue (the upload will update it)
          await uploadQueueService.updateItem(item.id, {
            error: undefined,
            status: 'queued',
            retryCount: (item.retryCount ?? 0) + 1
          })
        } catch (err) {
          console.error('Failed to re-add file to uppy:', err)
        }
      }
    }
  }, [uppyInstanceRef.current, queueItems])

  // Retry failed uploads periodically
  useEffect(() => {
    if (isOnline && queueItems.some(item => item.status === 'error')) {
      retryFailedUploads()
    }
  }, [isOnline, queueItems, retryFailedUploads])

  if (!uppy) return <div className="p-10 text-center text-zinc-500">Initializing Premium Uploader...</div>;

  return (
    <div className="uppy-dashboard-container rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl relative">
      {/* Enhanced Connection Status Panel */}
      <div className={`absolute top-4 left-4 right-4 z-20 flex flex-col items-center gap-2 px-4 py-3 ${
        !isOnline ? 'bg-red-500/20 backdrop-blur-sm border border-red-500/30' : 'bg-green-500/20 backdrop-blur-sm border border-green-500/30'
      }`}>
        <div className="flex items-center gap-2 text-sm font-medium">
          {isOnline ? (
            <>
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <span>Online - Ready to Upload</span>
            </>
          ) : (
            <>
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <span>Offline - Queueing Uploads</span>
            </>
          )}
        </div>

        {!isOnline && (
          <div className="text-xs text-[--webkit-link] hover:text-white/80">
            {queueItems.filter(item => item.status === 'queued').length} files waiting to upload
          </div>
        )}

        {!isOnline && queueItems.some(item => item.status === 'queued') && (
          <button
            type="button"
            onClick={handleRetry}
            className="mt-2 px-3 py-1 text-xs bg-white/10 hover:bg-white/20 rounded hover:text-white"
          >
            Retry Now
          </button>
        )}
      </div>

      {/* Enhanced Upload Error or Status Message */}
      {uploadError && (
        <div className="absolute bottom-4 left-4 right-4 z-20 px-4 py-3 rounded-lg ${
          !isOnline ? 'bg-red-500/20 border border-red-500/30' : 'bg-yellow-500/20 border border-yellow-500/30'
        }">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              {!isOnline ? (
                <div className="w-4 h-4 bg-red-500/20 text-red-400 rounded">!</div>
              ) : (
                <div className="w-4 h-4 bg-yellow-500/20 text-yellow-400 rounded">!</div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium">{uploadError}</p>
              {!isOnline && (
                <div className="mt-2 text-xs text-[--webkit-link] hover:text-white/80">
                  Your uploads are safely queued and will resume when you're back online.
                </div>
              )}
            </div>
          </div>
          {!isOnline && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={handleRetry}
                className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 rounded hover:text-white"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      )}

      {/* Queue Status Panel */}
      {queueItems.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 z-20 px-4 py-3 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-white/[0.08]">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">Upload Queue:</span>
              <span className="text-xs text-[--webkit-link]">
                {queueItems.filter(i => i.status === 'queued').length} queued •
                {queueItems.filter(i => i.status === 'uploading').length} uploading •
                {queueItems.filter(i => i.status === 'error').length} failed
              </span>
            </div>
            <button
              onClick={handleRetry}
              className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 rounded hover:text-white"
            >
              Retry Failed
            </button>
          </div>

          {/* Queue Items List */}
          <div className="mt-2 max-h-[200px] overflow-y-auto">
            {queueItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-1 px-2 border-b last:border-b-0">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${item.status === 'queued' ? 'bg-yellow-500' : item.status === 'uploading' ? 'bg-blue-500' : item.status === 'done' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <div className="flex-1 text-sm truncate">
                    {item.file.name}
                  </div>
                  <div className="w-24 text-right text-xs">
                    {item.status === 'uploading'
                      ? `${item.progress}%`
                      : item.status === 'done'
                        ? 'Complete'
                        : item.status === 'error'
                          ? 'Failed'
                          : 'Queued'}
                  </div>
                </div>
                {item.status === 'uploading' && (
                  <div className="w-1/2 bg-gray-700 rounded h-1.5">
                    <div className="bg-blue-500 h-1.5 rounded" style={{ width: `${item.progress}%` }}></div>
                  </div>
                )}
                {item.status === 'error' && (
                  <button
                    type="button"
                    onClick={() => {
                        uploadQueueService.retryItem(item.id)
                        // Trigger retry via uppy if possible
                        if (uppyInstanceRef.current && item.file) {
                          try { uppyInstanceRef.current.addFile(item.file) } catch(e) { console.error(e) }
                        }
                      }
                    }
                    className="px-2 py-0.5 text-xs bg-red-500/20 hover:bg-red-500/30 rounded"
                  >
                    Retry
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Dashboard
        uppy={uppy}
        theme="dark"
        width="100%"
        height={350}
        proudlyDisplayPoweredByUppy={false}
        note="Unlimited file size. Resumable uploads. Automatic offline queuing."
      />
    </div>
  )
}