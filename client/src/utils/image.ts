/**
 * Utility functions for image URL validation and formatting.
 */

/**
 * Validates whether a string is a safe and valid image source (prevents relative path fallback for large raw data or ciphertexts).
 */
export function isValidImageSrc(src?: string | null): boolean {
  if (!src || typeof src !== 'string') return false;
  const trimmed = src.trim();
  if (!trimmed) return false;

  // Direct data URIs for images
  if (trimmed.startsWith('data:image/')) return true;

  // Blob URLs
  if (trimmed.startsWith('blob:')) return true;

  // HTTP/HTTPS URLs
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return true;

  // Relative paths (only short valid local paths like /logo.png or /favicon.ico)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && trimmed.length < 256 && !trimmed.includes('\n')) {
    return true;
  }

  return false;
}
