import { Storage } from "@plasmohq/storage"
import { z } from 'zod'
import type { ABsmartlyConfig } from '~src/types/absmartly'
import type { AIProviderType } from '~src/lib/ai-providers'
import { debugLog } from '~src/utils/debug'
import { validateAPIEndpoint } from '../utils/security'
import { unsafeAPIEndpoint, unsafeApplicationId } from '~src/types/branded'
import { CONFIG_INITIALIZATION_KEY } from './config-initialization-key'

const ConfigSchema = z.object({
  apiKey: z.string().optional(),
  apiEndpoint: z.string().url(),
  applicationId: z.number().int().positive().optional(),
  applicationName: z.string().optional(),
  authMethod: z.enum(['jwt', 'apikey']).optional(),
  environment: z.number().int().optional(),
  aiProvider: z.enum(['claude-subscription', 'codex', 'anthropic-api', 'openai-api', 'openrouter-api', 'gemini-api']).optional(),
  aiModel: z.string().optional(),
  aiApiKey: z.string().optional(),
  llmModel: z.string().optional(),
  providerModels: z.record(z.string(), z.string()).optional(),
  providerEndpoints: z.record(z.string(), z.string()).optional(),
  sdkApiKey: z.string().optional(),
  sdkApplicationName: z.string().optional(),
  sdkWindowProperty: z.string().optional(),
  domChangesFieldName: z.string().optional(),
  queryPrefix: z.string().optional(),
  persistQueryToCookie: z.boolean().optional()
})

export function validateConfig(config: any): { valid: boolean; config?: ABsmartlyConfig; error?: string } {
  try {
    const validatedConfig = ConfigSchema.parse(config)
    return { valid: true, config: validatedConfig as ABsmartlyConfig }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.issues.map(e => e.message).join(', ') }
    }
    return { valid: false, error: String(error) }
  }
}

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
      console.error('[Config] CRITICAL: Failed to access secure storage for API key:', error)
      console.error('[Config] This may indicate browser storage corruption or permission issues')
      config.apiKey = config.apiKey || ''
    }

    try {
      const secureAiApiKey = await secureStorage.get("ai-apikey") as string | null
      config.aiApiKey = secureAiApiKey || config.aiApiKey || ''
      debugLog('[Config] Loaded AI API key from secure storage:', secureAiApiKey ? 'present' : 'missing')
    } catch (error) {
      console.error('[Config] CRITICAL: Failed to access secure storage for AI API key:', error)
      console.error('[Config] This may indicate browser storage corruption or permission issues')
      config.aiApiKey = config.aiApiKey || ''
    }

    if (config.apiEndpoint && !validateAPIEndpoint(config.apiEndpoint)) {
      throw new Error('Invalid API endpoint: Only ABsmartly domains are allowed')
    }
  }

  return config
}

export async function initializeConfig(
  storage: Storage,
  secureStorage: Storage
): Promise<void> {
  debugLog('[Config] Initializing config...')

  const storedConfig = await storage.get("absmartly-config") as ABsmartlyConfig | null
  // SECURITY: Never log API keys, even partially - redact sensitive fields
  debugLog('[Config] Stored config:', storedConfig ? {
    ...storedConfig,
    apiKey: storedConfig.apiKey ? '[REDACTED]' : undefined,
    aiApiKey: storedConfig.aiApiKey ? '[REDACTED]' : undefined
  } : null)

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
    console.error('[Config] CRITICAL: Failed to access secure storage during initialization:', error)
    console.error('[Config] API key may not be available - check browser storage settings')
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

  const newConfig = {
    apiKey: storedConfig?.apiKey || secureApiKey || '',
    apiEndpoint: storedConfig?.apiEndpoint || '',
    applicationId: storedConfig?.applicationId,
    authMethod: storedConfig?.authMethod || defaultAuthMethod,
    domChangesFieldName: storedConfig?.domChangesFieldName,
    aiProvider: storedConfig?.aiProvider,
    aiApiKey: storedConfig?.aiApiKey || secureAiApiKey || ''
  } as ABsmartlyConfig

  // Check before any fallback key write as well: settings may have saved a
  // different key while the initial secure-storage reads were outstanding.
  const configBeforeDefaults = await storage.get("absmartly-config") as ABsmartlyConfig | null
  if (JSON.stringify(configBeforeDefaults) !== JSON.stringify(storedConfig)) {
    debugLog('[Config] Configuration changed during initialization; preserving newer settings and keys')
    return
  }

  if (!storedConfig?.apiKey && !secureApiKey && envApiKey) {
    // A key-only settings save can leave the config JSON unchanged.
    if (!await secureStorage.get("absmartly-apikey")) {
      newConfig.apiKey = envApiKey
      await secureStorage.set("absmartly-apikey", envApiKey)
      updated = true
      debugLog('[Config] Using API key from environment and storing securely')
    }
  }

  if (!storedConfig?.apiEndpoint && envApiEndpoint) {
    if (!validateAPIEndpoint(envApiEndpoint)) {
      debugLog('[Config] Invalid API endpoint from environment, skipping:', envApiEndpoint)
    } else {
      newConfig.apiEndpoint = unsafeAPIEndpoint(envApiEndpoint)
      updated = true
      debugLog('[Config] Using API endpoint from environment')
    }
  }

  if (!storedConfig?.applicationId && envApplicationId) {
    newConfig.applicationId = unsafeApplicationId(parseInt(envApplicationId))
    updated = true
    debugLog('[Config] Using application ID from environment')
  }

  if (updated) {
    // Initialization crosses asynchronous storage reads. A settings save (or
    // fixture seed) may have replaced the original snapshot in the meantime.
    // Never restore startup defaults over that newer configuration.
    const currentConfig = await storage.get("absmartly-config") as ABsmartlyConfig | null
    if (JSON.stringify(currentConfig) !== JSON.stringify(storedConfig)) {
      debugLog('[Config] Configuration changed during initialization; preserving newer settings')
      return
    }
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

// Startup defaults are written after asynchronous reads, so a config written
// by another context before that write can be overwritten. Expose the settled
// promise on the worker global so automation that seeds storage can wait for
// initialization to finish first.
export function startConfigInitialization(
  storage: Storage,
  secureStorage: Storage,
  onError: (error: unknown) => void
): Promise<void> {
  const initialization = initializeConfig(storage, secureStorage).catch(onError)
  ;(globalThis as Record<string, unknown>)[CONFIG_INITIALIZATION_KEY] = initialization
  return initialization
}
