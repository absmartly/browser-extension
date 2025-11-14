export interface ThumbnailOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
}

const DEFAULT_THUMBNAIL_OPTIONS: Required<ThumbnailOptions> = {
  maxWidth: 200,
  maxHeight: 200,
  quality: 0.7,
}

export async function compressImageToThumbnail(
  base64Image: string,
  options: ThumbnailOptions = {}
): Promise<string | null> {
  try {
    const opts = { ...DEFAULT_THUMBNAIL_OPTIONS, ...options }

    return new Promise((resolve, reject) => {
      const img = new Image()

      img.onload = () => {
        try {
          const canvas = document.createElement("canvas")
          const ctx = canvas.getContext("2d")

          if (!ctx) {
            resolve(null)
            return
          }

          let width = img.width
          let height = img.height

          if (width > opts.maxWidth || height > opts.maxHeight) {
            const ratio = Math.min(opts.maxWidth / width, opts.maxHeight / height)
            width = width * ratio
            height = height * ratio
          }

          canvas.width = width
          canvas.height = height

          ctx.drawImage(img, 0, 0, width, height)

          const thumbnailBase64 = canvas.toDataURL("image/jpeg", opts.quality)
          resolve(thumbnailBase64)
        } catch (error) {
          console.error("[ImageCompression] Error during canvas processing:", error)
          resolve(null)
        }
      }

      img.onerror = (error) => {
        console.error("[ImageCompression] Error loading image:", error)
        resolve(null)
      }

      img.src = base64Image
    })
  } catch (error) {
    console.error("[ImageCompression] Error compressing image:", error)
    return null
  }
}

export async function compressImages(
  images: string[] | undefined
): Promise<string[] | undefined> {
  if (!images || images.length === 0) {
    return undefined
  }

  const compressed = await Promise.all(images.map((img) => compressImageToThumbnail(img)))

  const validThumbnails = compressed.filter((thumb): thumb is string => thumb !== null)

  return validThumbnails.length > 0 ? validThumbnails : undefined
}
