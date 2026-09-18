import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import path from 'path';
import fs from 'fs/promises';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Transcodes an MP4/WebM video into HLS (.m3u8) format with adaptive bitrates.
 * @param {string} inputPath - The path to the uploaded raw video file.
 * @param {string} outputDir - The directory where the .m3u8 and .ts files will be stored.
 * @param {string} photoId - The ID of the photo/video.
 */
export async function transcodeToHLS(inputPath, outputDir, photoId) {
  try {
    // Ensure the output directory exists for HLS streams
    const hlsDir = path.join(outputDir, `${photoId}_hls`);
    await fs.mkdir(hlsDir, { recursive: true });

    const outputPath = path.join(hlsDir, 'playlist.m3u8');

    return new Promise((resolve, reject) => {
      console.log(`[Transcode] Starting HLS Transcoding for ${photoId}`);
      ffmpeg(inputPath)
        // Set standard HLS parameters
        .outputOptions([
          '-hls_time 10',                 // 10 second chunks
          '-hls_list_size 0',             // keep all chunks in playlist
          '-f hls',                       // format
          '-c:v libx264',                 // video codec
          '-preset fast',                 // fast encoding
          '-c:a aac',                     // audio codec
          '-b:a 128k',                    // audio bitrate
          '-vf scale=-2:720'              // scale to 720p maximum, keeping aspect ratio
        ])
        .output(outputPath)
        .on('end', () => {
          console.log(`[Transcode] Finished HLS Transcoding for ${photoId}`);
          resolve(hlsDir);
        })
        .on('error', (err) => {
          console.error(`[Transcode] Failed HLS Transcoding for ${photoId}:`, err);
          reject(err);
        })
        .run();
    });
  } catch (error) {
    console.error(`[Transcode] Setup failed for ${photoId}:`, error);
    throw error;
  }
}
