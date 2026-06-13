import { Photo } from '@/types'
import { supabase } from '@/lib/supabase'

export async function downloadFilesAsZip(photos: Photo[], zipFilename: string, onProgress?: (progress: number) => void) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Not authenticated');

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
    const actionUrl = `${backendUrl}/api/download-zip?token=${encodeURIComponent(token)}`;

    // Set progress to 100 instantly since the browser's native UI will handle the download progress
    if (onProgress) onProgress(100);

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = actionUrl;
    // Open in same tab or target="_blank"
    // Usually same tab is fine for downloads, it won't navigate away if it's an attachment
    form.style.display = 'none';

    // Append the payload
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

    // Cleanup
    setTimeout(() => document.body.removeChild(form), 1000);

    return { success: true };
  } catch (error) {
    console.error('ZIP generation failed:', error)
    return { success: false, error: 'Failed to generate ZIP file' }
  }
}
