import { useState, useCallback, useEffect } from 'react'
import { Tldraw, Editor, AssetRecordType, TLAssetStore } from 'tldraw'
import 'tldraw/tldraw.css'
import { useYjsStore } from '@/hooks/useYjsStore'
import type { Photo } from '@/types'
import { ImagePlus } from 'lucide-react'
import { toast } from 'sonner'
import { useCanvasStore } from '@/store/canvasStore'
import { useDecryptedMediaUrl } from '@/hooks/useDecryptedMediaUrl'
import { Loader2 } from 'lucide-react'
import { useRoomStore } from '@/store/roomStore'
import { getSecureMediaUrl } from '@/services/photoService'
import { decryptBuffer } from '@/services/cryptoService'

interface MoodboardCanvasProps {
  eventId: string
  userId: string
  photos: Photo[]
}

const customAssetStore: TLAssetStore = {
  async upload(_asset: any, _file: File) {
    toast.error('Please upload photos using the Gallery interface first.')
    throw new Error('Direct upload to canvas is disabled.')
  },
  async resolve(asset: any, _ctx: any) {
    const src = asset.props.src
    if (!src || !src.startsWith('encrypted-photo://')) {
      return src
    }
    
    const photoId = src.replace('encrypted-photo://', '')
    const photo = useCanvasStore.getState().photos.find((p) => p.id === photoId)
    if (!photo) return null
    
    const vaultKey = useRoomStore.getState().vaultKeys[photo.roomId]
    
    try {
      // 1. Unencrypted handling
      if (!photo.isEncrypted) {
        return await getSecureMediaUrl(photo.s3Key || photo.filename)
      }

      // 2. Encrypted handling
      if (!vaultKey) return null

      const secureUrl = await getSecureMediaUrl(photo.s3Key || photo.filename)
      const response = await fetch(secureUrl)
      if (!response.ok) throw new Error('Failed to fetch')
      
      const encryptedBuffer = await response.arrayBuffer()
      const mimeType = photo.mediaType === 'video' ? 'video/mp4' : 'image/jpeg'
      const decryptedBlob = await decryptBuffer(encryptedBuffer, vaultKey, mimeType)
      
      return URL.createObjectURL(decryptedBlob)
    } catch (e) {
      console.error('Asset resolve error:', e)
      return null
    }
  }
}
export function MoodboardCanvas({ eventId, userId, photos }: MoodboardCanvasProps) {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [showPhotoDrawer, setShowPhotoDrawer] = useState(false)
  
  const setStorePhotos = useCanvasStore((s) => s.setPhotos)

  // Sync photos to store so shapes can render them
  useEffect(() => {
    setStorePhotos(photos)
  }, [photos, setStorePhotos])

  // Sync canvas state and presence across users
  const storeWithStatus = useYjsStore({ eventId, userId, assets: customAssetStore })

  const handleMount = useCallback((editorInstance: Editor) => {
    setEditor(editorInstance)
  }, [])

  // Add a photo from the gallery onto the canvas using our custom shape
  const addPhotoToCanvas = useCallback((photo: Photo) => {
    if (!editor) return

    try {
      const assetId = AssetRecordType.createId()

      // 1. Create the asset in the store first
      editor.createAssets([
        {
          id: assetId,
          type: 'image',
          typeName: 'asset',
          props: {
            w: 300,
            h: 300,
            name: photo.filename,
            isAnimated: false,
            mimeType: 'image/jpeg',
            src: `encrypted-photo://${photo.id}`
          },
          meta: {}
        }
      ])

      // 2. Create the shape referencing the asset
      editor.createShape({
        type: 'image',
        x: editor.getViewportPageBounds().center.x - 150,
        y: editor.getViewportPageBounds().center.y - 150,
        props: {
          w: 300,
          h: 300,
          assetId,
        },
      })
      toast.success('Photo added to canvas')
    } catch (error) {
      toast.error('Failed to add photo')
      console.error(error)
    }
  }, [editor])

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-white/[0.08] bg-[#0a0a0a]" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
      {/* tldraw Canvas */}
      {storeWithStatus.status === 'loading' ? (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
        </div>
      ) : storeWithStatus.status === 'error' ? (
        <div className="w-full h-full flex items-center justify-center text-red-500">
          <p className="text-sm">Failed to load canvas data</p>
        </div>
      ) : (
        <Tldraw
          store={storeWithStatus.store}
          onMount={handleMount}
          forceMobile={false}
        />
      )}

      {/* Floating toolbar */}
      <div className="absolute top-3 right-3 z-[500] flex items-center gap-2">
        <button
          onClick={() => setShowPhotoDrawer(!showPhotoDrawer)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#18181b]/90 backdrop-blur-xl border border-white/10 text-sm font-medium text-white hover:bg-[#27272a] transition-all shadow-xl"
        >
          <ImagePlus size={16} className="text-blue-400" />
          Add Photo
        </button>
      </div>

      {/* Photo drawer */}
      {showPhotoDrawer && (
        <div className="absolute top-14 right-3 z-[500] w-72 max-h-[60vh] overflow-y-auto rounded-xl bg-[#141414]/95 backdrop-blur-xl border border-white/10 shadow-2xl p-3">
          <h3 className="text-sm font-semibold text-white mb-3 px-1">Gallery Photos</h3>
          {photos.length === 0 ? (
            <p className="text-xs text-[#71717a] px-1">No photos in this event yet. Upload some first!</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <CanvasDrawerItem 
                  key={photo.id} 
                  photo={photo} 
                  onClick={() => addPhotoToCanvas(photo)} 
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CanvasDrawerItem({ photo, onClick }: { photo: Photo, onClick: () => void }) {
  const vaultKey = useRoomStore((s) => s.vaultKeys[photo.roomId])
  const { url: thumbUrl } = useDecryptedMediaUrl(photo, vaultKey, false)

  return (
    <button
      onClick={onClick}
      className="relative aspect-square rounded-lg overflow-hidden bg-[#0f0f0f] border border-white/[0.06] hover:border-blue-500/40 transition-all group cursor-pointer"
    >
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt={photo.filename}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[#52525b]">
          <ImagePlus size={16} />
        </div>
      )}
      <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/20 transition-colors flex items-center justify-center">
        <ImagePlus size={14} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  )
}
