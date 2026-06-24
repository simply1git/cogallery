import { useState, useRef, useEffect } from 'react'
import { X, Crop as CropIcon } from 'lucide-react'
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

  function onImageLoad() {
    // Select the entire image by default instead of a forced 16:9 aspect ratio
    setCrop({
      unit: '%',
      x: 0,
      y: 0,
      width: 100,
      height: 100
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
          Drag the edges to set a custom crop size.
        </p>

        <div className="flex gap-3 pt-4 mt-2 border-t border-white/10 flex-shrink-0">
          <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={isSaving}>
            Cancel
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
