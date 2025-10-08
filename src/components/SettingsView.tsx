import React, { useState, useEffect } from 'react'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { Header } from './Header'
import type { ABsmartlyConfig, ABsmartlyUser } from '~src/types/absmartly'
import { getConfig, setConfig } from '~src/utils/storage'
import axios from 'axios'
import { getAvatarColor, getInitials } from '~src/utils/avatar'

interface SettingsViewProps {
  onSave: (config: ABsmartlyConfig) => void
  onCancel: () => void
}

export function SettingsView({ onSave, onCancel }: SettingsViewProps) {
  const [apiKey, setApiKey] = useState('')
  const [apiEndpoint, setApiEndpoint] = useState('')
  const [applicationName, setApplicationName] = useState('')
  const [domChangesStorageType, setDomChangesStorageType] = useState<'variable' | 'custom_field'>('variable')
  const [domChangesFieldName, setDomChangesFieldName] = useState('__dom_changes')
  const [authMethod, setAuthMethod] = useState<'jwt' | 'apikey'>('jwt') // Default to JWT
  const [sdkWindowProperty, setSdkWindowProperty] = useState('') // Add SDK window property state
  const [sdkEndpoint, setSdkEndpoint] = useState('') // SDK endpoint for collector
  const [queryPrefix, setQueryPrefix] = useState('_exp_') // Query parameter prefix
  const [persistQueryToCookie, setPersistQueryToCookie] = useState(true) // Persist query to cookie
  const [injectSDK, setInjectSDK] = useState(false) // Whether to inject SDK if not detected
  const [sdkUrl, setSdkUrl] = useState('') // Custom SDK URL
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<ABsmartlyUser | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(false)
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const config = await getConfig()
      
      // Load from config first
      let loadedApiKey = config?.apiKey || ''
      let loadedApiEndpoint = config?.apiEndpoint || ''
      let loadedApplicationName = config?.applicationName || ''
      let loadedDomChangesStorageType = config?.domChangesStorageType || 'variable'
      let loadedDomChangesFieldName = config?.domChangesFieldName || '__dom_changes'
      let loadedAuthMethod = config?.authMethod || 'jwt' // Default to JWT
      let loadedSdkWindowProperty = config?.sdkWindowProperty || ''
      let loadedSdkEndpoint = config?.sdkEndpoint || ''
      let loadedQueryPrefix = config?.queryPrefix || '_exp_'
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
      setDomChangesStorageType(loadedDomChangesStorageType)
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
        checkAuthStatus(loadedApiEndpoint)
      }
    } catch (error) {
      debugError('[SettingsView] Failed to load config:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkAuthStatus = async (endpoint: string) => {
    setCheckingAuth(true)
    try {
      // Send message to background script to check auth
      const response = await chrome.runtime.sendMessage({
        type: 'CHECK_AUTH'
      })
      
      if (response.success && response.data) {
        
        // Check if user data is nested
        const userData = response.data.user || response.data
        
        // Handle picture URL - construct it from base_url
        let pictureUrl = null
        
        // Ensure endpoint doesn't have trailing slash or /v1 suffix for avatar URLs
        const baseEndpoint = endpoint.replace(/\/+$/, '').replace(/\/v1$/, '')
        
        // Check for avatar object
        const userAvatar = userData.avatar
        
        if (userAvatar && typeof userAvatar === 'object' && userAvatar.base_url) {
          // Construct the full avatar URL: endpoint + base_url + /crop/64x64.webp
          pictureUrl = `${baseEndpoint}${userAvatar.base_url}/crop/64x64.webp`
        }
        
        // Create user object - handle both full user data and basic authenticated status
        const userObject = {
          id: userData.id || userData.user_id || 'authenticated',
          email: userData.email || 'Authenticated User',
          name: userData.first_name && userData.last_name 
            ? `${userData.first_name} ${userData.last_name}`
            : userData.first_name || userData.last_name || userData.email || 'Authenticated User',
          picture: pictureUrl,
          authenticated: userData.authenticated !== false // Default to true if not explicitly false
        }
        setUser(userObject)
        
        // Fetch avatar image through background worker if URL exists
        if (pictureUrl) {
          chrome.runtime.sendMessage({
            type: 'FETCH_AVATAR',
            url: pictureUrl
          }).then(avatarResponse => {
            if (avatarResponse.success && avatarResponse.dataUrl) {
              setAvatarDataUrl(avatarResponse.dataUrl)
            } else {
              debugError('Failed to fetch avatar:', avatarResponse.error)
            }
          }).catch(err => {
            debugError('Error fetching avatar:', err)
          })
        }
      } else {
        setUser(null)
        setAvatarDataUrl(null)
      }
    } catch (error) {
      setUser(null)
      setAvatarDataUrl(null)
    } finally {
      setCheckingAuth(false)
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    // API Key is required only when authMethod is 'apikey'
    if (authMethod === 'apikey' && !apiKey.trim()) {
      newErrors.apiKey = 'API Key is required when using API Key authentication'
    }
    
    if (!apiEndpoint.trim()) {
      newErrors.apiEndpoint = 'ABsmartly Endpoint is required'
    } else if (!isValidUrl(apiEndpoint)) {
      newErrors.apiEndpoint = 'Please enter a valid URL'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const isValidUrl = (url: string) => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  const handleSave = async () => {
    if (!validateForm()) return

    const config: ABsmartlyConfig = {
      apiKey: apiKey.trim() || undefined,
      apiEndpoint,
      sdkEndpoint: sdkEndpoint.trim() || undefined,
      applicationName: applicationName.trim() || undefined,
      domChangesStorageType,
      domChangesFieldName: domChangesFieldName.trim() || '__dom_changes',
      authMethod,
      sdkWindowProperty: sdkWindowProperty.trim() || undefined,
      queryPrefix: queryPrefix.trim() || '_exp_',
      persistQueryToCookie,
      injectSDK,
      sdkUrl: sdkUrl.trim() || undefined
    }

    try {
      await setConfig(config)
      // Store endpoint in localStorage for avatar URLs
      if (apiEndpoint) {
        localStorage.setItem('absmartly-endpoint', apiEndpoint)
        checkAuthStatus(apiEndpoint)
      }
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
      <div className="bg-gray-50 p-3 rounded-md">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-gray-700">Authentication Status</div>
          {apiEndpoint && !checkingAuth && (
            <Button
              onClick={() => checkAuthStatus(apiEndpoint)}
              size="sm"
              variant="secondary"
              className="text-xs"
            >
              Refresh
            </Button>
          )}
        </div>
        {checkingAuth ? (
          <div className="flex items-center text-sm text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            Checking authentication...
          </div>
        ) : user && user.authenticated ? (
          <div>
            <div className="flex items-center space-x-3">
              <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                {(avatarDataUrl || user.picture) ? (
                  <img 
                    src={avatarDataUrl || user.picture} 
                    alt={user.name || 'User'} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      debugError('Avatar failed to load:', avatarDataUrl || user.picture)
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                ) : (
                  <div 
                    className="w-full h-full flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: getAvatarColor(user.name || 'User') }}
                  >
                    {getInitials(user.name || 'User')}
                  </div>
                )}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">{user.name || 'User'}</div>
                <div className="text-xs text-gray-600">{user.email || 'No email'}</div>
              </div>
            </div>
            {/* Debug info - only show in development */}
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-2">
                <summary className="text-xs text-gray-500 cursor-pointer">Debug info</summary>
                <pre className="text-xs mt-1 p-2 bg-gray-100 rounded overflow-auto">
{JSON.stringify(user, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm text-gray-600">Not authenticated</div>
            {apiEndpoint && (
              <Button 
                onClick={handleAuthenticate}
                size="sm"
                variant="secondary"
              >
                Authenticate in ABsmartly
              </Button>
            )}
          </div>
        )}
      </div>
      
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
      <div className="space-y-3 border-t pt-4 mt-4">
        <h3 className="text-sm font-medium text-gray-700">DOM Changes Storage</h3>
        
        <div className="space-y-2">
          <label className="text-sm text-gray-600">Storage Type</label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="variable"
                checked={domChangesStorageType === 'variable'}
                onChange={(e) => setDomChangesStorageType(e.target.value as 'variable')}
                className="mr-2"
              />
              <span className="text-sm">Variable (Default)</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="custom_field"
                checked={domChangesStorageType === 'custom_field'}
                onChange={(e) => setDomChangesStorageType(e.target.value as 'custom_field')}
                className="mr-2"
              />
              <span className="text-sm">Custom Field</span>
            </label>
          </div>
        </div>
        
        <div>
          <Input
            label={domChangesStorageType === 'variable' ? 'Variable Name' : 'Custom Field Name'}
            type="text"
            value={domChangesFieldName}
            onChange={(e) => setDomChangesFieldName(e.target.value)}
            placeholder="__dom_changes"
          />
          <p className="mt-1 text-xs text-gray-500">
            {domChangesStorageType === 'variable' 
              ? 'The name of the variable that will store DOM changes in each variant'
              : 'The SDK field name of the custom field. Must exist in the experiment.'}
          </p>
        </div>
      </div>
      
      {/* SDK Configuration */}
      <div className="border-t pt-4 mt-4">
        <Input
          label="SDK Window Property (Optional)"
          type="text"
          value={sdkWindowProperty}
          onChange={(e) => setSdkWindowProperty(e.target.value)}
          placeholder="e.g., ABsmartlyContext or sdk.context"
        />
        <p className="mt-1 text-xs text-gray-500">
          The window property where the ABsmartly SDK context is stored. Leave empty to use automatic detection.
        </p>

        <div className="mt-4">
          <Input
            label="SDK Endpoint (Optional)"
            type="url"
            value={sdkEndpoint}
            onChange={(e) => setSdkEndpoint(e.target.value)}
            placeholder="e.g., https://demo.absmartly.io"
          />
          <p className="mt-1 text-xs text-gray-500">
            SDK collector endpoint for fetching development experiments. Defaults to API endpoint with .io domain.
          </p>
        </div>
      </div>

      {/* Query String Override Configuration */}
      <div className="border-t pt-4 mt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Query String Overrides</h3>

        <Input
          label="Query Parameter Prefix"
          type="text"
          value={queryPrefix}
          onChange={(e) => setQueryPrefix(e.target.value)}
          placeholder="_exp_"
        />
        <p className="mt-1 text-xs text-gray-500">
          Prefix for query parameters (e.g., ?_exp_button_color=1)
        </p>

        <div className="mt-4 flex items-center">
          <input
            id="persistQueryToCookie"
            type="checkbox"
            checked={persistQueryToCookie}
            onChange={(e) => setPersistQueryToCookie(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="persistQueryToCookie" className="ml-2 block text-sm text-gray-700">
            Persist query string overrides to cookie
          </label>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          When enabled, query string overrides will be saved to a cookie for persistence across page loads.
        </p>
      </div>

      {/* SDK Injection Settings */}
      <div className="border-t pt-4 mt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">SDK Injection</h3>

        <div className="flex items-center">
          <input
            id="injectSDK"
            type="checkbox"
            checked={injectSDK}
            onChange={(e) => setInjectSDK(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="injectSDK" className="ml-2 block text-sm text-gray-700">
            Inject ABsmartly SDK if not detected
          </label>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          When enabled, the extension will inject the ABsmartly SDK (including all plugins) on pages where it's not already present.
        </p>

        {injectSDK && (
          <div className="mt-4">
            <Input
              label="Custom SDK URL (Optional)"
              type="url"
              value={sdkUrl}
              onChange={(e) => setSdkUrl(e.target.value)}
              placeholder="https://sdk.absmartly.com/sdk.js"
            />
            <p className="mt-1 text-xs text-gray-500">
              Custom URL for the SDK script. Leave empty to use the default SDK URL with current page's query parameters.
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={handleSave} variant="primary">
          Save Settings
        </Button>
        <Button onClick={onCancel} variant="secondary">
          Cancel
        </Button>
      </div>
    </div>
  )
}