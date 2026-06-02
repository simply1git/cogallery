// Web Worker for Image Processing
// Decodes images and generates thumbnails completely off the main thread using OffscreenCanvas

const MAX_THUMB_DIM = 800;
const THUMB_QUALITY = 0.8;

function scaleDown(w: number, h: number, max: number): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const scale = Math.min(max / w, max / h);
  return {
    width: Math.round(w * scale),
    height: Math.round(h * scale),
  };
}

// Convert Blob to Base64 manually in worker
async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}

self.onmessage = async (e: MessageEvent) => {
  const { id, file } = e.data;
  
  try {
    // createImageBitmap decodes the image off-thread natively
    const bitmap = await createImageBitmap(file);
    const { width, height } = scaleDown(bitmap.width, bitmap.height, MAX_THUMB_DIM);
    
    // Use OffscreenCanvas to draw without DOM
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d context in worker');
    
    ctx.drawImage(bitmap, 0, 0, width, height);
    
    // convertToBlob is async and non-blocking
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: THUMB_QUALITY });
    
    // Convert to base64 to match our existing database format requirements
    const base64 = await blobToBase64(blob);
    
    self.postMessage({ id, success: true, base64 });
    
    // Cleanup
    bitmap.close();
  } catch (error: any) {
    self.postMessage({ id, success: false, error: error.message });
  }
};
