import { PixelCrop } from 'react-image-crop'

/**
 * Crop an image based on react-image-crop PixelCrop parameters.
 *
 * ReactCrop reports pixel coordinates relative to the **rendered** <img>
 * element, which is scaled down from the natural image by CSS (max-h-[60vh]).
 * We accept the rendered dimensions so we can scale the crop rectangle
 * up to natural dimensions, producing a full-resolution output.
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: PixelCrop,
  renderedWidth: number,
  renderedHeight: number
): Promise<Blob | null> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return null
  }

  // Scale factor: rendered <img> → natural image dimensions.
  const scaleX = image.naturalWidth / renderedWidth
  const scaleY = image.naturalHeight / renderedHeight

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
      0.92
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
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })
}
