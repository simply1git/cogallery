import { useState, useRef, useEffect } from 'react'
import { X, Crop as CropIcon, ImageIcon } from 'lucide-react'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { getCroppedImg } from '@/utils/cropImage'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface ImageCropperModalProps {
  isOpen: boolean
  imageUrl: string
  onClose: () => void
  onSave: (croppedBlob: Blob) => Promise<void>
}

export function ImageCropperModal({ isOpen, imageUrl, onClose, onSave }: ImageCropperModalProps) {
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [isSaving, setIsSaving] = useState(false)
  
  const imgRef = useRef<HTMLImageElement>(null)

  useEscapeKey(isOpen, onClose)

  useEffect(() => {
    // Reset state when new image opens
    setCrop(undefined)
    setCompletedCrop(undefined)
  }, [imageUrl, isOpen])

  if (!isOpen || !imageUrl) return null

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget

    // Set crop to select the entire image
    setCrop({
      unit: '%',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    })

    // Also set the pixel-based completedCrop so "Apply Crop" works immediately
    // without requiring the user to drag the handles first.
    // Use the displayed dimensions (not natural) because ReactCrop reports
    // pixel crops relative to the rendered <img> element.
    setCompletedCrop({
      unit: 'px',
      x: 0,
      y: 0,
      width: width,
      height: height,
    })
  }

  const handleSave = async () => {
    if (!completedCrop || !imgRef.current) return
    
    setIsSaving(true)
    try {
      const blob = await getCroppedImg(imgRef.current.src, completedCrop)
      if (blob) {
        await onSave(blob)
        onClose()
      }
    } catch (e) {
      console.error('Crop failed', e)
    } finally {
      setIsSaving(false)
    }
  }

  /** Use the original image as-is without any cropping */
  const handleUseOriginal = async () => {
    if (!imgRef.current) return
    setIsSaving(true)
    try {
      // Draw the full image onto a canvas to produce a blob.
      // This avoids fetch() which is blocked by CSP on cross-origin URLs.
      const img = imgRef.current
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not get canvas context')
      ctx.drawImage(img, 0, 0)
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.92)
      )
      if (blob) {
        await onSave(blob)
        onClose()
      }
    } catch (e) {
      console.error('Use original failed', e)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-[#18181b] border border-white/10 rounded-2xl p-4 sm:p-6 animate-scale-in flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h2 className="text-xl font-bold text-[#f4f4f5] flex items-center gap-2">
            <CropIcon size={20} />
            Crop Image
          </h2>
          <button onClick={onClose} className="btn-icon bg-white/5 hover:bg-white/10" disabled={isSaving}>
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center bg-black/40 rounded-xl border border-white/5 p-4">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            className="max-h-[60vh]"
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Crop preview"
              className="max-h-[60vh] w-auto object-contain"
              onLoad={onImageLoad}
              crossOrigin="anonymous"
            />
          </ReactCrop>
        </div>
        
        <p className="text-[#a1a1aa] text-sm mt-3 text-center flex-shrink-0">
          Drag the edges to crop, or use the full image as-is.
        </p>

        <div className="flex gap-3 pt-4 mt-2 border-t border-white/10 flex-shrink-0">
          <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button 
            onClick={handleUseOriginal}
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
            disabled={isSaving}
          >
            <ImageIcon size={16} />
            Use Original
          </button>
          <button 
            onClick={handleSave} 
            className="btn-blue flex-1"
            disabled={!completedCrop || isSaving}
          >
            {isSaving ? (
              <span className="flex items-center gap-2 justify-center">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
                Processing...
              </span>
            ) : (
              'Apply Crop'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
