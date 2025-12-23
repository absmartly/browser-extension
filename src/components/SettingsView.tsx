import React, { useEffect } from 'react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Header } from './Header'
import { CookieConsentModal } from './CookieConsentModal'
import { AuthenticationStatusSection } from './settings/AuthenticationStatusSection'
import { DOMChangesStorageSection } from './settings/DOMChangesStorageSection'
import { SDKConfigSection } from './settings/SDKConfigSection'
import { QueryStringOverridesSection } from './settings/QueryStringOverridesSection'
import { SDKInjectionSection } from './settings/SDKInjectionSection'
import { AIProviderSection } from './settings/AIProviderSection'
import { SystemPromptSection } from './settings/SystemPromptSection'
import { useSettingsForm } from '~src/hooks/useSettingsForm'
import type { ABsmartlyConfig } from '~src/types/absmartly'
import { setConfig } from '~src/utils/storage'
import { debugError } from '~src/utils/debug'

interface SettingsViewProps {
  onSave: (config: ABsmartlyConfig) => void
  onCancel: () => void
}

export function SettingsView({ onSave, onCancel }: SettingsViewProps) {
  const {
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
    validateForm,
    buildConfig,
    requestCookiePermission
  } = useSettingsForm()

  useEffect(() => {
    loadConfig()
  }, [])

  const handleSave = async () => {
    const isValid = await validateForm()
    if (!isValid) return

    const config = buildConfig()

    try {
      await setConfig(config)

      const normalized = normalizeEndpoint(apiEndpoint)
      if (normalized) {
        localStorage.setItem('absmartly-endpoint', normalized)
      }

      onSave(config)
    } catch (error) {
      debugError('Failed to save config:', error)
      setErrors({ general: 'Failed to save settings' })
    }
  }

  const handleAuthenticate = () => {
    if (apiEndpoint) {
      const baseUrl = apiEndpoint.replace(/\/+$/, '').replace(/\/v1$/, '')
      chrome.tabs.create({ url: baseUrl })
    }
  }

  const handleCookieConsentGrant = async () => {
    const granted = await requestCookiePermission()
    setShowCookieConsentModal(false)

    if (granted && apiEndpoint) {
      await new Promise(resolve => setTimeout(resolve, 100))
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
        id="absmartly-endpoint"
        label="ABsmartly Endpoint"
        type="url"
        value={apiEndpoint}
        onChange={(e) => setApiEndpoint(e.target.value)}
        placeholder="https://api.absmartly.com"
        error={errors.apiEndpoint}
      />

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

      <DOMChangesStorageSection
        domChangesFieldName={domChangesFieldName}
        onDomChangesFieldNameChange={setDomChangesFieldName}
      />

      <SDKConfigSection
        sdkWindowProperty={sdkWindowProperty}
        sdkEndpoint={sdkEndpoint}
        onSdkWindowPropertyChange={setSdkWindowProperty}
        onSdkEndpointChange={setSdkEndpoint}
      />

      <QueryStringOverridesSection
        queryPrefix={queryPrefix}
        persistQueryToCookie={persistQueryToCookie}
        onQueryPrefixChange={setQueryPrefix}
        onPersistQueryToCookieChange={setPersistQueryToCookie}
      />

      <SDKInjectionSection
        injectSDK={injectSDK}
        sdkUrl={sdkUrl}
        onInjectSDKChange={setInjectSDK}
        onSdkUrlChange={setSdkUrl}
      />

      <AIProviderSection
        aiProvider={aiProvider}
        aiApiKey={aiApiKey}
        llmModel={llmModel}
        onAiProviderChange={setAiProvider}
        onAiApiKeyChange={setAiApiKey}
        onLlmModelChange={setLlmModel}
      />

      <SystemPromptSection />

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
