import type { AIProviderType } from "./base"
import { getProviderOrigins } from "./registry"

const PERMISSION_TIMEOUT_MS = 5000

export async function hasProviderPermissions(
  providerId: AIProviderType,
  customEndpoint?: string
): Promise<boolean> {
  const origins = getProviderOrigins(providerId, customEndpoint)
  if (origins.length === 0) return true

  try {
    return await chrome.permissions.contains({ origins })
  } catch {
    return false
  }
}

export async function ensureProviderPermissions(
  providerId: AIProviderType,
  customEndpoint?: string
): Promise<boolean> {
  const origins = getProviderOrigins(providerId, customEndpoint)
  if (origins.length === 0) return true

  try {
    const alreadyGranted = await chrome.permissions.contains({ origins })
    if (alreadyGranted) return true

    const result = await Promise.race([
      chrome.permissions.request({ origins }),
      new Promise<false>((resolve) =>
        setTimeout(() => resolve(false), PERMISSION_TIMEOUT_MS)
      )
    ])
    return result
  } catch {
    return false
  }
}
