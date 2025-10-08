import type { ABsmartlyConfig } from '~src/types/absmartly'

/**
 * Fetches an image from the API with proper authentication and returns a blob URL
 * @param url - Full URL to the image (should already include base URL)
 * @param config - ABsmartly config containing auth method and credentials
 * @returns Blob URL that can be used in img src, or null if fetch fails
 */
export async function fetchAuthenticatedImage(
  url: string,
  config: ABsmartlyConfig
): Promise<string | null> {
  try {
    const fetchOptions: RequestInit = {}

    if (config.authMethod === 'jwt') {
      fetchOptions.credentials = 'include'
    } else if (config.authMethod === 'apikey' && config.apiKey) {
      const authHeader = config.apiKey.includes('.') && config.apiKey.split('.').length === 3
        ? `JWT ${config.apiKey}`
        : `Api-Key ${config.apiKey}`
      fetchOptions.headers = {
        'Authorization': authHeader
      }
    }

    const response = await fetch(url, fetchOptions)

    if (response.ok) {
      const blob = await response.blob()
      return URL.createObjectURL(blob)
    }

    console.warn('[fetchAuthenticatedImage] Image fetch failed:', response.status, url)
    return null
  } catch (error) {
    console.error('[fetchAuthenticatedImage] Image fetch error:', error)
    return null
  }
}
