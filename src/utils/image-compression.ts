export interface ImageCompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
}

export type ThumbnailOptions = ImageCompressionOptions

const DEFAULT_THUMBNAIL_OPTIONS: Required<ImageCompressionOptions> = {
  maxWidth: 200,
  maxHeight: 200,
  quality: 0.7,
}

const DEFAULT_LLM_OPTIONS: Required<ImageCompressionOptions> = {
  maxWidth: 1000,
  maxHeight: 1000,
  quality: 0.85,
}

async function compressImage(
  base64Image: string,
  options: Required<ImageCompressionOptions>
): Promise<string | null> {
  try {
    return new Promise((resolve) => {
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

          if (width > options.maxWidth || height > options.maxHeight) {
            const ratio = Math.min(options.maxWidth / width, options.maxHeight / height)
            width = width * ratio
            height = height * ratio
          }

          canvas.width = width
          canvas.height = height

          ctx.drawImage(img, 0, 0, width, height)

          const compressedBase64 = canvas.toDataURL("image/jpeg", options.quality)
          resolve(compressedBase64)
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

export async function compressImageToThumbnail(
  base64Image: string,
  options: ThumbnailOptions = {}
): Promise<string | null> {
  const opts = { ...DEFAULT_THUMBNAIL_OPTIONS, ...options }
  return compressImage(base64Image, opts)
}

export async function compressImageForLLM(
  base64Image: string,
  options: ImageCompressionOptions = {}
): Promise<string | null> {
  const opts = { ...DEFAULT_LLM_OPTIONS, ...options }
  return compressImage(base64Image, opts)
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

export async function compressImagesForLLM(
  images: string[] | undefined
): Promise<string[] | undefined> {
  if (!images || images.length === 0) {
    return undefined
  }

  const compressed = await Promise.all(images.map((img) => compressImageForLLM(img)))
  const validImages = compressed.filter((img): img is string => img !== null)

  return validImages.length > 0 ? validImages : undefined
}
