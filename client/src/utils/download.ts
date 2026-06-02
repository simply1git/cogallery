import { toast } from 'sonner'

/**
 * Downloads a file directly from a given URL.
 */
export async function downloadFile(url: string | null, filename: string) {
  if (!url || url.includes('pending')) {
    toast.error('Original file is currently unavailable or still uploading.')
    return
  }

  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('Network response was not ok')
    
    const blob = await res.blob()
    const a = document.createElement('a')
    const objectUrl = URL.createObjectURL(blob)
    
    a.href = objectUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    }, 100)
    
    toast.success('Download started')
  } catch (error) {
    console.error('Download error:', error)
    toast.error('Failed to download file. Please try again.')
  }
}
