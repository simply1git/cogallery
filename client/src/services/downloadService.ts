import { Photo } from '@/types'
import { supabase } from '@/lib/supabase'

import JSZip from 'jszip'
import streamSaver from 'streamsaver'

// Helper to detect iOS/Safari where ServiceWorkers/StreamSaver might be blocked
const isIOS = () => {
  return [
    'iPad Simulator',
    'iPhone Simulator',
    'iPod Simulator',
    'iPad',
    'iPhone',
    'iPod'
  ].includes(navigator.platform) || (navigator.userAgent.includes("Mac") && "ontouchend" in document)
}

export async function downloadFilesAsZip(photos: Photo[], zipFilename: string, onProgress?: (progress: number) => void) {
  try {
    const { data: authData } = await supabase.auth.getSession();
    const token = authData.session?.access_token;
    if (!token) throw new Error('Not authenticated');

    // If it's iOS Safari, fallback to the old server-side form POST because StreamSaver relies on Service Workers
    // which Safari heavily restricts in cross-origin / hidden contexts.
    if (isIOS()) {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
      const actionUrl = `${backendUrl}/api/download-zip?token=${encodeURIComponent(token)}`;

      if (onProgress) onProgress(100);

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = actionUrl;
      form.style.display = 'none';

      const payload = photos.map(p => ({
        id: p.s3Key || p.id,
        filename: p.filename
      }));

      const photosInput = document.createElement('input');
      photosInput.type = 'hidden';
      photosInput.name = 'photos';
      photosInput.value = JSON.stringify(payload);
      form.appendChild(photosInput);

      const filenameInput = document.createElement('input');
      filenameInput.type = 'hidden';
      filenameInput.name = 'filename';
      filenameInput.value = zipFilename;
      form.appendChild(filenameInput);

      document.body.appendChild(form);
      form.submit();

      setTimeout(() => document.body.removeChild(form), 1000);
      return { success: true };
    }

    // ========================================================
    // ELITE FEATURE: Client-Side ZIP Streaming
    // ========================================================
    const zip = new JSZip()
    let completed = 0

    // 1. Queue all files for downloading into JSZip
    // We don't await all of them at once to prevent OOM, we process in chunks if needed
    // But JSZip can take a Promise directly!
    for (const photo of photos) {
      if (!photo.s3Url) continue

      // Pass a promise to JSZip so it lazy-loads during generation
      const filePromise = fetch(photo.s3Url).then(res => {
        if (!res.ok) throw new Error(`Failed to fetch ${photo.filename}`)
        completed++
        if (onProgress) onProgress((completed / photos.length) * 50)
        return res.blob()
      })
      
      zip.file(photo.filename || photo.id + '.jpg', filePromise)
    }

    // 2. Stream the ZIP to the user's hard drive using StreamSaver
    const fileStream = streamSaver.createWriteStream(zipFilename)
    
    if (window.WritableStream && fileStream.getWriter) {
      const writer = fileStream.getWriter()
      
      return new Promise<{success: boolean, error?: string}>((resolve) => {
        zip.generateInternalStream({ type: 'uint8array', streamFiles: true })
          .on('data', (data: Uint8Array, metadata: any) => {
            writer.write(data)
            if (onProgress) onProgress(50 + (metadata.percent / 2))
          })
          .on('end', () => {
            writer.close()
            if (onProgress) onProgress(100)
            resolve({ success: true })
          })
          .on('error', (e: Error) => {
            writer.abort(e)
            resolve({ success: false, error: e.message })
          })
          .resume()
      })
    } else {
      // Ultimate fallback if StreamSaver fails
      const blob = await zip.generateAsync({ 
        type: 'blob',
        streamFiles: true 
      }, (metadata) => {
        if (onProgress) onProgress(50 + (metadata.percent / 2))
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = zipFilename
      a.click()
      URL.revokeObjectURL(url)
      
      return { success: true }
    }
  } catch (error) {
    console.error('ZIP generation failed:', error)
    return { success: false, error: 'Failed to generate ZIP file' }
  }
}
