import { useState, useEffect, useRef } from 'react';
import type { Photo } from '@/types';
import { getSecureMediaUrl } from '@/services/photoService';
import { decryptBuffer } from '@/services/cryptoService';

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
      // 1. Handle non-encrypted photos
      if (!photo.isEncrypted) {
        // For grid cards: use the inline thumbnail for instant rendering
        if (photo.thumbnailBase64 && !preferFullRes) {
          const thumbUrl = photo.thumbnailBase64;
          urlCache.set(cacheKey, thumbUrl);
          if (isActive) setUrl(thumbUrl);
          return;
        }

        // For full-res (detail modal) or photos without thumbnails: fetch signed URL
        const s3Key = photo.s3Key || photo.filename;

        // Deduplicate inflight requests
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

      // 2. Handle encrypted photos
      if (!vaultKey) {
        if (isActive) setError('Vault locked');
        return;
      }

      if (isActive) setIsDecrypting(true);

      let fetchPromise = inflightRequests.get(cacheKey);
      if (!fetchPromise) {
        fetchPromise = (async () => {
          const secureUrl = await getSecureMediaUrl(photo.s3Key || photo.filename);
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
