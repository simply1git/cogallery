import { useEffect, useState, useRef } from 'react'
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
import type { Photo } from '@/types'

interface UploadZoneProps {
  eventId: string
  roomId: string
  userId: string
  onUploadSuccess?: (photo: Photo) => void
}

export function UploadZone({ eventId, roomId, userId, onUploadSuccess }: UploadZoneProps) {
  const [uppy, setUppy] = useState<Uppy | null>(null)

  const propsRef = useRef({ eventId, roomId, userId, onUploadSuccess })
  
  useEffect(() => {
    propsRef.current = { eventId, roomId, userId, onUploadSuccess }
  }, [eventId, roomId, userId, onUploadSuccess])

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
              type: payloadToUpload.type || file.type,
            });
            
            const updatedFile = uppyInstance!.getFile(fileID);
            
            // We no longer insert to DB here. We generate an ID and pass it along.
            const photoId = crypto.randomUUID()
            localThumbMap.set(photoId, thumbBase64);
            
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

      // Finish hook to update the final URL in the database
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
    }
    
    initUppy()
    
    return () => {
      isMounted = false;
      if (uppyInstance) uppyInstance.destroy()
    }
  }, []) // Empty dependency array ensures Uppy initializes exactly once

  if (!uppy) return <div className="p-10 text-center text-zinc-500">Initializing Premium Uploader...</div>;

  return (
    <div className="uppy-dashboard-container rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl">
      <Dashboard 
        uppy={uppy} 
        theme="dark" 
        width="100%" 
        height={350}
        proudlyDisplayPoweredByUppy={false}
        note="Unlimited file size. Resumable uploads."
      />
    </div>
  )
}
