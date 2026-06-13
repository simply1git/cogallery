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
    const downloadUrl = url.includes('?') ? `${url}&download=1&filename=${encodeURIComponent(filename)}` : `${url}?download=1&filename=${encodeURIComponent(filename)}`;
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a)
    }, 100)
    
    toast.success('Download started')
  } catch (error) {
    console.error('Download error:', error)
    toast.error('Failed to download file. Please try again.')
  }
}
