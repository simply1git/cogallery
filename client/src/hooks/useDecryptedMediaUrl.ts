import { useState, useEffect } from 'react';
import type { Photo } from '@/types';
import { getSecureMediaUrl } from '@/services/photoService';
import { decryptBuffer } from '@/services/cryptoService';

// Module-level cache to prevent re-decrypting the same photo if unmounted/remounted in the virtual grid
const urlCache = new Map<string, string>();

export function useDecryptedMediaUrl(photo: Photo, vaultKey?: CryptoKey, preferFullRes: boolean = false) {
  const [url, setUrl] = useState<string>('');
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadMedia() {
      if (!photo) return;
      
      // 1. Handle non-encrypted photos
      if (!photo.isEncrypted) {
        // If it's not a vault, we could just use the thumbnail or get a signed URL
        if (photo.thumbnailBase64 && !preferFullRes) {
          setUrl(photo.thumbnailBase64);
        } else {
          try {
            const secureUrl = await getSecureMediaUrl(photo.s3Key || photo.filename);
            if (isActive) setUrl(secureUrl);
          } catch (err) {
            if (isActive) setError('Failed to load media');
          }
        }
        return;
      }

      // 2. Handle encrypted photos
      if (!vaultKey) {
        if (isActive) setError('Vault locked');
        return;
      }

      if (urlCache.has(photo.id)) {
        if (isActive) setUrl(urlCache.get(photo.id)!);
        return;
      }

      if (isActive) setIsDecrypting(true);
      try {
        // Fetch the raw encrypted blob from Supabase/R2
        const secureUrl = await getSecureMediaUrl(photo.s3Key || photo.filename);
        const response = await fetch(secureUrl);
        if (!response.ok) throw new Error('Failed to fetch encrypted media');
        
        const encryptedBuffer = await response.arrayBuffer();
        
        // Decrypt using WebCrypto
        const mimeType = photo.mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
        const decryptedBlob = await decryptBuffer(encryptedBuffer, vaultKey, mimeType);
        
        const blobUrl = URL.createObjectURL(decryptedBlob);
        urlCache.set(photo.id, blobUrl);
        
        if (isActive) setUrl(blobUrl);
      } catch (err) {
        console.error('Decryption failed', err);
        if (isActive) setError('Decryption failed');
      } finally {
        if (isActive) setIsDecrypting(false);
      }
    }

    loadMedia();

    return () => {
      isActive = false;
    };
  }, [photo, vaultKey]);

  return { url, isDecrypting, error };
}
