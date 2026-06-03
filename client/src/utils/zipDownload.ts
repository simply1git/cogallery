import { downloadZip } from 'client-zip'
import type { Photo } from '@/types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export async function downloadPhotosAsZip(
  photos: Photo[],
  zipFilename: string,
  onProgress?: (percent: number) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    const s3Photos = photos.filter(p => p.s3Url);
    if (s3Photos.length === 0) return { success: true };

    // Hybrid Strategy 1: Edge Client-Side Stream (Chrome, Edge, Opera, Android)
    // Zero-RAM, Zero-Server-Cost Streaming via File System Access API
    if ('showSaveFilePicker' in window) {
      if (onProgress) onProgress(10); // Initial progress
      
      // We map URLs to async fetch requests (client-zip consumes them efficiently)
      const downloadGenerator = async function* () {
        for (let i = 0; i < s3Photos.length; i++) {
          const photo = s3Photos[i];
          const response = await fetch(photo.s3Url!);
          if (!response.body) continue;
          
          if (onProgress) onProgress(10 + Math.round(((i + 1) / s3Photos.length) * 80));
          yield {
            name: photo.filename,
            input: response.body
          };
        }
      };

      const zipResponse = downloadZip(downloadGenerator());
      
      // Prompt user for save location
      // @ts-ignore - TS doesn't fully support File System Access API yet
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: `${zipFilename}.zip`,
        types: [{ description: 'ZIP Archive', accept: { 'application/zip': ['.zip'] } }],
      });
      
      const writable = await fileHandle.createWritable();
      await zipResponse.body?.pipeTo(writable);
      
      if (onProgress) onProgress(100);
      return { success: true };
    } 
    
    // Hybrid Strategy 2: Backend Stream Fallback (Safari, iOS)
    // Uses the Oracle VPS to stream the zip for browsers lacking File System Access
    if (onProgress) onProgress(20);
    
    // Create an invisible form so the browser handles the download natively:
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = `${API_URL}/api/download-zip`;
    // We don't use _blank here so it triggers as a download in the current window without popping up a new tab that stays open.
    
    const photosInput = document.createElement('input');
    photosInput.type = 'hidden';
    photosInput.name = 'photos';
    // Stringify the array
    photosInput.value = JSON.stringify(s3Photos.map(p => ({ url: p.s3Url, filename: p.filename })));
    form.appendChild(photosInput);
    
    const filenameInput = document.createElement('input');
    filenameInput.type = 'hidden';
    filenameInput.name = 'filename';
    filenameInput.value = zipFilename;
    form.appendChild(filenameInput);
    
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
    
    if (onProgress) onProgress(100);
    return { success: true };
    
  } catch (err: any) {
    console.error('Error creating zip:', err);
    return { success: false, error: err.message }
  }
}
