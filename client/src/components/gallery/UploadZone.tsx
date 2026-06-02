import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud, X, CheckCircle2, AlertCircle, Film, ImageIcon, Loader2 } from 'lucide-react'
import { uploadPhotoWithMetadata } from '@/services/photoService'
import { getMediaType, formatFileSize, ACCEPTED_MEDIA_TYPES } from '@/services/uploadService'
import type { Photo } from '@/types'
import { toast } from 'sonner'

interface UploadZoneProps {
  eventId: string
  roomId: string
  userId: string
  onUploadSuccess?: (photo: Photo) => void
}

interface FileUploadState {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
  mediaType: 'image' | 'video' | null
}

export function UploadZone({ eventId, roomId, userId, onUploadSuccess }: UploadZoneProps) {
  const [uploads, setUploads] = useState<FileUploadState[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const updateFile = (index: number, patch: Partial<FileUploadState>) => {
    setUploads((prev) => prev.map((u, i) => (i === index ? { ...u, ...patch } : u)))
  }

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (accepted.length === 0) return

      const newUploads: FileUploadState[] = accepted.map((file) => ({
        file,
        progress: 0,
        status: 'pending',
        mediaType: getMediaType(file),
      }))

      setUploads((prev) => [...prev, ...newUploads])
      setIsUploading(true)

      const startIndex = uploads.length

      // State of the art parallel file uploads
      const MAX_CONCURRENT_UPLOADS = 12;
      let active = 0;
      let index = 0;

      await new Promise<void>((resolve) => {
        function next() {
          if (index >= accepted.length && active === 0) {
            resolve();
            return;
          }
          
          while (active < MAX_CONCURRENT_UPLOADS && index < accepted.length) {
            const currentIndex = index++;
            active++;
            
            const fileIndex = startIndex + currentIndex;
            const file = accepted[currentIndex];

            updateFile(fileIndex, { status: 'uploading' });

            uploadPhotoWithMetadata({
              file,
              eventId,
              roomId,
              userId,
              onProgress: (progress) => updateFile(fileIndex, { progress }),
            }).then(({ data, error }) => {
              if (error || !data) {
                updateFile(fileIndex, { status: 'error', error: error ?? 'Upload failed' });
                toast.error(`Failed: ${file.name}`);
              } else {
                updateFile(fileIndex, { status: 'done', progress: 100 });
                onUploadSuccess?.(data);
                toast.success(`Uploaded: ${file.name}`);
                // Haptic feedback for mobile
                if (navigator.vibrate) navigator.vibrate(50);
              }
            }).catch(() => {
              updateFile(fileIndex, { status: 'error', error: 'Unexpected error' });
            }).finally(() => {
              active--;
              next();
            });
          }
        }
        next();
      });

      setIsUploading(false)
    },
    [eventId, roomId, userId, uploads.length, onUploadSuccess]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: Object.fromEntries(ACCEPTED_MEDIA_TYPES.map((t) => [t, []])),
    // No file size limit
  })

  const removeUpload = (index: number) => {
    setUploads((prev) => prev.filter((_, i) => i !== index))
  }

  const completedCount = uploads.filter((u) => u.status === 'done').length
  const errorCount = uploads.filter((u) => u.status === 'error').length
  const totalCount = uploads.length

  return (
    <div className="space-y-4">
      {/* Shared hidden input */}
      <input {...getInputProps()} />

      {/* MOBILE: Floating Action Button (FAB) */}
      <button
        {...getRootProps()}
        className="md:hidden fixed bottom-6 right-6 z-50 bg-blue-500 text-white p-4 rounded-full shadow-xl hover:bg-blue-600 transition-transform active:scale-95 pb-safe pr-safe"
      >
        <UploadCloud size={24} />
      </button>

      {/* DESKTOP: Drop zone */}
      <div
        {...getRootProps()}
        className={`hidden md:block upload-zone p-10 ${isDragActive ? 'upload-zone-active' : ''}`}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
            isDragActive
              ? 'bg-blue-500/20 border border-blue-500/40'
              : 'bg-white/[0.05] border border-white/[0.08]'
          }`}>
            <UploadCloud
              size={28}
              className={isDragActive ? 'text-blue-400' : 'text-[#71717a]'}
            />
          </div>
          <div>
            <p className="text-base font-medium text-[#f4f4f5]">
              {isDragActive ? 'Drop files here' : 'Drag & drop files, or click to browse'}
            </p>
            <p className="text-sm text-[#71717a] mt-1">
              Photos & videos — all formats supported, no size limit
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#52525b]">
            <span className="flex items-center gap-1">
              <ImageIcon size={12} /> JPG, PNG, WEBP, HEIC, GIF...
            </span>
            <span className="text-[#3f3f46]">•</span>
            <span className="flex items-center gap-1">
              <Film size={12} /> MP4, MOV, MKV, WEBM...
            </span>
          </div>
        </div>
      </div>

      {/* Upload list */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {/* Summary */}
          {totalCount > 1 && (
            <div className="flex items-center gap-2 text-sm text-[#a1a1aa]">
              <span>{completedCount}/{totalCount} uploaded</span>
              {errorCount > 0 && (
                <span className="text-red-400">• {errorCount} failed</span>
              )}
              {isUploading && (
                <Loader2 size={14} className="animate-spin-slow text-blue-400" />
              )}
            </div>
          )}

          {/* Individual files */}
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {uploads.map((u, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[#0f0f0f] border border-white/[0.06]">
                {/* Icon */}
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/[0.05]">
                  {u.mediaType === 'video' ? (
                    <Film size={16} className="text-purple-400" />
                  ) : (
                    <ImageIcon size={16} className="text-blue-400" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#f4f4f5] truncate">{u.file.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-[#71717a]">{formatFileSize(u.file.size)}</span>
                    {u.status === 'uploading' && (
                      <>
                        <span className="text-[#52525b]">•</span>
                        <span className="text-xs text-blue-400">{u.progress}%</span>
                      </>
                    )}
                    {u.status === 'error' && (
                      <span className="text-xs text-red-400 truncate">{u.error}</span>
                    )}
                  </div>
                  {/* Progress bar */}
                  {u.status === 'uploading' && (
                    <div className="mt-1.5 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${u.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Status icon */}
                <div className="flex-shrink-0">
                  {u.status === 'done' && <CheckCircle2 size={18} className="text-emerald-400" />}
                  {u.status === 'error' && <AlertCircle size={18} className="text-red-400" />}
                  {u.status === 'uploading' && (
                    <Loader2 size={18} className="text-blue-400 animate-spin-slow" />
                  )}
                  {u.status === 'pending' && (
                    <button onClick={() => removeUpload(i)} className="btn-icon p-1">
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Clear done */}
          {completedCount > 0 && !isUploading && (
            <button
              onClick={() => setUploads((prev) => prev.filter((u) => u.status !== 'done'))}
              className="text-xs text-[#71717a] hover:text-[#a1a1aa] transition-colors"
            >
              Clear completed ({completedCount})
            </button>
          )}
        </div>
      )}
    </div>
  )
}
