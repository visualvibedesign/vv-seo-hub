// 2g · Shrinks a screenshot in the browser before it's sent to Claude: max 1600 px wide (2400 px tall), JPEG.
// Keeps the upload well under Vercel's 4.5 MB request limit and the server's 3 MB check. The result stays in this
// browser's memory only (the preview is an object URL); nothing is stored anywhere.

export type ShrunkImage = { mediaType: 'image/jpeg'; data: string; previewUrl: string; bytes: number }

const MAX_W = 1600
const MAX_H = 2400
const MAX_INPUT = 20_000_000

export class ImageError extends Error {}

export async function shrinkImage(file: File): Promise<ShrunkImage> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new ImageError('Pick a PNG, JPG or WebP screenshot.')
  if (file.size > MAX_INPUT) throw new ImageError('That file is over 20 MB. Take a smaller screenshot.')
  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(file)
  } catch {
    throw new ImageError('That image couldn’t be opened. Pick the screenshot again.')
  }
  const scale = Math.min(1, MAX_W / bmp.width, MAX_H / bmp.height)
  const w = Math.max(1, Math.round(bmp.width * scale))
  const h = Math.max(1, Math.round(bmp.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ImageError('This browser can’t prepare the image.')
  ctx.fillStyle = '#fff' // transparent PNG areas → white, not black, in the JPEG
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
  if (!blob) throw new ImageError('The image couldn’t be prepared. Try again.')
  const data = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''))
    r.onerror = () => reject(new ImageError('The image couldn’t be read. Try again.'))
    r.readAsDataURL(blob)
  })
  return { mediaType: 'image/jpeg', data, previewUrl: URL.createObjectURL(blob), bytes: blob.size }
}
