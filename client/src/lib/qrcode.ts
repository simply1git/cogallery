import QRCode from 'qrcode'

export async function generateQRCode(
  text: string,
  options?: QRCode.QRCodeToDataURLOptions
): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(text, {
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      ...options,
    })
    return dataUrl
  } catch (error) {
    console.error('Failed to generate QR code:', error)
    throw error
  }
}

export async function generateQRCodeCanvas(
  text: string,
  options?: any
): Promise<HTMLCanvasElement> {
  try {
    const canvas = document.createElement('canvas')
    await QRCode.toCanvas(canvas, text, {
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      ...options,
    })
    return canvas
  } catch (error) {
    console.error('Failed to generate QR code canvas:', error)
    throw error
  }
}
