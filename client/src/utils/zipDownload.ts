import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import type { Photo } from '@/types'

export async function downloadPhotosAsZip(
  photos: Photo[],
  zipFilename: string,
  onProgress?: (percent: number) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    const zip = new JSZip()
    
    // Fetch all photos and add to zip
    const fetchPromises = photos.map(async (photo) => {
      if (!photo.s3Url) return

      try {
        const response = await fetch(photo.s3Url)
        if (!response.ok) throw new Error(`Failed to fetch ${photo.filename}`)
        const blob = await response.blob()
        zip.file(photo.filename, blob)
      } catch (err) {
        console.error(`Error fetching ${photo.filename}:`, err)
      }
    })

    await Promise.all(fetchPromises)

    // Generate zip file
    const content = await zip.generateAsync({ type: 'blob' }, (metadata) => {
      if (onProgress) {
        onProgress(metadata.percent)
      }
    })

    saveAs(content, `${zipFilename}.zip`)
    return { success: true }
  } catch (err: any) {
    console.error('Error creating zip:', err)
    return { success: false, error: err.message }
  }
}
