import { useState, useEffect } from 'react'
import { DEFAULT_CONFIG } from '../config/defaults'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'
import type { ABsmartlyConfig, ABsmartlyUser } from '~src/types/absmartly'
import type { AIProviderType } from '~src/lib/ai-providers'
import { getConfig, setConfig } from '~src/utils/storage'
import axios from 'axios'
import { sendToBackground } from '~src/lib/messaging'

export function useSettingsForm() {
  const [apiKey, setApiKey] = useState('')
  const [apiEndpoint, setApiEndpoint] = useState('')
  const [applicationName, setApplicationName] = useState('')
  const [domChangesFieldName, setDomChangesFieldName] = useState('__dom_changes')
  const [authMethod, setAuthMethod] = useState<'jwt' | 'apikey'>('jwt')
  const [sdkWindowProperty, setSdkWindowProperty] = useState('')
  const [queryPrefix, setQueryPrefix] = useState<string>(DEFAULT_CONFIG.queryPrefix)
  const [persistQueryToCookie, setPersistQueryToCookie] = useState(true)
  const [aiProvider, setAiProvider] = useState<AIProviderType>('claude-subscription')
  const [aiApiKey, setAiApiKey] = useState('')
  const [llmModel, setLlmModel] = useState('sonnet')
  const [providerModels, setProviderModels] = useState<Record<string, string>>({})
  const [providerEndpoints, setProviderEndpoints] = useState<Record<string, string>>({})
  const [customEndpoint, setCustomEndpoint] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<ABsmartlyUser | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [cookiePermissionGranted, setCookiePermissionGranted] = useState<boolean | null>(null)
  const [showCookieConsentModal, setShowCookieConsentModal] = useState(false)
  const [configLoadError, setConfigLoadError] = useState<string | null>(null)

  const checkCookiePermission = async (): Promise<boolean> => {
    const permissions = await chrome.permissions.getAll()
    const hasCookies = permissions.permissions?.includes('cookies') ?? false
    setCookiePermissionGranted(hasCookies)
    return hasCookies
  }

  const loadConfig = async () => {
    try {
      const config = await getConfig()

      let loadedApiKey = config?.apiKey || ''
      let loadedApiEndpoint = config?.apiEndpoint || ''
      let loadedApplicationName = config?.applicationName || ''
      let loadedDomChangesFieldName = config?.domChangesFieldName || '__dom_changes'
      let loadedAuthMethod = config?.authMethod || 'jwt'
      let loadedSdkWindowProperty = config?.sdkWindowProperty || ''
      let loadedQueryPrefix = config?.queryPrefix || DEFAULT_CONFIG.queryPrefix
      let loadedPersistQueryToCookie = config?.persistQueryToCookie ?? true
      let loadedAiProvider = config?.aiProvider || 'claude-subscription'
      let loadedAiApiKey = config?.aiApiKey || ''
      let loadedProviderModels = config?.providerModels || {}
      let loadedProviderEndpoints = config?.providerEndpoints || {}

      if (config?.llmModel && !loadedProviderModels[loadedAiProvider]) {
        loadedProviderModels[loadedAiProvider] = config.llmModel
      }

      let loadedLlmModel = loadedProviderModels[loadedAiProvider] || 'sonnet'

      let loadedCustomEndpoint = loadedProviderEndpoints[loadedAiProvider] || ''

      const envApiKey = process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY
      const envApiEndpoint = process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT
      const envApplicationName = process.env.PLASMO_PUBLIC_ABSMARTLY_APPLICATION_NAME

      if (!loadedApiKey && envApiKey) {
        loadedApiKey = envApiKey
      }
      if (!loadedApiEndpoint && envApiEndpoint) {
        loadedApiEndpoint = envApiEndpoint
      }
      if (!loadedApplicationName && envApplicationName) {
        loadedApplicationName = envApplicationName
      }

      setApiKey(loadedApiKey)
      setApiEndpoint(loadedApiEndpoint)
      setApplicationName(loadedApplicationName)
      setDomChangesFieldName(loadedDomChangesFieldName)
      setAuthMethod(loadedAuthMethod)
      setSdkWindowProperty(loadedSdkWindowProperty)
      setQueryPrefix(loadedQueryPrefix)
      setPersistQueryToCookie(loadedPersistQueryToCookie)
      setAiProvider(loadedAiProvider)
      setAiApiKey(loadedAiApiKey)
      setProviderModels(loadedProviderModels)
      setLlmModel(loadedLlmModel)
      setProviderEndpoints(loadedProviderEndpoints)
      setCustomEndpoint(loadedCustomEndpoint)

      const hasStoredConfig = (config?.apiKey || config?.apiEndpoint)
      if (!hasStoredConfig && envApiKey && envApiEndpoint) {
        const autoConfig = {
          apiKey: loadedApiKey.trim() || undefined,
          apiEndpoint: loadedApiEndpoint,
          applicationName: loadedApplicationName.trim() || undefined,
          domChangesFieldName: loadedDomChangesFieldName.trim() || '__dom_changes',
          authMethod: loadedAuthMethod,
          sdkWindowProperty: loadedSdkWindowProperty.trim() || undefined,
          queryPrefix: loadedQueryPrefix.trim() || DEFAULT_CONFIG.queryPrefix,
          persistQueryToCookie: loadedPersistQueryToCookie,
          aiProvider: loadedAiProvider,
          aiApiKey: loadedAiApiKey.trim() || undefined,
          providerModels: loadedProviderModels,
          providerEndpoints: loadedProviderEndpoints
        } as ABsmartlyConfig
        await setConfig(autoConfig)
        debugLog('[useSettingsForm] Auto-saved config from environment variables')
      }

      if (loadedApiEndpoint) {
        localStorage.setItem('absmartly-endpoint', loadedApiEndpoint)

        const hasPermission = await checkCookiePermission()
        if (hasPermission) {
          await checkAuthStatus(loadedApiEndpoint, {
            apiKey: loadedApiKey,
            authMethod: loadedAuthMethod
          })
        }
      }

      setLoading(false)
    } catch (error) {
      debugError('[useSettingsForm] Failed to load config:', error)
      setConfigLoadError(error instanceof Error ? error.message : 'Failed to load settings')
      setLoading(false)
    }
  }

  const checkAuthStatus = async (endpoint: string, configOverride?: { apiKey: string; authMethod: 'jwt' | 'apikey' }) => {
    try {
      setCheckingAuth(true)

      const response = await sendToBackground({
        type: 'CHECK_AUTH',
        endpoint,
        apiKey: configOverride ? configOverride.apiKey.trim() : apiKey,
        authMethod: configOverride ? configOverride.authMethod : authMethod,
        configOverride: configOverride ? {
          apiKey: configOverride.apiKey.trim(),
          authMethod: configOverride.authMethod
        } : {
          apiKey: apiKey
        }
      })

      const data = response.data as Record<string, unknown> | undefined
      if (response.success && data?.user) {
        const user = data.user as ABsmartlyUser
        setUser(user)
        if (user.avatarUrl) {
          setAvatarUrl(user.avatarUrl)
        }
      } else {
        setUser(null)
        setAvatarUrl(null)
      }
    } catch (error) {
      debugError('[useSettingsForm] Auth check failed:', error)
      setUser(null)
      setAvatarUrl(null)
    } finally {
      setCheckingAuth(false)
    }
  }

  const normalizeEndpoint = (endpoint: string): string => {
    let normalized = endpoint.trim()
    if (normalized && !normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${normalized}`
    }
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1)
    }
    return normalized
  }

  const validateEndpointReachable = async (endpoint: string): Promise<boolean> => {
    let normalized = normalizeEndpoint(endpoint)
    normalized = normalized.replace(/\/v1$/, '')

    try {
      debugLog('Validating endpoint:', normalized)
      const response = await axios.get(`${normalized}/auth/current-user`, {
        timeout: 5000,
        validateStatus: (status) => status === 200 || status === 401 || status === 403
      })

      if (response.status === 200 || response.status === 401 || response.status === 403) {
        debugLog('Endpoint is reachable:', normalized)
        return true
      } else {
        debugWarn('Endpoint returned unexpected status:', response.status)
        return false
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        debugWarn('Endpoint validation failed:', error.message)
      } else {
        debugWarn('Endpoint validation failed with unknown error:', error)
      }
      return false
    }
  }

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {}

    if (!apiEndpoint.trim()) {
      newErrors.apiEndpoint = 'API Endpoint is required'
    }

    if (apiEndpoint.trim()) {
      const isReachable = await validateEndpointReachable(apiEndpoint)
      if (!isReachable) {
        newErrors.apiEndpoint = `Cannot reach endpoint. Please check the URL and your network connection.`
      }
    }

    if (authMethod === 'apikey' && !apiKey.trim()) {
      newErrors.apiKey = 'API Key is required when using API Key authentication'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const buildConfig = (): ABsmartlyConfig => {
    const updatedProviderModels = {
      ...providerModels,
      [aiProvider]: llmModel
    }

    const updatedProviderEndpoints = {
      ...providerEndpoints
    }
    if (customEndpoint.trim()) {
      updatedProviderEndpoints[aiProvider] = customEndpoint.trim()
    } else {
      delete updatedProviderEndpoints[aiProvider]
    }

    return {
      apiKey: apiKey.trim() || undefined,
      apiEndpoint: normalizeEndpoint(apiEndpoint),
      applicationName: applicationName.trim() || undefined,
      domChangesFieldName: domChangesFieldName.trim() || '__dom_changes',
      authMethod,
      sdkWindowProperty: sdkWindowProperty.trim() || undefined,
      queryPrefix: queryPrefix.trim() || DEFAULT_CONFIG.queryPrefix,
      persistQueryToCookie,
      aiProvider,
      aiApiKey: aiApiKey.trim() || undefined,
      providerModels: updatedProviderModels,
      providerEndpoints: updatedProviderEndpoints
    } as ABsmartlyConfig
  }

  const requestMissingPermissions = async (): Promise<boolean> => {
    const normalizedEndpoint = normalizeEndpoint(apiEndpoint)
    const endpointHost = new URL(normalizedEndpoint).origin + '/'

    const granted = await chrome.permissions.request({
      permissions: ['cookies'],
      origins: [endpointHost]
    })

    if (!granted) {
      debugWarn('User denied permissions')
      return false
    }

    return true
  }

  return {
    apiKey,
    setApiKey,
    apiEndpoint,
    setApiEndpoint,
    applicationName,
    setApplicationName,
    domChangesFieldName,
    setDomChangesFieldName,
    authMethod,
    setAuthMethod,
    sdkWindowProperty,
    setSdkWindowProperty,
    queryPrefix,
    setQueryPrefix,
    persistQueryToCookie,
    setPersistQueryToCookie,
    aiProvider,
    setAiProvider,
    aiApiKey,
    setAiApiKey,
    llmModel,
    setLlmModel,
    providerModels,
    setProviderModels,
    customEndpoint,
    setCustomEndpoint,
    providerEndpoints,
    setProviderEndpoints,
    errors,
    setErrors,
    loading,
    user,
    checkingAuth,
    avatarUrl,
    cookiePermissionGranted,
    showCookieConsentModal,
    setShowCookieConsentModal,
    configLoadError,
    loadConfig,
    checkAuthStatus,
    normalizeEndpoint,
    validateEndpointReachable,
    validateForm,
    buildConfig,
    requestCookiePermission: requestMissingPermissions
  }
}
