import { ShapeUtil, HTMLContainer, RecordProps, T, TLBaseShape } from 'tldraw'
import { useCanvasStore } from '@/store/canvasStore'
import { useRoomStore } from '@/store/roomStore'
import { useDecryptedMediaUrl } from '@/hooks/useDecryptedMediaUrl'
import { Loader2, ImageOff } from 'lucide-react'

// Define the shape's interface
export type IGalleryPhotoShape = TLBaseShape<
  'gallery-photo',
  {
    w: number
    h: number
    photoId: string
  }
>

// Create a React component to render the shape
function GalleryPhotoComponent({ shape }: { shape: IGalleryPhotoShape }) {
  const photos = useCanvasStore((s) => s.photos)
  const photo = photos.find((p) => p.id === shape.props.photoId)

  const vaultKey = useRoomStore((s) => photo ? s.vaultKeys[photo.roomId] : undefined)

  // Use the existing secure decryption hook
  const { url, isDecrypting, error } = useDecryptedMediaUrl(photo as any, vaultKey, false)

  if (!photo) {
    return (
      <HTMLContainer className="w-full h-full flex items-center justify-center bg-zinc-900 border border-zinc-800 rounded-lg shadow-sm">
        <div className="flex flex-col items-center gap-2 text-zinc-500">
          <ImageOff size={24} />
          <span className="text-xs">Photo not found</span>
        </div>
      </HTMLContainer>
    )
  }

  return (
    <HTMLContainer
      id={shape.id}
      className="w-full h-full rounded-lg overflow-hidden border border-white/10 shadow-lg bg-black pointer-events-auto"
      style={{
        pointerEvents: 'all',
      }}
    >
      {isDecrypting && !url ? (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        </div>
      ) : error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          <span className="text-xs text-red-400 px-4 text-center">Failed to load</span>
        </div>
      ) : url ? (
        <img
          src={url}
          alt={photo.filename}
          className="w-full h-full object-cover pointer-events-none"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 bg-zinc-900" />
      )}
    </HTMLContainer>
  )
}

// Export the utility class to register with Tldraw
import { Rectangle2d } from 'tldraw'

// @ts-ignore
export class GalleryPhotoShapeUtil extends ShapeUtil<IGalleryPhotoShape> {
  static type = 'gallery-photo' as const
  
  static props: RecordProps<IGalleryPhotoShape> = {
    w: T.number,
    h: T.number,
    photoId: T.string,
  }

  getDefaultProps(): IGalleryPhotoShape['props'] {
    return {
      w: 300,
      h: 300,
      photoId: '',
    }
  }

  getGeometry(shape: IGalleryPhotoShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  getIndicatorPath(shape: any): any {
    return `M0,0 L${shape.props.w},0 L${shape.props.w},${shape.props.h} L0,${shape.props.h} Z`
  }

  component(shape: IGalleryPhotoShape) {
    return <GalleryPhotoComponent shape={shape} />
  }

  indicator(shape: IGalleryPhotoShape) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }
}


