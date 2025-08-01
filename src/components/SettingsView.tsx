import React, { useState, useEffect } from 'react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import type { ABSmartlyConfig, ABSmartlyUser } from '~src/types/absmartly'
import { getConfig, setConfig } from '~src/utils/storage'
import axios from 'axios'

interface SettingsViewProps {
  onSave: (config: ABSmartlyConfig) => void
  onCancel: () => void
}

export function SettingsView({ onSave, onCancel }: SettingsViewProps) {
  const [apiKey, setApiKey] = useState('')
  const [apiEndpoint, setApiEndpoint] = useState('')
  const [applicationId, setApplicationId] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<ABSmartlyUser | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(false)
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      console.log('[SettingsView] Loading config...')
      const config = await getConfig()
      console.log('[SettingsView] Config from storage:', config)
      
      // Load from config first
      let loadedApiKey = config?.apiKey || ''
      let loadedApiEndpoint = config?.apiEndpoint || ''
      let loadedApplicationId = config?.applicationId?.toString() || ''
      
      console.log('[SettingsView] Initial values from storage:', {
        hasApiKey: !!loadedApiKey,
        apiKeyLength: loadedApiKey.length,
        apiEndpoint: loadedApiEndpoint,
        applicationId: loadedApplicationId
      })
      
      // In development, auto-load from environment variables if fields are empty
      // Plasmo replaces process.env.PLASMO_PUBLIC_* at build time
      const envApiKey = process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY
      const envApiEndpoint = process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT
      const envApplicationId = process.env.PLASMO_PUBLIC_ABSMARTLY_APPLICATION_ID
      
      console.log('[SettingsView] Environment variables:', {
        hasApiKey: !!envApiKey,
        apiKeyLength: envApiKey?.length || 0,
        apiEndpoint: envApiEndpoint,
        applicationId: envApplicationId
      })
      
      // Only use env vars if the loaded values are empty
      if (!loadedApiKey && envApiKey) {
        loadedApiKey = envApiKey
        console.log('[SettingsView] Using API key from environment')
      }
      if (!loadedApiEndpoint && envApiEndpoint) {
        loadedApiEndpoint = envApiEndpoint
        console.log('[SettingsView] Using API endpoint from environment:', envApiEndpoint)
      }
      if (!loadedApplicationId && envApplicationId) {
        loadedApplicationId = envApplicationId
        console.log('[SettingsView] Using application ID from environment')
      }
      
      console.log('[SettingsView] Final values:', {
        hasApiKey: !!loadedApiKey,
        apiKeyLength: loadedApiKey.length,
        apiEndpoint: loadedApiEndpoint,
        applicationId: loadedApplicationId
      })
      
      // Set the final values
      setApiKey(loadedApiKey)
      setApiEndpoint(loadedApiEndpoint)
      setApplicationId(loadedApplicationId)
      
      // Check authentication status if endpoint is set
      if (loadedApiEndpoint) {
        checkAuthStatus(loadedApiEndpoint)
      }
    } catch (error) {
      console.error('[SettingsView] Failed to load config:', error)
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
        console.log('Auth response in settings:', response.data)
        console.log('Auth response type:', typeof response.data)
        console.log('Auth response keys:', Object.keys(response.data))
        
        // Check if user data is nested
        const userData = response.data.user || response.data
        
        // Handle picture URL - construct it from base_url
        let pictureUrl = null
        console.log('Full response.data:', JSON.stringify(response.data, null, 2))
        console.log('userData:', JSON.stringify(userData, null, 2))
        console.log('userData.picture:', userData.picture)
        console.log('endpoint:', endpoint)
        
        // Ensure endpoint doesn't have trailing slash
        const cleanEndpoint = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint
        
        // The user object has an 'avatar' property with base_url
        if (userData.avatar && typeof userData.avatar === 'object' && userData.avatar.base_url) {
          // Construct the full avatar URL: endpoint + base_url + /crop/original.png
          pictureUrl = `${cleanEndpoint}${userData.avatar.base_url}/crop/original.png`
          console.log('Constructed picture URL from avatar.base_url:', pictureUrl)
        }
        
        const userObject = {
          id: userData.id || userData.user_id,
          email: userData.email,
          name: userData.first_name && userData.last_name 
            ? `${userData.first_name} ${userData.last_name}`
            : userData.first_name || userData.last_name || userData.email,
          picture: pictureUrl,
          authenticated: true
        }
        console.log('Setting user object:', userObject)
        setUser(userObject)
        
        // Fetch avatar image through background worker if URL exists
        if (pictureUrl) {
          chrome.runtime.sendMessage({
            type: 'FETCH_AVATAR',
            url: pictureUrl
          }).then(avatarResponse => {
            if (avatarResponse.success && avatarResponse.dataUrl) {
              setAvatarDataUrl(avatarResponse.dataUrl)
              console.log('Avatar fetched successfully')
            } else {
              console.error('Failed to fetch avatar:', avatarResponse.error)
            }
          }).catch(err => {
            console.error('Error fetching avatar:', err)
          })
        }
      } else {
        console.log('Auth failed or no data:', response)
        setUser(null)
        setAvatarDataUrl(null)
      }
    } catch (error) {
      console.log('Not authenticated or error checking auth:', error)
      setUser(null)
      setAvatarDataUrl(null)
    } finally {
      setCheckingAuth(false)
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    // API Key is now optional
    
    if (!apiEndpoint.trim()) {
      newErrors.apiEndpoint = 'ABSmartly Endpoint is required'
    } else if (!isValidUrl(apiEndpoint)) {
      newErrors.apiEndpoint = 'Please enter a valid URL'
    }
    
    if (applicationId && isNaN(parseInt(applicationId))) {
      newErrors.applicationId = 'Application ID must be a number'
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

    const config: ABSmartlyConfig = {
      apiKey: apiKey.trim() || undefined,
      apiEndpoint,
      applicationId: applicationId ? parseInt(applicationId) : undefined
    }

    try {
      await setConfig(config)
      // Check auth status after saving
      if (apiEndpoint) {
        checkAuthStatus(apiEndpoint)
      }
      onSave(config)
    } catch (error) {
      console.error('Failed to save config:', error)
      setErrors({ general: 'Failed to save settings' })
    }
  }

  const handleAuthenticate = () => {
    if (apiEndpoint) {
      chrome.tabs.create({ url: `${apiEndpoint}/login` })
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
      <h2 className="text-lg font-semibold">ABSmartly Settings</h2>
      
      {errors.general && (
        <div role="alert" className="bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm">
          {errors.general}
        </div>
      )}

      {/* Authentication Status */}
      <div className="bg-gray-50 p-3 rounded-md">
        <div className="text-sm font-medium text-gray-700 mb-2">Authentication Status</div>
        {checkingAuth ? (
          <div className="flex items-center text-sm text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            Checking authentication...
          </div>
        ) : user && user.authenticated ? (
          <div>
            <div className="flex items-center space-x-3">
              {(avatarDataUrl || user.picture) && (
                <img 
                  src={avatarDataUrl || user.picture} 
                  alt={user.name || 'User'} 
                  className="w-10 h-10 rounded-full object-cover"
                  onError={(e) => {
                    console.error('Avatar failed to load:', avatarDataUrl || user.picture)
                    e.currentTarget.style.display = 'none'
                  }}
                  onLoad={() => {
                    console.log('Avatar loaded successfully')
                  }}
                />
              )}
              <div>
                <div className="text-sm font-medium text-gray-900">{user.name || 'User'}</div>
                <div className="text-xs text-gray-600">{user.email || 'No email'}</div>
              </div>
            </div>
            {/* Debug info */}
            <details className="mt-2">
              <summary className="text-xs text-gray-500 cursor-pointer">Debug info</summary>
              <pre className="text-xs mt-1 p-2 bg-gray-100 rounded overflow-auto">
{JSON.stringify(user, null, 2)}
              </pre>
            </details>
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
                Authenticate in ABSmartly
              </Button>
            )}
          </div>
        )}
      </div>
      
      <Input
        label="ABSmartly Endpoint"
        type="url"
        value={apiEndpoint}
        onChange={(e) => setApiEndpoint(e.target.value)}
        placeholder="https://api.absmartly.com"
        error={errors.apiEndpoint}
      />
      
      <div>
        <Input
          label="API Key (Optional)"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your API key"
          error={errors.apiKey}
          showPasswordToggle={true}
        />
        <p className="mt-1 text-xs text-gray-500">
          If not provided, will use JWT from browser cookies. Please authenticate into ABSmartly if no API key is set.
        </p>
      </div>
      
      <Input
        label="Application ID (Optional)"
        type="text"
        value={applicationId}
        onChange={(e) => setApplicationId(e.target.value)}
        placeholder="Enter application ID"
        error={errors.applicationId}
      />
      
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