import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { Photo } from '@/types'
import { getSecureMediaUrl } from '@/services/photoService'

export async function downloadFilesAsZip(photos: Photo[], zipFilename: string, onProgress?: (progress: number) => void) {
  try {
    const zip = new JSZip()
    
    // Create an array of fetch promises
    let completed = 0
    
    // We'll process them in batches to not overwhelm the browser/network
    const batchSize = 5
    for (let i = 0; i < photos.length; i += batchSize) {
      const batch = photos.slice(i, i + batchSize)
      
      await Promise.all(batch.map(async (photo) => {
        try {
          let targetUrl = photo.s3Url
          if (targetUrl && !photo.isEncrypted) {
             try { targetUrl = await getSecureMediaUrl(photo) } catch (e) {}
          }
          if (!targetUrl) throw new Error('Missing URL');
          
          const response = await fetch(targetUrl)
          if (!response.ok) throw new Error(`Failed to fetch ${photo.filename}`)
          
          const blob = await response.blob()
          zip.file(photo.filename, blob)
          
        } catch (err) {
          console.error(`Error downloading ${photo.filename}:`, err)
          // Add a text file indicating the error if download failed
          zip.file(`${photo.filename}.error.txt`, `Failed to download: ${err}`)
        } finally {
          completed++
          if (onProgress) {
            onProgress(Math.floor((completed / photos.length) * 50)) // first 50% is downloading
          }
        }
      }))
    }

    // Generate the zip file
    const content = await zip.generateAsync({ 
      type: 'blob',
      compression: 'STORE', // No compression, images/video are already compressed
    }, (metadata) => {
      if (onProgress) {
        // next 50% is zipping
        onProgress(50 + Math.floor(metadata.percent / 2))
      }
    })

    // Trigger download
    saveAs(content, `${zipFilename}.zip`)
    return { success: true }
    
  } catch (error) {
    console.error('ZIP generation failed:', error)
    return { success: false, error: 'Failed to generate ZIP file' }
  }
}
