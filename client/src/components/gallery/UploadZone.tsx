import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud, X, CheckCircle2, Film, ImageIcon, Loader2 } from 'lucide-react'
import { getMediaType, formatFileSize, ACCEPTED_MEDIA_TYPES } from '@/services/uploadService'
import { uploadQueueService } from '@/services/uploadQueueService'
import { useUploadQueue } from '@/hooks/useUploadQueue'
import type { Photo } from '@/types'

interface UploadZoneProps {
  eventId: string
  roomId: string
  userId: string
  onUploadSuccess?: (photo: Photo) => void
}

export function UploadZone({ eventId, roomId, userId }: UploadZoneProps) {
  // Use global persistent queue instead of local memory state
  const { uploads, removeItem, retryItem, clearCompleted } = useUploadQueue()

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (accepted.length === 0) return
      // Instantly cache to IndexedDB and trigger background processing
      await uploadQueueService.addFiles(accepted, { eventId, roomId, userId })
    },
    [eventId, roomId, userId]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: Object.fromEntries(ACCEPTED_MEDIA_TYPES.map((t) => [t, []])),
    // No file size limit
  })

  // Filter uploads specific to this room (in case user switches rooms while uploading)
  const roomUploads = uploads.filter(u => u.roomId === roomId)
  const completedCount = roomUploads.filter(u => u.status === 'done').length
  const errorCount = roomUploads.filter(u => u.status === 'error').length
  const totalCount = roomUploads.length
  const isUploading = roomUploads.some(u => u.status === 'uploading')

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
      {roomUploads.length > 0 && (
        <div className="space-y-2">
          {/* Summary */}
          {totalCount > 1 && (
            <div className="flex items-center gap-2 text-sm text-[#a1a1aa] justify-between">
              <div className="flex items-center gap-2">
                <span>{completedCount}/{totalCount} uploaded</span>
                {errorCount > 0 && (
                  <span className="text-red-400">• {errorCount} failed</span>
                )}
                {isUploading && (
                  <Loader2 size={14} className="animate-spin-slow text-blue-400" />
                )}
              </div>
              {/* Clear done */}
              {completedCount > 0 && !isUploading && (
                <button
                  onClick={clearCompleted}
                  className="text-xs text-[#71717a] hover:text-[#a1a1aa] transition-colors"
                >
                  Clear completed
                </button>
              )}
            </div>
          )}

          {/* Individual files */}
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {roomUploads.map((u) => {
              const mediaType = getMediaType(u.file)
              return (
                <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#0f0f0f] border border-white/[0.06]">
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/[0.05]">
                    {mediaType === 'video' ? (
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
                          <span className="text-xs text-blue-400">{Math.round(u.progress)}%</span>
                        </>
                      )}
                      {u.status === 'error' && (
                        <span className="text-xs text-red-400 truncate">{u.error}</span>
                      )}
                      {u.status === 'queued' && (
                        <span className="text-xs text-amber-500 truncate">Queued...</span>
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
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {u.status === 'done' && <CheckCircle2 size={18} className="text-emerald-400" />}
                    {u.status === 'uploading' && (
                      <Loader2 size={18} className="text-blue-400 animate-spin-slow" />
                    )}
                    {u.status === 'error' && (
                      <button onClick={() => retryItem(u.id)} className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1 bg-rose-500/10 rounded">
                        Retry
                      </button>
                    )}
                    {u.status !== 'uploading' && (
                      <button onClick={() => removeItem(u.id)} className="btn-icon p-1" title="Remove">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
