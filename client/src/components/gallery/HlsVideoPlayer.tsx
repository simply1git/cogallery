import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface HlsVideoPlayerProps {
  src?: string;
  hlsUrl?: string;
  poster?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export const HlsVideoPlayer: React.FC<HlsVideoPlayerProps> = ({ src, hlsUrl, poster, className, onClick }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    if (hlsUrl && Hls.isSupported()) {
      hls = new Hls({
        maxBufferLength: 30, // seconds
        maxMaxBufferLength: 60,
      });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(e => console.error("Auto-play failed", e));
      });
    } else if (hlsUrl && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari has native HLS support
      video.src = hlsUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => console.error("Auto-play failed", e));
      });
    } else if (src) {
      // Fallback to basic MP4 streaming (or Blob URL if decrypted)
      video.src = src;
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [src, hlsUrl]);

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      autoPlay
      poster={poster}
      className={className}
      onClick={onClick}
    />
  );
};
