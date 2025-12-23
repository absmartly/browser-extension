import { useState, useEffect } from 'react'
import { DEFAULT_CONFIG } from '../config/defaults'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'
import type { ABsmartlyConfig, ABsmartlyUser } from '~src/types/absmartly'
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
  const [sdkEndpoint, setSdkEndpoint] = useState('')
  const [queryPrefix, setQueryPrefix] = useState<string>(DEFAULT_CONFIG.queryPrefix)
  const [persistQueryToCookie, setPersistQueryToCookie] = useState(true)
  const [injectSDK, setInjectSDK] = useState(false)
  const [sdkUrl, setSdkUrl] = useState('')
  const [aiProvider, setAiProvider] = useState<'claude-subscription' | 'anthropic-api' | 'openai-api' | 'anthropic' | 'openai'>('claude-subscription')
  const [aiApiKey, setAiApiKey] = useState('')
  const [llmModel, setLlmModel] = useState('sonnet')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<ABsmartlyUser | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [cookiePermissionGranted, setCookiePermissionGranted] = useState<boolean | null>(null)
  const [showCookieConsentModal, setShowCookieConsentModal] = useState(false)

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
      let loadedSdkEndpoint = config?.sdkEndpoint || ''
      let loadedQueryPrefix = config?.queryPrefix || DEFAULT_CONFIG.queryPrefix
      let loadedPersistQueryToCookie = config?.persistQueryToCookie ?? true
      let loadedInjectSDK = config?.injectSDK ?? false
      let loadedSdkUrl = config?.sdkUrl || ''
      let loadedAiProvider = config?.aiProvider || 'claude-subscription'
      let loadedAiApiKey = config?.aiApiKey || ''
      let loadedLlmModel = config?.llmModel || 'sonnet'

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
      setSdkEndpoint(loadedSdkEndpoint)
      setQueryPrefix(loadedQueryPrefix)
      setPersistQueryToCookie(loadedPersistQueryToCookie)
      setInjectSDK(loadedInjectSDK)
      setSdkUrl(loadedSdkUrl)
      setAiProvider(loadedAiProvider)
      setAiApiKey(loadedAiApiKey)
      setLlmModel(loadedLlmModel)

      const hasStoredConfig = (config?.apiKey || config?.apiEndpoint)
      if (!hasStoredConfig && envApiKey && envApiEndpoint) {
        const autoConfig: ABsmartlyConfig = {
          apiKey: loadedApiKey.trim() || undefined,
          apiEndpoint: loadedApiEndpoint,
          applicationName: loadedApplicationName.trim() || undefined,
          domChangesFieldName: loadedDomChangesFieldName.trim() || '__dom_changes',
          authMethod: loadedAuthMethod,
          sdkWindowProperty: loadedSdkWindowProperty.trim() || undefined,
          sdkEndpoint: loadedSdkEndpoint.trim() || undefined,
          queryPrefix: loadedQueryPrefix.trim() || DEFAULT_CONFIG.queryPrefix,
          persistQueryToCookie: loadedPersistQueryToCookie,
          injectSDK: loadedInjectSDK,
          sdkUrl: loadedSdkUrl.trim() || undefined,
          aiProvider: loadedAiProvider,
          aiApiKey: loadedAiApiKey.trim() || undefined,
          llmModel: loadedLlmModel || 'sonnet'
        }
        await setConfig(autoConfig)
        console.log('[useSettingsForm] Auto-saved config from environment variables')
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

      if (response.success && response.user) {
        setUser(response.user)
        if (response.user.avatar_url) {
          setAvatarUrl(response.user.avatar_url)
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
    const normalized = normalizeEndpoint(endpoint)
    try {
      debugLog('Validating endpoint:', normalized)
      const response = await axios.get(`${normalized}/version`, {
        timeout: 5000
      })

      if (response.status === 200) {
        debugLog('Endpoint is reachable:', normalized)
        return true
      } else {
        debugWarn('Endpoint returned non-200 status:', response.status)
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

    if (!applicationName.trim()) {
      newErrors.applicationName = 'Application Name is required'
    }

    if (authMethod === 'apikey' && !apiKey.trim()) {
      newErrors.apiKey = 'API Key is required when using API Key authentication'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const buildConfig = (): ABsmartlyConfig => {
    return {
      apiKey: apiKey.trim() || undefined,
      apiEndpoint: normalizeEndpoint(apiEndpoint),
      sdkEndpoint: sdkEndpoint.trim() || undefined,
      applicationName: applicationName.trim() || undefined,
      domChangesFieldName: domChangesFieldName.trim() || '__dom_changes',
      authMethod,
      sdkWindowProperty: sdkWindowProperty.trim() || undefined,
      queryPrefix: queryPrefix.trim() || DEFAULT_CONFIG.queryPrefix,
      persistQueryToCookie,
      injectSDK,
      sdkUrl: sdkUrl.trim() || undefined,
      aiProvider,
      aiApiKey: aiApiKey.trim() || undefined,
      llmModel: llmModel || 'sonnet'
    }
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

  const requestCookiePermission = async (): Promise<boolean> => {
    return requestMissingPermissions()
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
    sdkEndpoint,
    setSdkEndpoint,
    queryPrefix,
    setQueryPrefix,
    persistQueryToCookie,
    setPersistQueryToCookie,
    injectSDK,
    setInjectSDK,
    sdkUrl,
    setSdkUrl,
    aiProvider,
    setAiProvider,
    aiApiKey,
    setAiApiKey,
    llmModel,
    setLlmModel,
    errors,
    setErrors,
    loading,
    user,
    checkingAuth,
    avatarUrl,
    cookiePermissionGranted,
    showCookieConsentModal,
    setShowCookieConsentModal,
    loadConfig,
    checkAuthStatus,
    normalizeEndpoint,
    validateEndpointReachable,
    validateForm,
    buildConfig,
    requestCookiePermission
  }
}
