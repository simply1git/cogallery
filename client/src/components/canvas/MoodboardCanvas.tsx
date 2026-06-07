import { useState, useCallback } from 'react'
import { Tldraw, Editor, createShapeId, AssetRecordType } from 'tldraw'
import 'tldraw/tldraw.css'
import { useCanvasSync } from '@/hooks/useCanvasSync'
import { getSecureMediaUrl } from '@/services/photoService'
import type { Photo } from '@/types'
import { ImagePlus, Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { saveCanvasState } from '@/services/canvasService'

interface MoodboardCanvasProps {
  eventId: string
  userId: string
  photos: Photo[]
}

export function MoodboardCanvas({ eventId, userId, photos }: MoodboardCanvasProps) {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showPhotoDrawer, setShowPhotoDrawer] = useState(false)

  // Sync canvas state across users
  useCanvasSync({ eventId, userId, editor })

  const handleMount = useCallback((editorInstance: Editor) => {
    setEditor(editorInstance)
  }, [])

  // Add a photo from the gallery onto the canvas
  const addPhotoToCanvas = useCallback(async (photo: Photo) => {
    if (!editor) return

    try {
      // Get a URL for the image
      let imageUrl = photo.thumbnailBase64
      if (!imageUrl && photo.s3Key) {
        imageUrl = await getSecureMediaUrl(photo.s3Key)
      }
      if (!imageUrl) {
        toast.error('Could not load image')
        return
      }

      // Create an asset for the image
      const assetId = AssetRecordType.createId()
      editor.createAssets([
        {
          id: assetId,
          type: 'image',
          typeName: 'asset',
          props: {
            name: photo.filename,
            src: imageUrl,
            w: 400,
            h: 300,
            mimeType: photo.mediaType === 'video' ? 'image/jpeg' : 'image/jpeg',
            isAnimated: false,
          },
          meta: { photoId: photo.id },
        },
      ])

      // Create the image shape on the canvas
      const shapeId = createShapeId()
      const camera = editor.getCamera()
      const viewportCenter = editor.getViewportScreenCenter()

      // Place the image near the center of the current viewport
      const x = (viewportCenter.x - camera.x) / camera.z - 200
      const y = (viewportCenter.y - camera.y) / camera.z - 150

      editor.createShape({
        id: shapeId,
        type: 'image',
        x,
        y,
        props: {
          assetId,
          w: 400,
          h: 300,
        },
      })

      toast.success(`Added "${photo.filename}" to canvas`)
      setShowPhotoDrawer(false)
    } catch (err) {
      console.error('Failed to add photo to canvas:', err)
      toast.error('Failed to add photo')
    }
  }, [editor])

  // Manual save
  const handleManualSave = useCallback(async () => {
    if (!editor) return
    setIsSaving(true)
    const allRecords = editor.store.allRecords()
    const persistable = allRecords.filter(
      (r: any) => r.typeName === 'shape' || r.typeName === 'page' || r.typeName === 'asset'
    )
    const { error } = await saveCanvasState(eventId, { records: persistable }, userId)
    if (error) {
      toast.error('Failed to save canvas')
    } else {
      toast.success('Canvas saved')
    }
    setIsSaving(false)
  }, [editor, eventId, userId])

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-white/[0.08] bg-[#0a0a0a]" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
      {/* tldraw Canvas */}
      <Tldraw
        onMount={handleMount}
        forceMobile={false}
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
        <button
          onClick={handleManualSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#18181b]/90 backdrop-blur-xl border border-white/10 text-sm font-medium text-white hover:bg-[#27272a] transition-all shadow-xl disabled:opacity-50"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} className="text-emerald-400" />}
          Save
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
                <button
                  key={photo.id}
                  onClick={() => addPhotoToCanvas(photo)}
                  className="relative aspect-square rounded-lg overflow-hidden bg-[#0f0f0f] border border-white/[0.06] hover:border-blue-500/40 transition-all group cursor-pointer"
                >
                  {photo.thumbnailBase64 ? (
                    <img
                      src={photo.thumbnailBase64}
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
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
