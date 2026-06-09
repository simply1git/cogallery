import { useState, useEffect, useRef } from 'react';
import type { Photo } from '@/types';
import { getSecureMediaUrl } from '@/services/photoService';
import { decryptBuffer, decryptString } from '@/services/cryptoService';

// Module-level cache to prevent re-decrypting the same photo if unmounted/remounted in the virtual grid
const urlCache = new Map<string, string>();

// Inflight request deduplication — prevents the same photo from being fetched N times
// when Masonic unmounts/remounts cards rapidly during scroll
const inflightRequests = new Map<string, Promise<string>>();

export function useDecryptedMediaUrl(photo: Photo, vaultKey?: CryptoKey, preferFullRes: boolean = false) {
  // Synchronous cache hit — no flicker on re-mount
  const cacheKey = photo ? `${photo.id}:${preferFullRes ? 'full' : 'thumb'}` : '';
  const cachedUrl = cacheKey ? urlCache.get(cacheKey) : undefined;

  const [url, setUrl] = useState<string>(cachedUrl || '');
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Track the photo id to avoid stale closures
  const photoIdRef = useRef(photo?.id);
  photoIdRef.current = photo?.id;

  useEffect(() => {
    if (!photo) return;

    // If we already have a cached URL, use it immediately
    if (cachedUrl) {
      setUrl(cachedUrl);
      return;
    }

    let isActive = true;

    async function loadMedia() {
      const s3Key = photo.s3Key || photo.filename;

      if (s3Key?.startsWith('pending')) {
        if (isActive) setUrl('');
        return;
      }

      // 1. Grid Mode: Use Thumbnail (No Network Required)
      if (!preferFullRes && photo.thumbnailBase64) {
        // If it's a plain data URL (unencrypted or legacy), use it instantly
        if (photo.thumbnailBase64?.startsWith('data:image/')) {
          urlCache.set(cacheKey, photo.thumbnailBase64);
          if (isActive) setUrl(photo.thumbnailBase64);
          return;
        }

        // If it's encrypted, decrypt the string
        if (photo.isEncrypted && vaultKey) {
          if (isActive) setIsDecrypting(true);
          try {
            const decThumb = await decryptString(photo.thumbnailBase64, vaultKey);
            urlCache.set(cacheKey, decThumb);
            if (isActive && photoIdRef.current === photo.id) setUrl(decThumb);
          } catch (e) {
            console.error('Failed to decrypt thumbnail', e);
            if (isActive) setError('Decryption failed');
          } finally {
            if (isActive) setIsDecrypting(false);
          }
          return;
        }
      }

      // 2. Full-Res Mode: Fetch and potentially decrypt the full media file
      if (!photo.isEncrypted) {
        let fetchPromise = inflightRequests.get(cacheKey);
        if (!fetchPromise) {
          fetchPromise = getSecureMediaUrl(s3Key);
          inflightRequests.set(cacheKey, fetchPromise);
        }

        try {
          const secureUrl = await fetchPromise;
          urlCache.set(cacheKey, secureUrl);
          if (isActive && photoIdRef.current === photo.id) {
            setUrl(secureUrl);
          }
        } catch (err) {
          if (isActive) setError('Failed to load media');
        } finally {
          inflightRequests.delete(cacheKey);
        }
        return;
      }

      // 3. Encrypted Full-Res Mode
      if (!vaultKey) {
        if (isActive) setError('Vault locked');
        return;
      }

      if (isActive) setIsDecrypting(true);

      let fetchPromise = inflightRequests.get(cacheKey);
      if (!fetchPromise) {
        fetchPromise = (async () => {
          const secureUrl = await getSecureMediaUrl(s3Key);
          const response = await fetch(secureUrl);
          if (!response.ok) throw new Error('Failed to fetch encrypted media');

          const encryptedBuffer = await response.arrayBuffer();
          const mimeType = photo.mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
          const decryptedBlob = await decryptBuffer(encryptedBuffer, vaultKey, mimeType);

          return URL.createObjectURL(decryptedBlob);
        })();
        inflightRequests.set(cacheKey, fetchPromise);
      }

      try {
        const blobUrl = await fetchPromise;
        urlCache.set(cacheKey, blobUrl);
        if (isActive && photoIdRef.current === photo.id) {
          setUrl(blobUrl);
        }
      } catch (err) {
        console.error('Decryption failed', err);
        if (isActive) setError('Decryption failed');
      } finally {
        inflightRequests.delete(cacheKey);
        if (isActive) setIsDecrypting(false);
      }
    }

    loadMedia();

    return () => {
      isActive = false;
    };
  // Stable primitive dependencies — no object reference churn
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.id, photo?.s3Key, photo?.isEncrypted, photo?.thumbnailBase64, preferFullRes, vaultKey]);

  return { url, isDecrypting, error };
}
