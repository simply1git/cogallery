import { PixelCrop } from 'react-image-crop'

/**
 * Crop an image based on react-image-crop PixelCrop parameters.
 *
 * ReactCrop reports pixel coordinates relative to the **rendered** <img>
 * element, which may be scaled down from the natural image dimensions.
 * We scale the crop rectangle up to natural dimensions so the output
 * is full-resolution.
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: PixelCrop
): Promise<Blob | null> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return null
  }

  // Scale factor between rendered size and natural size.
  // The PixelCrop values are in rendered-pixel space, so we need to
  // translate them to natural-pixel space for the canvas draw.
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height

  const srcX = Math.round(pixelCrop.x * scaleX)
  const srcY = Math.round(pixelCrop.y * scaleY)
  const srcW = Math.round(pixelCrop.width * scaleX)
  const srcH = Math.round(pixelCrop.height * scaleY)

  // Output canvas at the full-resolution crop size
  canvas.width = srcW
  canvas.height = srcH

  ctx.drawImage(
    image,
    srcX,
    srcY,
    srcW,
    srcH,
    0,
    0,
    srcW,
    srcH
  )

  // As a blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'))
          return
        }
        resolve(blob)
      },
      'image/jpeg',
      0.9
    )
  })
}

/**
 * Creates an HTMLImageElement from a source string
 */
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    // Needed to avoid cross-origin issues on some remote images
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })
}
