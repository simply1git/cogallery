import { useEffect, useState } from 'react'
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

  useEffect(() => {
    let uppyInstance: Uppy | null = null;
    let isMounted = true;

    const initUppy = async () => {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
      const tusEndpoint = `${backendUrl}/upload/tus`
      
      if (!isMounted) return;

      uppyInstance = new Uppy({
        id: 'cogallery-uploader',
        autoProceed: false,
        restrictions: {
          maxFileSize: null, // Unlimited!
        }
      }).use(Tus, {
        endpoint: tusEndpoint,
        headers: {
          Authorization: `Bearer ${token}`
        },
        chunkSize: 5 * 1024 * 1024,
        limit: 3,
      })
      
      // Pre-processor to handle WebAssembly compression and Stream Encryption BEFORE upload starts
      uppyInstance.addPreProcessor(async (fileIDs: string[]) => {
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
              if (generatedThumb) thumbBase64 = generatedThumb;
            } catch (err) {
              console.error('Thumbnail generation failed:', err);
            }
            
            // PHASE 3: Streaming Encryption
            const { currentRoom, vaultKeys } = useRoomStore.getState()
            const isVault = currentRoom?.isVault
            const vaultKey = vaultKeys[roomId]

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
               payloadToUpload = new Blob(chunks as any[], { type: 'application/octet-stream' });
               
               // Update Uppy file with encrypted payload
               uppyInstance!.setFileState(fileID, {
                 data: payloadToUpload,
                 size: payloadToUpload.size,
               });
               
               // Encrypt the thumbnail using the Vault Key
               if (thumbBase64.length > 50) {
                 try {
                   thumbBase64 = await encryptString(thumbBase64, vaultKey);
                 } catch (e) {
                   console.error('Thumbnail encryption failed:', e);
                 }
               }
            }
            
            // We no longer insert to DB here. We generate an ID and pass it along.
            const photoId = crypto.randomUUID()
            
            // Pass metadata to TUS and for the success handler
            uppyInstance!.setFileMeta(fileID, { 
              photoId: photoId,
              filename: file.name,
              filetype: file.type || 'application/octet-stream',
              mediaType: mediaType,
              thumbBase64: thumbBase64,
              isEncrypted: isVault || false
            })
          }))
        }
      })

      // Finish hook to update the final URL in the database
      uppyInstance.on('upload-success', async (file: any) => {
        if (!file) return;
        
        // Wait 1.5 seconds to allow the backend TUS server POST_FINISH 
        // handler to complete the fs.rename of the uploaded file.
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const { photoId, filename, mediaType, thumbBase64, isEncrypted } = file.meta;
        const finalUrl = `${tusEndpoint.replace('/upload/tus', '')}/stream/${photoId}`;
        
        const { data: finalPhoto, error } = await supabase.from('photos').insert({
          id: photoId,
          event_id: eventId,
          room_id: roomId,
          uploader_id: userId,
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

        if (finalPhoto && onUploadSuccess) {
          onUploadSuccess(finalPhoto as any);
        }
      })

      setUppy(uppyInstance)
    }
    
    initUppy()
    
    return () => {
      isMounted = false;
      if (uppyInstance) uppyInstance.destroy()
    }
  }, [eventId, roomId, userId])

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
