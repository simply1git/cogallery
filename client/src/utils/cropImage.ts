import { PixelCrop } from 'react-image-crop'

/**
 * A utility function to crop an image based on react-image-crop PixelCrop parameters
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

  // Set canvas size to match the bounding box
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  // Draw the cropped area to the canvas
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
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
