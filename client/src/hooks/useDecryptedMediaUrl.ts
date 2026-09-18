import { useState, useEffect, useRef } from 'react';
import type { Photo } from '@/types';
import { getSecureMediaUrl } from '@/services/photoService';
import { decryptResponseToBlob, decryptString } from '@/services/cryptoService';
import { supabase } from '@/lib/supabase';
import localforage from 'localforage';

// Module-level cache to prevent re-decrypting the same photo if unmounted/remounted in the virtual grid
const urlCache = new Map<string, string>();

function setCachedUrl(key: string, url: string) {
  urlCache.set(key, url);
  // Prevent infinite memory leak of Blob ObjectURLs
  // Increased limit since we removed masonic virtualization and all grid items render simultaneously
  if (urlCache.size > 1000) {
    const oldestKey = urlCache.keys().next().value;
    if (oldestKey) {
      const oldestUrl = urlCache.get(oldestKey);
      if (oldestUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(oldestUrl);
      }
      urlCache.delete(oldestKey);
    }
  }
}

// Inflight request deduplication — prevents the same photo from being fetched N times
// when Masonic unmounts/remounts cards rapidly during scroll
const inflightRequests = new Map<string, Promise<string>>();export function useDecryptedMediaUrl(photo: Photo | undefined | null, vaultKey?: CryptoKey, preferFullRes: boolean = false) {
  // Synchronous cache hit ?" no flicker on re-mount
  const cacheKey = photo ? `${photo.id}:${preferFullRes ? 'full' : 'thumb'}` : '';
  const cachedUrl = cacheKey ? urlCache.get(cacheKey) : undefined;
  const cachedHlsUrl = cacheKey ? urlCache.get(`${cacheKey}_hls`) : undefined;

  const [url, setUrl] = useState<string>(cachedUrl || '');
  const [hlsUrl, setHlsUrl] = useState<string | undefined>(cachedHlsUrl);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenVersion, setTokenVersion] = useState(0);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'TOKEN_REFRESHED') {
        urlCache.clear();
        inflightRequests.clear();
        setTokenVersion(v => v + 1);
      }
    });
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Track the photo id to immediately sync state on change (avoiding 1-frame stale flashes)
  const prevPhotoIdRef = useRef(photo?.id);
  
  if (photo?.id !== prevPhotoIdRef.current) {
    prevPhotoIdRef.current = photo?.id;
    setUrl(cachedUrl || '');
    setHlsUrl(cachedHlsUrl);
    setIsDecrypting(false);
    setError(null);
  }

  // Also need a ref to prevent race conditions in async operations
  const photoIdRef = useRef(photo?.id);
  
  useEffect(() => {
    photoIdRef.current = photo?.id;
  }, [photo?.id]);

  useEffect(() => {
    if (!photo) return;

    // If we already have a cached URL, use it immediately
    if (cachedUrl) {
      setUrl(cachedUrl);
      if (cachedHlsUrl) setHlsUrl(cachedHlsUrl);
      return;
    }

    let isActive = true;

    async function loadMedia() {
      if (!photo) return;
      const s3Key = photo.s3Key || photo.filename;

      if (s3Key?.includes('pending') || photo.s3Url?.includes('pending')) {
        if (isActive) {
           setUrl('');
           setHlsUrl(undefined);
        }
        return;
      }

      // 1. Grid Mode: Use Thumbnail (No Network Required)
      if (!preferFullRes && photo.thumbnailBase64) {
        // If it's a plain data URL (unencrypted or legacy), use it instantly
        if (photo.thumbnailBase64?.startsWith('data:image/')) {
          setCachedUrl(cacheKey, photo.thumbnailBase64);
          if (isActive) setUrl(photo.thumbnailBase64);
          return;
        }

        // If it's encrypted, decrypt the string
        if (photo.isEncrypted && vaultKey) {
          if (isActive) setIsDecrypting(true);
          
          let thumbPromise = inflightRequests.get(cacheKey);
          if (!thumbPromise) {
            thumbPromise = decryptString(photo.thumbnailBase64, vaultKey);
            inflightRequests.set(cacheKey, thumbPromise);
          }

          try {
            const decThumb = await thumbPromise;
            setCachedUrl(cacheKey, decThumb);
            if (isActive && photoIdRef.current === photo.id) setUrl(decThumb);
          } catch (e) {
            console.error('Failed to decrypt thumbnail', e);
            if (isActive) setError('Decryption failed');
          } finally {
            inflightRequests.delete(cacheKey);
            if (isActive) setIsDecrypting(false);
          }
          return;
        }
      }

      // 2. Full-Res Mode: Fetch and potentially decrypt the full media file
      if (!photo.isEncrypted) {
        try {
          const res = await getSecureMediaUrl(
            photo, 
            preferFullRes ? 'stream' : 'preview',
            !preferFullRes ? { width: 800, quality: 75 } : undefined
          );
          setCachedUrl(cacheKey, res.url);
          if (res.hlsUrl) {
            setCachedUrl(`${cacheKey}_hls`, res.hlsUrl);
          }
          if (isActive && photoIdRef.current === photo.id) {
            setUrl(res.url);
            setHlsUrl(res.hlsUrl);
          }
        } catch (err) {
          if (isActive) setError('Failed to load media');
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
          // Check localforage first for offline-first support
          try {
            const cachedBlob = await localforage.getItem<Blob>(`enc_${cacheKey}`);
            if (cachedBlob) {
              return URL.createObjectURL(cachedBlob);
            }
          } catch (e) {
            console.warn('Failed to read from localforage cache', e);
          }

          const secureUrl = await getSecureMediaUrl(
            photo, 
            preferFullRes ? 'stream' : 'preview',
            !preferFullRes ? { width: 800, quality: 75 } : undefined
          );
          const response = await fetch(secureUrl.url);
          if (!response.ok) throw new Error('Failed to fetch encrypted media');

          const mimeType = photo.mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
          const decryptedBlob = await decryptResponseToBlob(response, vaultKey, mimeType);
          
          try {
            // Cache for offline access
            await localforage.setItem(`enc_${cacheKey}`, decryptedBlob);
          } catch (e) {
            console.warn('Failed to save to localforage cache', e);
          }

          return URL.createObjectURL(decryptedBlob);
        })();
        inflightRequests.set(cacheKey, fetchPromise);
      }

      try {
        const blobUrl = await fetchPromise;
        setCachedUrl(cacheKey, blobUrl);
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
  // Stable primitive dependencies - no object reference churn
  }, [photo?.id, photo?.s3Key, photo?.isEncrypted, photo?.thumbnailBase64, preferFullRes, vaultKey, tokenVersion]);

  return { url, hlsUrl, isDecrypting, error };
}
