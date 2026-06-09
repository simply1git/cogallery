import { useState, useCallback, useEffect } from 'react'
import { Tldraw, Editor, createShapeId } from 'tldraw'
import 'tldraw/tldraw.css'
import { useCanvasSync } from '@/hooks/useCanvasSync'
import type { Photo } from '@/types'
import { ImagePlus } from 'lucide-react'
import { toast } from 'sonner'
import { GalleryPhotoShapeUtil } from './GalleryPhotoShape'
import { useCanvasStore } from '@/store/canvasStore'
import { useDecryptedMediaUrl } from '@/hooks/useDecryptedMediaUrl'
import { useRoomStore } from '@/store/roomStore'

interface MoodboardCanvasProps {
  eventId: string
  userId: string
  photos: Photo[]
}

const customShapeUtils = [GalleryPhotoShapeUtil]

export function MoodboardCanvas({ eventId, userId, photos }: MoodboardCanvasProps) {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [showPhotoDrawer, setShowPhotoDrawer] = useState(false)
  
  const setStorePhotos = useCanvasStore((s) => s.setPhotos)

  // Sync photos to store so shapes can render them
  useEffect(() => {
    setStorePhotos(photos)
  }, [photos, setStorePhotos])

  // Sync canvas state across users
  useCanvasSync({ eventId, userId, editor })

  const handleMount = useCallback((editorInstance: Editor) => {
    setEditor(editorInstance)
  }, [])

  // Add a photo from the gallery onto the canvas using our custom shape
  const addPhotoToCanvas = useCallback((photo: Photo) => {
    if (!editor) return

    try {
      const shapeId = createShapeId()
      const camera = editor.getCamera()
      const viewportCenter = editor.getViewportScreenCenter()

      // Place the image near the center of the current viewport
      const x = (viewportCenter.x - camera.x) / camera.z - 150
      const y = (viewportCenter.y - camera.y) / camera.z - 150

      // Create the custom gallery photo shape (zero base64 footprint!)
      editor.createShape({
        id: shapeId,
        type: 'gallery-photo',
        x,
        y,
        props: {
          photoId: photo.id,
          w: 300,
          h: 300,
        },
      } as any)

      toast.success(`Added "${photo.filename}" to canvas`)
      setShowPhotoDrawer(false)
    } catch (err) {
      console.error('Failed to add photo to canvas:', err)
      toast.error('Failed to add photo')
    }
  }, [editor])

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-white/[0.08] bg-[#0a0a0a]" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
      {/* tldraw Canvas */}
      <Tldraw
        onMount={handleMount}
        forceMobile={false}
        shapeUtils={customShapeUtils}
      />

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
