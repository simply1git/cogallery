import { useState, useCallback, useEffect } from 'react'
import type { Photo } from '@/types'
import { ImagePlus } from 'lucide-react'
import { toast } from 'sonner'
import { useCanvasStore } from '@/store/canvasStore'
import { useDecryptedMediaUrl } from '@/hooks/useDecryptedMediaUrl'
import { useRoomStore } from '@/store/roomStore'
import { InfiniteCanvas } from './InfiniteCanvas'
import { useMoodboardSync } from '@/hooks/useMoodboardSync'

interface MoodboardCanvasProps {
  eventId: string
  userId: string
  userName: string
  photos: Photo[]
  onPhotoDoubleClick?: (photo: Photo) => void
}

export function MoodboardCanvas({ eventId, userId, userName, photos, onPhotoDoubleClick }: MoodboardCanvasProps) {
  const [showPhotoDrawer, setShowPhotoDrawer] = useState(false)
  
  const setStorePhotos = useCanvasStore((s) => s.setPhotos)

  // Sync photos to store so shapes can render them
  useEffect(() => {
    setStorePhotos(photos)
  }, [photos, setStorePhotos])

  const { items, cursors, updateItem, deleteItem, updateCursor, isLoading } = useMoodboardSync(eventId, userId, userName)

  // Add a photo from the gallery onto the canvas
  const addPhotoToCanvas = useCallback((photo: Photo) => {
    try {
      const id = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // Place it in the center-ish area 
      // (a robust solution would project screen center using InfiniteCanvas state, but (0,0) is fine for now)
      updateItem({
        id,
        photoId: photo.id,
        x: Math.random() * 200,
        y: Math.random() * 200,
        w: 300,
        h: 300,
        zIndex: Object.keys(items).length + 1
      })

      toast.success(`Added "${photo.filename}" to canvas`)
      setShowPhotoDrawer(false)
    } catch (err) {
      console.error('Failed to add photo to canvas:', err)
      toast.error('Failed to add photo')
    }
  }, [updateItem, items])

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-white/[0.08] bg-[#0a0a0a]" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
      
      <InfiniteCanvas
        items={items}
        cursors={cursors}
        updateItem={updateItem}
        deleteItem={deleteItem}
        updateCursor={updateCursor}
        isLoading={isLoading}
        onPhotoDoubleClick={(photoId) => {
          const photo = photos.find(p => p.id === photoId)
          if (photo && onPhotoDoubleClick) {
            onPhotoDoubleClick(photo)
          }
        }}
      />

      {/* Floating toolbar */}
      <div className="absolute top-3 right-3 z-[500] flex items-center gap-2">
        <div className="flex bg-[#18181b]/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-xl mr-2">
          {['🔥', '❤️', '💯', '✨'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                updateItem({
                  id: `emoji-${Date.now()}`,
                  type: 'emoji',
                  text: emoji,
                  x: 150 + Math.random() * 200,
                  y: 150 + Math.random() * 200,
                  w: 100,
                  h: 100,
                  zIndex: Object.keys(items).length + 1
                })
              }}
              className="px-3 py-2 text-xl hover:bg-white/10 transition-colors"
              title={`Drop ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            updateItem({
              id: `sticky-${Date.now()}`,
              type: 'sticky',
              color: ['yellow', 'blue', 'pink', 'green'][Math.floor(Math.random() * 4)],
              text: '',
              x: 100 + Math.random() * 100,
              y: 100 + Math.random() * 100,
              w: 200,
              h: 200,
              zIndex: Object.keys(items).length + 1
            })
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#18181b]/90 backdrop-blur-xl border border-white/10 text-sm font-medium text-white hover:bg-[#27272a] transition-all shadow-xl"
        >
          📝 Add Note
        </button>
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
