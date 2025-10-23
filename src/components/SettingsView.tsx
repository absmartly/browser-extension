import React, { useState, useEffect } from 'react'
import { DEFAULT_CONFIG } from '../config/defaults'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { Header } from './Header'
import { CookieConsentModal } from './CookieConsentModal'
import type { ABsmartlyConfig, ABsmartlyUser } from '~src/types/absmartly'
import { getConfig, setConfig } from '~src/utils/storage'
import axios from 'axios'
import { getAvatarColor, getInitials } from '~src/utils/avatar'
import { AuthenticationStatusSection } from './settings/AuthenticationStatusSection'
import { DOMChangesStorageSection } from './settings/DOMChangesStorageSection'
import { SDKConfigSection } from './settings/SDKConfigSection'
import { QueryStringOverridesSection } from './settings/QueryStringOverridesSection'
import { SDKInjectionSection } from './settings/SDKInjectionSection'
import { Storage } from "@plasmohq/storage"

interface SettingsViewProps {
  onSave: (config: ABsmartlyConfig) => void
  onCancel: () => void
}

export function SettingsView({ onSave, onCancel }: SettingsViewProps) {
  const storage = new Storage()
  const [apiKey, setApiKey] = useState('')
  const [apiEndpoint, setApiEndpoint] = useState('')
  const [applicationName, setApplicationName] = useState('')
  const [domChangesFieldName, setDomChangesFieldName] = useState('__dom_changes')
  const [authMethod, setAuthMethod] = useState<'jwt' | 'apikey'>('jwt') // Default to JWT
  const [sdkWindowProperty, setSdkWindowProperty] = useState('') // Add SDK window property state
  const [sdkEndpoint, setSdkEndpoint] = useState('') // SDK endpoint for collector
  const [queryPrefix, setQueryPrefix] = useState<string>(DEFAULT_CONFIG.queryPrefix) // Query parameter prefix
  const [persistQueryToCookie, setPersistQueryToCookie] = useState(true) // Persist query to cookie
  const [injectSDK, setInjectSDK] = useState(false) // Whether to inject SDK if not detected
  const [sdkUrl, setSdkUrl] = useState('') // Custom SDK URL
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<ABsmartlyUser | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [cookiePermissionGranted, setCookiePermissionGranted] = useState<boolean | null>(null)
  const [showCookieConsentModal, setShowCookieConsentModal] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  // Check permissions when auth method changes
  useEffect(() => {
    checkCookiePermission()
  }, [authMethod])

  // Show modal when no permissions are granted
  useEffect(() => {
    if (cookiePermissionGranted === false && !loading) {
      setShowCookieConsentModal(true)
    }
  }, [authMethod, cookiePermissionGranted, loading])

  const loadConfig = async () => {
    try {
      const config = await getConfig()
      
      // Load from config first
      let loadedApiKey = config?.apiKey || ''
      let loadedApiEndpoint = config?.apiEndpoint || ''
      let loadedApplicationName = config?.applicationName || ''
      let loadedDomChangesFieldName = config?.domChangesFieldName || '__dom_changes'
      let loadedAuthMethod = config?.authMethod || 'jwt' // Default to JWT
      let loadedSdkWindowProperty = config?.sdkWindowProperty || ''
      let loadedSdkEndpoint = config?.sdkEndpoint || ''
      let loadedQueryPrefix = config?.queryPrefix || DEFAULT_CONFIG.queryPrefix
      let loadedPersistQueryToCookie = config?.persistQueryToCookie ?? true
      let loadedInjectSDK = config?.injectSDK ?? false
      let loadedSdkUrl = config?.sdkUrl || ''
      
      
      // In development, auto-load from environment variables if fields are empty
      // Plasmo replaces process.env.PLASMO_PUBLIC_* at build time
      const envApiKey = process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY
      const envApiEndpoint = process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT
      const envApplicationName = process.env.PLASMO_PUBLIC_ABSMARTLY_APPLICATION_NAME
      
      
      // Only use env vars if the loaded values are empty
      if (!loadedApiKey && envApiKey) {
        loadedApiKey = envApiKey
      }
      if (!loadedApiEndpoint && envApiEndpoint) {
        loadedApiEndpoint = envApiEndpoint
      }
      if (!loadedApplicationName && envApplicationName) {
        loadedApplicationName = envApplicationName
      }
      
      
      // Set the final values
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
      
      // Check authentication status if endpoint is set
      if (loadedApiEndpoint) {
        // Store endpoint in localStorage for avatar URLs
        localStorage.setItem('absmartly-endpoint', loadedApiEndpoint)

        // Check permissions first (silently)
        const hasPermission = await checkCookiePermission()
        // Only auto-check auth if permission is granted
        if (hasPermission) {
          await checkAuthStatus(loadedApiEndpoint, {
            apiKey: loadedApiKey,
            authMethod: loadedAuthMethod
          })
        } else {
          console.log('[SettingsView] Permissions not granted, skipping auto auth check')
        }
      }
    } catch (error) {
      debugError('[SettingsView] Failed to load config:', error)
    } finally {
      setLoading(false)
    }
  }

  // Check cookie and host permissions separately
  const checkPermissions = async (): Promise<{ hasCookies: boolean; hasHost: boolean }> => {
    try {
      const hasCookies = await chrome.permissions.contains({
        permissions: ['cookies']
      })

      const hasHost = await chrome.permissions.contains({
        origins: ['https://*.absmartly.com/*']
      })

      console.log('[SettingsView] Permissions:', { hasCookies, hasHost })

      return { hasCookies, hasHost }
    } catch (error) {
      console.error('[SettingsView] Error checking permissions:', error)
      return { hasCookies: false, hasHost: false }
    }
  }

  // Request only missing permissions
  const requestMissingPermissions = async (): Promise<boolean> => {
    const { hasCookies, hasHost } = await checkPermissions()

    if (hasCookies && hasHost) {
      console.log('[SettingsView] All permissions already granted')
      setCookiePermissionGranted(true)
      return true
    }

    // Build request with only missing permissions
    const request: chrome.permissions.Permissions = {}

    if (!hasCookies) {
      request.permissions = ['cookies']
    }

    if (!hasHost) {
      request.origins = ['https://*.absmartly.com/*']
    }

    console.log('[SettingsView] Requesting missing permissions:', request)

    try {
      const granted = await chrome.permissions.request(request)

      if (granted) {
        console.log('[SettingsView] ✅ User granted missing permissions')
        setCookiePermissionGranted(true)
      } else {
        console.log('[SettingsView] ❌ User denied missing permissions')
        setCookiePermissionGranted(false)
      }

      return granted
    } catch (error) {
      console.error('[SettingsView] Error requesting missing permissions:', error)
      setCookiePermissionGranted(false)
      return false
    }
  }

  const checkCookiePermission = async (): Promise<boolean> => {
    const { hasCookies, hasHost } = await checkPermissions()
    const hasAll = hasCookies && hasHost
    setCookiePermissionGranted(hasAll)
    return hasAll
  }

  const requestCookiePermission = async (): Promise<boolean> => {
    return await requestMissingPermissions()
  }

  const checkAuthStatus = async (endpoint: string, configOverride?: { apiKey: string; authMethod: 'jwt' | 'apikey' }) => {
    console.log('[SettingsView] checkAuthStatus called with endpoint:', endpoint)

    // Always request permissions (both host access and cookies for JWT)
    const hasPermission = await requestCookiePermission()
    if (!hasPermission) {
      setUser(null)
      setErrors({ general: 'Permission required to access ABsmartly. Please grant permission and try again.' })
      return
    }

    setCheckingAuth(true)
    try {
      // Send CHECK_AUTH message to background script (which can bypass CORS)
      const configToSend = configOverride ? {
        apiEndpoint: endpoint,
        apiKey: configOverride.apiKey.trim(),
        authMethod: configOverride.authMethod
      } : {
        apiEndpoint: endpoint,
        authMethod: authMethod,
        apiKey: apiKey
      }

      const requestId = `auth_${Date.now()}`
      console.log('[SettingsView] Sending CHECK_AUTH message to background, requestId:', requestId)

      // Set up listener for the response BEFORE sending the message
      // Use single chrome.runtime.onMessage listener (polyfill handles iframe context)
      const responsePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          chrome.runtime.onMessage.removeListener(listener)
          reject(new Error('Auth check timed out (3s)'))
        }, 3000)

        // Single unified listener for chrome.runtime.onMessage
        const listener = (message: any) => {
          if (message.type === 'CHECK_AUTH_RESULT' && message.requestId === requestId) {
            clearTimeout(timeout)
            chrome.runtime.onMessage.removeListener(listener)
            resolve(message.result)
          }
        }

        chrome.runtime.onMessage.addListener(listener)
      })

      // Send the CHECK_AUTH message
      chrome.runtime.sendMessage({
        type: 'CHECK_AUTH',
        requestId: requestId,
        configJson: JSON.stringify(configToSend)
      })

      // Wait for response
      const response: any = await responsePromise
      console.log('[SettingsView] Received CHECK_AUTH response:', response)
      
      if (response.success) {
        console.log('[SettingsView] Auth check successful, user:', response.data?.user)

        const apiUser = response.data?.user
        if (apiUser) {
          // Construct name from first_name and last_name like CreateExperimentDropdown does
          const name = apiUser.first_name || apiUser.last_name
            ? `${apiUser.first_name || ''} ${apiUser.last_name || ''}`.trim()
            : apiUser.email || 'User'

          // Set user with constructed name and authenticated flag
          setUser({ ...apiUser, name, authenticated: true })

          // Set avatar URL if available from background script
          if (apiUser.avatarUrl) {
            setAvatarUrl(apiUser.avatarUrl)
          }
        } else {
          setUser(null)
        }
      } else {
        console.error('[SettingsView] Auth check failed:', response.error)
        setUser(null)

        // Show specific error for permission issues
        if (response.error?.includes('JWT token') || response.error?.includes('permission')) {
          setErrors({
            general: 'Permission required. Please grant access to ABsmartly domains.'
          })
        }
      }
    } catch (error: any) {
      console.error('[SettingsView] Auth check failed:', error)
      setUser(null)

      // Show specific error for timeout
      if (error.message?.includes('timed out')) {
        console.log('[SettingsView] Auth timed out, checking permission status...')

        // Check which permissions are missing
        const { hasCookies, hasHost } = await checkPermissions()

        if (!hasCookies || !hasHost) {
          // At least one permission is missing, show modal to request it
          const missingPerms = []
          if (!hasCookies) missingPerms.push('cookies')
          if (!hasHost) missingPerms.push('host access')

          console.log('[SettingsView] Missing permissions:', missingPerms.join(', '))
          setShowCookieConsentModal(true)
          setErrors({
            general: `Authentication timed out. Missing permissions: ${missingPerms.join(', ')}. Please grant permission to access ABsmartly.`
          })
        } else {
          // All permissions granted, but auth still timed out (different issue)
          console.log('[SettingsView] All permissions granted, but auth still timed out')
          setErrors({
            general: 'Authentication check timed out. Please check your connection and try again.'
          })
        }
      }
    } finally {
      console.log('[SettingsView] checkAuthStatus finally block - setting checkingAuth to false')
      setCheckingAuth(false)
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!apiEndpoint.trim()) {
      newErrors.apiEndpoint = 'API Endpoint is required'
    }

    if (authMethod === 'apikey' && !apiKey.trim()) {
      newErrors.apiKey = 'API Key is required when using API Key authentication'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return

    const config: ABsmartlyConfig = {
      apiKey: apiKey.trim() || undefined,
      apiEndpoint,
      sdkEndpoint: sdkEndpoint.trim() || undefined,
      applicationName: applicationName.trim() || undefined,
      domChangesFieldName: domChangesFieldName.trim() || '__dom_changes',
      authMethod,
      sdkWindowProperty: sdkWindowProperty.trim() || undefined,
      queryPrefix: queryPrefix.trim() || DEFAULT_CONFIG.queryPrefix,
      persistQueryToCookie,
      injectSDK,
      sdkUrl: sdkUrl.trim() || undefined
    }

    try {
      await setConfig(config)
      
      // Store endpoint in localStorage for avatar URLs  
      if (apiEndpoint) {
        localStorage.setItem('absmartly-endpoint', apiEndpoint)
      }
      
      // Navigate away - auth check will happen when user returns to settings via loadConfig
      onSave(config)
    } catch (error) {
      debugError('Failed to save config:', error)
      setErrors({ general: 'Failed to save settings' })
    }
  }

  const handleAuthenticate = () => {
    if (apiEndpoint) {
      // Remove trailing slash and /v1 suffix if present
      const baseUrl = apiEndpoint.replace(/\/+$/, '').replace(/\/v1$/, '')
      chrome.tabs.create({ url: baseUrl })
    }
  }

  const handleCookieConsentGrant = async () => {
    const granted = await requestCookiePermission()
    setShowCookieConsentModal(false)

    if (granted && apiEndpoint) {
      // Small delay to ensure permission propagates to background script
      await new Promise(resolve => setTimeout(resolve, 100))

      // Permission granted, check auth
      await checkAuthStatus(apiEndpoint, { apiKey, authMethod })
    } else if (!granted) {
      setErrors({
        general: 'Cookie permission was denied. Please grant permission to use JWT authentication.'
      })
    }
  }

  const handleCookieConsentDeny = () => {
    setShowCookieConsentModal(false)
    setErrors({
      general: 'Access permission is required to communicate with ABsmartly. Please grant permission to continue.'
    })
  }


  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <div role="status" aria-label="Loading settings">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <CookieConsentModal
        isOpen={showCookieConsentModal}
        onGrant={handleCookieConsentGrant}
        onDeny={handleCookieConsentDeny}
      />

      <Header
        title="Settings"
        onBack={onCancel}
        config={apiEndpoint ? { apiEndpoint } : undefined}
      />
      
      {errors.general && (
        <div role="alert" className="bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm">
          {errors.general}
        </div>
      )}

      {/* Authentication Status */}
      <AuthenticationStatusSection
        checkingAuth={checkingAuth}
        user={user}
        avatarUrl={avatarUrl}
        apiEndpoint={apiEndpoint}
        apiKey={apiKey}
        authMethod={authMethod}
        onCheckAuth={checkAuthStatus}
        onAuthenticate={handleAuthenticate}
      />
      
      <Input
        label="ABsmartly Endpoint"
        type="url"
        value={apiEndpoint}
        onChange={(e) => setApiEndpoint(e.target.value)}
        placeholder="https://api.absmartly.com"
        error={errors.apiEndpoint}
      />
      
      {/* Authentication Method Toggle */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Authentication Method</label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              id="auth-method-jwt"
              type="radio"
              value="jwt"
              checked={authMethod === 'jwt'}
              onChange={(e) => setAuthMethod(e.target.value as 'jwt')}
              className="mr-2"
            />
            <span className="text-sm">JWT from Browser Cookie (Default)</span>
          </label>
          <label className="flex items-center">
            <input
              id="auth-method-apikey"
              type="radio"
              value="apikey"
              checked={authMethod === 'apikey'}
              onChange={(e) => setAuthMethod(e.target.value as 'apikey')}
              className="mr-2"
            />
            <span className="text-sm">API Key</span>
          </label>
        </div>
        <p className="text-xs text-gray-500">
          {authMethod === 'jwt' 
            ? 'Uses JWT token from browser cookies. You must be logged into ABsmartly.'
            : 'Uses the API key configured below for authentication.'}
        </p>
      </div>
      
      <div>
        <Input
          id="api-key-input"
          label={`API Key ${authMethod === 'apikey' ? '(Required)' : '(Optional)'}`}
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your API key"
          error={errors.apiKey}
          showPasswordToggle={true}
        />
        <p className="mt-1 text-xs text-gray-500">
          {authMethod === 'jwt'
            ? 'Not used when JWT is selected. You must be logged into ABsmartly in your browser.'
            : 'API key will be used for all authentication requests.'}
        </p>
      </div>
      
      <Input
        label="Application Name (Optional)"
        type="text"
        value={applicationName}
        onChange={(e) => setApplicationName(e.target.value)}
        placeholder="e.g., my-app, website, mobile-app"
        error={errors.applicationName}
      />
      
      {/* DOM Changes Storage Settings */}
      <DOMChangesStorageSection
        domChangesFieldName={domChangesFieldName}
        onDomChangesFieldNameChange={setDomChangesFieldName}
      />
      
      {/* SDK Configuration */}
      <SDKConfigSection
        sdkWindowProperty={sdkWindowProperty}
        sdkEndpoint={sdkEndpoint}
        onSdkWindowPropertyChange={setSdkWindowProperty}
        onSdkEndpointChange={setSdkEndpoint}
      />

      {/* Query String Override Configuration */}
      <QueryStringOverridesSection
        queryPrefix={queryPrefix}
        persistQueryToCookie={persistQueryToCookie}
        onQueryPrefixChange={setQueryPrefix}
        onPersistQueryToCookieChange={setPersistQueryToCookie}
      />

      {/* SDK Injection Settings */}
      <SDKInjectionSection
        injectSDK={injectSDK}
        sdkUrl={sdkUrl}
        onInjectSDKChange={setInjectSDK}
        onSdkUrlChange={setSdkUrl}
      />

      <div className="flex gap-2 pt-2">
        <Button id="save-settings-button" onClick={handleSave} variant="primary">
          Save Settings
        </Button>
        <Button id="cancel-button" onClick={onCancel} variant="secondary">
          Cancel
        </Button>
      </div>
    </div>
  )
}