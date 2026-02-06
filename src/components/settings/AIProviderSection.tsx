import React, { useState, useEffect } from 'react'
import { Select } from '../ui/Select'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Alert, AlertDescription } from '../ui/Alert'
import { ClaudeCodeBridgeClient, ConnectionState, getConnectionStateMessage } from '~src/lib/claude-code-client'
import { ModelFetcher, type ModelInfo, type GroupedModels } from '~src/lib/model-fetcher'
import type { AIProviderType } from '~src/lib/ai-providers'

interface AIProviderSectionProps {
  aiProvider: AIProviderType
  aiApiKey: string
  llmModel: string
  providerModels: Record<string, string>
  onAiProviderChange: (value: AIProviderType) => void
  onAiApiKeyChange: (value: string) => void
  onLlmModelChange: (value: string) => void
  onProviderModelsChange: (value: Record<string, string>) => void
}

export const AIProviderSection = React.memo(function AIProviderSection({
  aiProvider,
  aiApiKey,
  llmModel,
  providerModels,
  onAiProviderChange,
  onAiApiKeyChange,
  onLlmModelChange,
  onProviderModelsChange
}: AIProviderSectionProps) {
  const [bridgeClient] = useState(() => new ClaudeCodeBridgeClient())
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.NOT_CONFIGURED)
  const [testingConnection, setTestingConnection] = useState(false)
  const [bridgePort, setBridgePort] = useState<number | null>(null)
  const [subscriptionType, setSubscriptionType] = useState<string | undefined>(undefined)
  const [customPort, setCustomPort] = useState('')

  const [models, setModels] = useState<ModelInfo[]>([])
  const [groupedModels, setGroupedModels] = useState<GroupedModels>({})
  const [fetchingModels, setFetchingModels] = useState(false)
  const [modelsFetchError, setModelsFetchError] = useState<string | null>(null)

  // Check bridge connection on mount and when provider changes to claude-subscription
  useEffect(() => {
    if (aiProvider === 'claude-subscription') {
      checkBridgeConnection()
    }
  }, [aiProvider])

  // Auto-select first model when provider changes if no model is saved for that provider
  useEffect(() => {
    if (aiProvider === 'claude-subscription') {
      // If no saved model for claude-subscription, use default 'sonnet'
      if (!providerModels[aiProvider]) {
        onLlmModelChange('sonnet')
      } else {
        onLlmModelChange(providerModels[aiProvider])
      }
    } else if (aiProvider === 'anthropic-api') {
      // If no saved model for anthropic-api, use first available
      const anthropicModels = ModelFetcher.getStaticAnthropicModels()
      if (!providerModels[aiProvider] && anthropicModels.length > 0) {
        onLlmModelChange(anthropicModels[0].id)
      } else if (providerModels[aiProvider]) {
        onLlmModelChange(providerModels[aiProvider])
      }
    } else if (providerModels[aiProvider]) {
      // Restore saved model for this provider
      onLlmModelChange(providerModels[aiProvider])
    }
  }, [aiProvider])

  useEffect(() => {
    if (aiApiKey && (aiProvider === 'openai-api' || aiProvider === 'gemini-api' || aiProvider === 'openrouter-api')) {
      fetchModels()
    }
  }, [aiApiKey, aiProvider])

  // Auto-select first model when models are fetched if no model is selected
  useEffect(() => {
    if (!llmModel || !providerModels[aiProvider]) {
      if (aiProvider === 'openai-api' && models.length > 0) {
        onLlmModelChange(models[0].id)
      } else if (aiProvider === 'gemini-api' && models.length > 0) {
        onLlmModelChange(models[0].id)
      } else if (aiProvider === 'openrouter-api' && Object.keys(groupedModels).length > 0) {
        // Get first model from first provider group
        const firstProvider = Object.keys(groupedModels)[0]
        const firstModel = groupedModels[firstProvider][0]
        if (firstModel) {
          onLlmModelChange(firstModel.id)
        }
      }
    }
  }, [models, groupedModels, aiProvider])

  const fetchModels = async () => {
    if (!aiApiKey) return

    setFetchingModels(true)
    setModelsFetchError(null)

    try {
      if (aiProvider === 'openai-api') {
        const fetchedModels = await ModelFetcher.fetchOpenAIModels(aiApiKey)
        setModels(fetchedModels)
        setGroupedModels({})
      } else if (aiProvider === 'gemini-api') {
        const fetchedModels = await ModelFetcher.fetchGeminiModels(aiApiKey)
        setModels(fetchedModels)
        setGroupedModels({})
      } else if (aiProvider === 'openrouter-api') {
        const grouped = await ModelFetcher.fetchOpenRouterModels(aiApiKey)
        setGroupedModels(grouped)
        setModels([])
      }
    } catch (error) {
      console.error('Error fetching models:', error)
      setModelsFetchError(error instanceof Error ? error.message : 'Failed to fetch models')
      setModels([])
      setGroupedModels({})
    } finally {
      setFetchingModels(false)
    }
  }

  const checkBridgeConnection = async () => {
    console.log('[AIProviderSection] Starting bridge connection check...')
    setConnectionState(ConnectionState.CONNECTING)
    try {
      await bridgeClient.connect()
      const connection = bridgeClient.getConnection()
      console.log('[AIProviderSection] Bridge connection result:', connection)
      if (connection) {
        setBridgePort(connection.port)
        setSubscriptionType(connection.subscriptionType)
        setConnectionState(ConnectionState.CONNECTED)
        console.log('[AIProviderSection] Bridge connected successfully on port', connection.port)
      } else {
        console.warn('[AIProviderSection] Bridge connect succeeded but no connection object returned')
        setConnectionState(ConnectionState.SERVER_NOT_FOUND)
      }
    } catch (error) {
      console.error('[AIProviderSection] Bridge connection failed:', error)
      setConnectionState(ConnectionState.SERVER_NOT_FOUND)
    }
  }

  const handleTestConnection = async () => {
    setTestingConnection(true)
    try {
      const port = customPort ? parseInt(customPort) : undefined
      const success = await bridgeClient.testConnection(port)
      if (success) {
        const connection = bridgeClient.getConnection()
        if (connection) {
          setBridgePort(connection.port)
          setSubscriptionType(connection.subscriptionType)
        }
        setConnectionState(ConnectionState.CONNECTED)
      } else {
        setConnectionState(ConnectionState.SERVER_NOT_FOUND)
      }
    } catch (error) {
      setConnectionState(ConnectionState.CONNECTION_FAILED)
    } finally {
      setTestingConnection(false)
    }
  }

  const getStatusColor = (state: ConnectionState) => {
    switch (state) {
      case ConnectionState.CONNECTED:
        return 'bg-green-500'
      case ConnectionState.CONNECTING:
        return 'bg-yellow-500'
      case ConnectionState.CONNECTION_FAILED:
      case ConnectionState.SERVER_NOT_FOUND:
        return 'bg-red-500'
      default:
        return 'bg-gray-400'
    }
  }

  return (
    <div className="border-t pt-4 mt-4">
      <Select
        id="ai-provider-select"
        label="AI Provider"
        value={aiProvider}
        onChange={(e) => onAiProviderChange(e.target.value as AIProviderType)}
        options={[
          { value: 'claude-subscription', label: 'Claude Subscription (Default)' },
          { value: 'anthropic-api', label: 'Anthropic API Key' },
          { value: 'openai-api', label: 'OpenAI API Key' },
          { value: 'openrouter-api', label: 'OpenRouter API Key' },
          { value: 'gemini-api', label: 'Google Gemini API Key' }
        ]}
      />
      <p className="mt-1 text-xs text-gray-500">
        Choose how to generate AI-powered DOM changes. Claude Subscription uses your local Claude CLI. OpenRouter provides access to 100+ models.
      </p>

      {aiProvider === 'claude-subscription' && (
        <div className="mt-4 space-y-3">
          <Select
            id="llm-model-select"
            label="Claude Model"
            value={llmModel}
            onChange={(e) => onLlmModelChange(e.target.value)}
            options={[
              { value: 'sonnet', label: 'Claude Sonnet (Recommended)' },
              { value: 'opus', label: 'Claude Opus (Most Capable)' },
              { value: 'haiku', label: 'Claude Haiku (Fastest)' }
            ]}
          />
          <p className="text-xs text-gray-500">
            Sonnet is recommended for best balance of speed and capability.
          </p>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(connectionState)}`} />
              <div>
                <p className="text-sm font-medium">
                  {connectionState === ConnectionState.CONNECTED ? `Connected (port ${bridgePort})` : 'Not Connected'}
                </p>
                <p className="text-xs text-gray-600">
                  {connectionState === ConnectionState.CONNECTED && subscriptionType
                    ? `${getConnectionStateMessage(connectionState)} • ${subscriptionType}`
                    : getConnectionStateMessage(connectionState)}
                </p>
              </div>
            </div>
            <Button
              id="test-bridge-connection"
              onClick={handleTestConnection}
              variant="secondary"
              disabled={testingConnection}
            >
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>

          {connectionState !== ConnectionState.CONNECTED && (
            <Alert className="mt-3">
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">Claude Subscription requires a local bridge server:</p>

                  <div className="pl-4 space-y-2">
                    <div>
                      <p className="font-medium text-xs">1. Login to Claude CLI (one-time setup):</p>
                      <code className="block bg-blue-100 text-blue-900 px-2 py-1 rounded text-xs mt-1">
                        npx @anthropic-ai/claude-code /login
                      </code>
                    </div>

                    <div>
                      <p className="font-medium text-xs">2. Start the bridge server:</p>
                      <code className="block bg-blue-100 text-blue-900 px-2 py-1 rounded text-xs mt-1">
                        npx @absmartly/claude-code-bridge
                      </code>
                    </div>
                  </div>

                  <p className="text-xs italic">
                    Leave the terminal open while using the extension.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <details className="text-sm">
            <summary className="cursor-pointer text-gray-700 hover:text-gray-900">
              Advanced: Custom Port Configuration
            </summary>
            <div className="mt-2 space-y-2">
              <Input
                id="custom-bridge-port"
                label="Custom Bridge Port"
                type="number"
                value={customPort}
                onChange={(e) => setCustomPort(e.target.value)}
                placeholder="3000"
              />
              <p className="text-xs text-gray-500">
                Leave blank to auto-detect (ports 3000-3004). Only change if you started the bridge on a custom port.
              </p>
            </div>
          </details>
        </div>
      )}

      {aiProvider === 'anthropic-api' && (
        <div className="mt-4 space-y-3">
          <Input
            id="ai-api-key"
            label="Anthropic API Key"
            type="password"
            value={aiApiKey}
            onChange={(e) => onAiApiKeyChange(e.target.value)}
            placeholder="sk-ant-..."
            showPasswordToggle={true}
          />
          <p className="mt-1 text-xs text-gray-500">
            Get your API key from{' '}
            <a
              href="https://console.anthropic.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              console.anthropic.com
            </a>
          </p>

          {aiApiKey && (
            <>
              <Select
                id="anthropic-model-select"
                label="Claude Model"
                value={llmModel || ''}
                onChange={(e) => onLlmModelChange(e.target.value)}
                options={ModelFetcher.getStaticAnthropicModels().map(m => ({
                  value: m.id,
                  label: m.name
                }))}
              />
              <p className="mt-1 text-xs text-gray-500">
                Select the Claude model to use for generating DOM changes.
              </p>
            </>
          )}
        </div>
      )}

      {aiProvider === 'openai-api' && (
        <div className="mt-4 space-y-3">
          <Input
            id="ai-api-key"
            label="OpenAI API Key"
            type="password"
            value={aiApiKey}
            onChange={(e) => onAiApiKeyChange(e.target.value)}
            placeholder="sk-..."
            showPasswordToggle={true}
          />
          <p className="mt-1 text-xs text-gray-500">
            Get your API key from{' '}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              platform.openai.com
            </a>
          </p>

          {aiApiKey && (
            <div>
              {fetchingModels ? (
                <div className="text-sm text-gray-500">Loading models...</div>
              ) : modelsFetchError ? (
                <Alert className="mb-3">
                  <AlertDescription>
                    <p className="text-sm text-red-600">Error: {modelsFetchError}</p>
                    <Button onClick={fetchModels} variant="secondary" className="mt-2">
                      Retry
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : models.length > 0 ? (
                <>
                  <Select
                    id="openai-model-select"
                    label="Model"
                    value={llmModel || ''}
                    onChange={(e) => onLlmModelChange(e.target.value)}
                    options={models.map(m => ({ value: m.id, label: m.name }))}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Select the OpenAI model to use for generating DOM changes.
                  </p>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}

      {aiProvider === 'openrouter-api' && (
        <div className="mt-4 space-y-3">
          <Input
            id="ai-api-key"
            label="OpenRouter API Key"
            type="password"
            value={aiApiKey}
            onChange={(e) => onAiApiKeyChange(e.target.value)}
            placeholder="sk-or-..."
            showPasswordToggle={true}
          />
          <p className="mt-1 text-xs text-gray-500">
            Get your API key from{' '}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              openrouter.ai/keys
            </a>
          </p>

          {aiApiKey && (
            <div>
              {fetchingModels ? (
                <div className="text-sm text-gray-500">Loading models...</div>
              ) : modelsFetchError ? (
                <Alert className="mb-3">
                  <AlertDescription>
                    <p className="text-sm text-red-600">Error: {modelsFetchError}</p>
                    <Button onClick={fetchModels} variant="secondary" className="mt-2">
                      Retry
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : Object.keys(groupedModels).length > 0 ? (
                <>
                  <label htmlFor="openrouter-model-select" className="block text-sm font-medium text-gray-700 mb-1">
                    Model
                  </label>
                  <select
                    id="openrouter-model-select"
                    value={llmModel || ''}
                    onChange={(e) => onLlmModelChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a model...</option>
                    {Object.entries(groupedModels).map(([provider, providerModels]) => (
                      <optgroup key={provider} label={provider}>
                        {providerModels.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                            {model.pricing && ` ($${model.pricing.input.toFixed(2)}/$${model.pricing.output.toFixed(2)} per 1M)`}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Models are grouped by provider. Pricing shown as input/output per 1M tokens.
                  </p>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}

      {aiProvider === 'gemini-api' && (
        <div className="mt-4 space-y-3">
          <Input
            id="ai-api-key"
            label="Google Gemini API Key"
            type="password"
            value={aiApiKey}
            onChange={(e) => onAiApiKeyChange(e.target.value)}
            placeholder="AIza..."
            showPasswordToggle={true}
          />
          <p className="mt-1 text-xs text-gray-500">
            Get your API key from{' '}
            <a
              href="https://makersuite.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Google AI Studio
            </a>
          </p>

          {aiApiKey && (
            <div>
              {fetchingModels ? (
                <div className="text-sm text-gray-500">Loading models...</div>
              ) : modelsFetchError ? (
                <Alert className="mb-3">
                  <AlertDescription>
                    <p className="text-sm text-red-600">Error: {modelsFetchError}</p>
                    <Button onClick={fetchModels} variant="secondary" className="mt-2">
                      Retry
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : models.length > 0 ? (
                <>
                  <Select
                    id="gemini-model-select"
                    label="Model"
                    value={llmModel || ''}
                    onChange={(e) => onLlmModelChange(e.target.value)}
                    options={models.map(m => ({
                      value: m.id,
                      label: `${m.name}${m.contextWindow ? ` (${(m.contextWindow / 1024).toFixed(0)}K context)` : ''}`
                    }))}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Select the Gemini model to use for generating DOM changes.
                  </p>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  )
})
