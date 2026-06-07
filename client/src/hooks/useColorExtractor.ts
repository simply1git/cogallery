import { useState, useEffect } from 'react'

interface RGB {
  r: number
  g: number
  b: number
}

/**
 * Extracts a dominant/ambient color from an image URL by drawing it to a hidden canvas
 * and averaging a sample of pixels.
 */
export function useColorExtractor(imageUrl?: string) {
  const [ambientColor, setAmbientColor] = useState<RGB | null>(null)

  useEffect(() => {
    if (!imageUrl) {
      setAmbientColor(null)
      return
    }

    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.src = imageUrl

    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return

      // We only need a very small version of the image to get the ambient color
      canvas.width = 64
      canvas.height = 64

      // Draw the image onto the canvas
      ctx.drawImage(img, 0, 0, 64, 64)

      // Get pixel data
      try {
        const imageData = ctx.getImageData(0, 0, 64, 64).data
        let r = 0, g = 0, b = 0, count = 0

        // Sample every 4th pixel (step by 16 because each pixel has 4 values: RGBA)
        for (let i = 0; i < imageData.length; i += 16) {
          // Skip highly transparent pixels
          if (imageData[i + 3] < 128) continue

          r += imageData[i]
          g += imageData[i + 1]
          b += imageData[i + 2]
          count++
        }

        if (count > 0) {
          // Calculate the average
          setAmbientColor({
            r: Math.floor(r / count),
            g: Math.floor(g / count),
            b: Math.floor(b / count)
          })
        }
      } catch (e) {
        // May fail due to cross-origin restrictions on tainted canvases if crossOrigin fails
        console.warn('Failed to extract color due to CORS or tainted canvas', e)
        setAmbientColor(null)
      }
    }
    
    img.onerror = () => {
      setAmbientColor(null)
    }

  }, [imageUrl])

  // Return as a CSS rgba string suitable for backgrounds
  const ambientStyle = ambientColor 
    ? `rgba(${ambientColor.r}, ${ambientColor.g}, ${ambientColor.b}, 0.25)` 
    : undefined

  return { ambientColor, ambientStyle }
}
