import { Storage } from "@plasmohq/storage"
import { z } from 'zod'
import type { ABsmartlyConfig } from '~src/types/absmartly'
import type { AIProviderType } from '~src/lib/ai-providers'
import { debugLog } from '~src/utils/debug'
import { validateAPIEndpoint } from '../utils/security'

const ConfigSchema = z.object({
  apiKey: z.string().optional(),
  apiEndpoint: z.string().url(),
  applicationId: z.number().int().positive().optional(),
  authMethod: z.enum(['jwt', 'apikey']).optional(),
  domChangesFieldName: z.string().optional(),
  queryPrefix: z.string().optional(),
  persistQueryToCookie: z.boolean().optional()
})

/**
 * Validates a configuration object using Zod schema
 * @param config - The configuration to validate
 * @returns Validation result with parsed config or error
 */
export function validateConfig(config: any): { valid: boolean; config?: ABsmartlyConfig; error?: string } {
  try {
    const validatedConfig = ConfigSchema.parse(config)
    return { valid: true, config: validatedConfig }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.issues.map(e => e.message).join(', ') }
    }
    return { valid: false, error: String(error) }
  }
}

/**
 * Retrieves the current configuration from storage
 * @param storage - Plasmo Storage instance
 * @param secureStorage - Secure Plasmo Storage instance for API keys
 * @returns The configuration or null if not found
 */
export async function getConfig(
  storage: Storage,
  secureStorage: Storage
): Promise<ABsmartlyConfig | null> {
  const config = await storage.get("absmartly-config") as ABsmartlyConfig | null

  if (config) {
    try {
      const secureApiKey = await secureStorage.get("absmartly-apikey") as string | null
      config.apiKey = secureApiKey || config.apiKey || ''
    } catch (error) {
      debugLog('[Config] Failed to get API key from secure storage:', error)
      config.apiKey = config.apiKey || ''
    }

    try {
      const secureAiApiKey = await secureStorage.get("ai-apikey") as string | null
      config.aiApiKey = secureAiApiKey || config.aiApiKey || ''
      debugLog('[Config] Loaded AI API key from secure storage:', secureAiApiKey ? 'present' : 'missing')
    } catch (error) {
      debugLog('[Config] Failed to get AI API key from secure storage:', error)
      config.aiApiKey = config.aiApiKey || ''
    }

    if (config.apiEndpoint && !validateAPIEndpoint(config.apiEndpoint)) {
      throw new Error('Invalid API endpoint: Only ABsmartly domains are allowed')
    }
  }

  return config
}

/**
 * Initializes configuration with environment variables on startup
 * @param storage - Plasmo Storage instance
 * @param secureStorage - Secure Plasmo Storage instance for API keys
 */
export async function initializeConfig(
  storage: Storage,
  secureStorage: Storage
): Promise<void> {
  debugLog('[Config] Initializing config...')

  const storedConfig = await storage.get("absmartly-config") as ABsmartlyConfig | null
  debugLog('[Config] Stored config:', storedConfig)

  const envApiKey = process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY
  const envApiEndpoint = process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT
  const envApplicationId = process.env.PLASMO_PUBLIC_ABSMARTLY_APPLICATION_ID
  const envAuthMethod = process.env.PLASMO_PUBLIC_ABSMARTLY_AUTH_METHOD
  const envAIProvider = process.env.PLASMO_PUBLIC_ABSMARTLY_AI_PROVIDER as AIProviderType | undefined

  debugLog('[Config] Environment variables:', {
    hasApiKey: !!envApiKey,
    apiEndpoint: envApiEndpoint,
    applicationId: envApplicationId,
    authMethod: envAuthMethod,
    aiProvider: envAIProvider
  })

  let updated = false

  let secureApiKey: string | null = null
  try {
    secureApiKey = await secureStorage.get("absmartly-apikey") as string | null
  } catch (error) {
    debugLog('[Config] Failed to get API key from secure storage during init:', error)
  }

  let secureAiApiKey: string | null = null
  try {
    secureAiApiKey = await secureStorage.get("ai-apikey") as string | null
  } catch (error) {
    debugLog('[Config] Failed to get AI API key from secure storage during init:', error)
  }

  let defaultAuthMethod: 'jwt' | 'apikey' = 'jwt'
  if (envAuthMethod && !storedConfig?.authMethod) {
    defaultAuthMethod = envAuthMethod as 'jwt' | 'apikey'
    debugLog('[Config] Using auth method from environment (no stored config):', envAuthMethod)
  }

  const newConfig: ABsmartlyConfig = {
    apiKey: storedConfig?.apiKey || secureApiKey || '',
    apiEndpoint: storedConfig?.apiEndpoint || '',
    applicationId: storedConfig?.applicationId,
    authMethod: storedConfig?.authMethod || defaultAuthMethod,
    domChangesFieldName: storedConfig?.domChangesFieldName,
    aiProvider: storedConfig?.aiProvider,
    aiApiKey: storedConfig?.aiApiKey || secureAiApiKey || ''
  }

  if (!storedConfig?.apiKey && !secureApiKey && envApiKey) {
    newConfig.apiKey = envApiKey
    await secureStorage.set("absmartly-apikey", envApiKey)
    updated = true
    debugLog('[Config] Using API key from environment and storing securely')
  }

  if (!storedConfig?.apiEndpoint && envApiEndpoint) {
    if (!validateAPIEndpoint(envApiEndpoint)) {
      debugLog('[Config] Invalid API endpoint from environment, skipping:', envApiEndpoint)
    } else {
      newConfig.apiEndpoint = envApiEndpoint
      updated = true
      debugLog('[Config] Using API endpoint from environment')
    }
  }

  if (!storedConfig?.applicationId && envApplicationId) {
    newConfig.applicationId = parseInt(envApplicationId)
    updated = true
    debugLog('[Config] Using application ID from environment')
  }

  if (updated) {
    const configToStore = {
      ...storedConfig,
      ...newConfig,
      apiKey: ''
    }
    await storage.set("absmartly-config", configToStore)
    debugLog('[Config] Updated config with environment variables (API key stored securely)')
  } else {
    debugLog('[Config] No updates needed from environment variables')
  }
}
