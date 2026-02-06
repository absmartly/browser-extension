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
  customEndpoint: string
  providerEndpoints: Record<string, string>
  onAiProviderChange: (value: AIProviderType) => void
  onAiApiKeyChange: (value: string) => void
  onLlmModelChange: (value: string) => void
  onProviderModelsChange: (value: Record<string, string>) => void
  onCustomEndpointChange: (value: string) => void
  onProviderEndpointsChange: (value: Record<string, string>) => void
}

interface ProviderConfig {
  label: string
  apiKeyPlaceholder: string
  apiKeyHelpLink: string
  apiKeyHelpText: string
  endpointPlaceholder: string
  endpointDescription: string
}

const PROVIDER_CONFIGS: Record<AIProviderType, ProviderConfig> = {
  'claude-subscription': {
    label: 'Claude Subscription (Default)',
    apiKeyPlaceholder: '',
    apiKeyHelpLink: '',
    apiKeyHelpText: '',
    endpointPlaceholder: 'Leave blank to use default Claude API',
    endpointDescription: 'Optional: Specify a custom API endpoint for the bridge to use (e.g., for self-hosted or custom LLM providers).'
  },
  'anthropic-api': {
    label: 'Anthropic API Key',
    apiKeyPlaceholder: 'sk-ant-...',
    apiKeyHelpLink: 'https://console.anthropic.com/',
    apiKeyHelpText: 'console.anthropic.com',
    endpointPlaceholder: 'https://api.anthropic.com',
    endpointDescription: 'Optional: Use a custom API endpoint (e.g., for proxy or self-hosted deployments). Leave blank for default.'
  },
  'openai-api': {
    label: 'OpenAI API Key',
    apiKeyPlaceholder: 'sk-...',
    apiKeyHelpLink: 'https://platform.openai.com/api-keys',
    apiKeyHelpText: 'platform.openai.com',
    endpointPlaceholder: 'https://api.openai.com/v1',
    endpointDescription: 'Optional: Use a custom OpenAI-compatible endpoint (e.g., local LLM, Azure OpenAI). Leave blank for default.'
  },
  'openrouter-api': {
    label: 'OpenRouter API Key',
    apiKeyPlaceholder: 'sk-or-...',
    apiKeyHelpLink: 'https://openrouter.ai/keys',
    apiKeyHelpText: 'openrouter.ai/keys',
    endpointPlaceholder: 'https://openrouter.ai/api/v1',
    endpointDescription: 'Optional: Use a custom OpenRouter endpoint. Leave blank for default.'
  },
  'gemini-api': {
    label: 'Google Gemini API Key',
    apiKeyPlaceholder: 'AIza...',
    apiKeyHelpLink: 'https://makersuite.google.com/app/apikey',
    apiKeyHelpText: 'Google AI Studio',
    endpointPlaceholder: 'https://generativelanguage.googleapis.com/v1beta',
    endpointDescription: 'Optional: Use a custom Gemini-compatible endpoint. Leave blank for default.'
  }
}

export const AIProviderSection = React.memo(function AIProviderSection({
  aiProvider,
  aiApiKey,
  llmModel,
  providerModels,
  customEndpoint,
  providerEndpoints,
  onAiProviderChange,
  onAiApiKeyChange,
  onLlmModelChange,
  onProviderModelsChange,
  onCustomEndpointChange,
  onProviderEndpointsChange
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

  const providerConfig = PROVIDER_CONFIGS[aiProvider]

  useEffect(() => {
    if (aiProvider === 'claude-subscription') {
      checkBridgeConnection()
    }
  }, [aiProvider])

  useEffect(() => {
    const savedEndpoint = providerEndpoints[aiProvider] || ''
    onCustomEndpointChange(savedEndpoint)

    if (aiProvider === 'claude-subscription') {
      if (!providerModels[aiProvider]) {
        onLlmModelChange('sonnet')
      } else {
        onLlmModelChange(providerModels[aiProvider])
      }
    } else if (aiProvider === 'anthropic-api') {
      const anthropicModels = ModelFetcher.getStaticAnthropicModels()
      if (!providerModels[aiProvider] && anthropicModels.length > 0) {
        onLlmModelChange(anthropicModels[0].id)
      } else if (providerModels[aiProvider]) {
        onLlmModelChange(providerModels[aiProvider])
      }
    } else if (providerModels[aiProvider]) {
      onLlmModelChange(providerModels[aiProvider])
    }
  }, [aiProvider])

  useEffect(() => {
    if (aiApiKey && (aiProvider === 'openai-api' || aiProvider === 'gemini-api' || aiProvider === 'openrouter-api')) {
      fetchModels()
    }
  }, [aiApiKey, aiProvider])

  useEffect(() => {
    if (!llmModel || !providerModels[aiProvider]) {
      if (aiProvider === 'openai-api' && models.length > 0) {
        onLlmModelChange(models[0].id)
      } else if (aiProvider === 'gemini-api' && models.length > 0) {
        onLlmModelChange(models[0].id)
      } else if (aiProvider === 'openrouter-api' && Object.keys(groupedModels).length > 0) {
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

  const CustomEndpointSection = () => (
    <details className="text-sm mt-3">
      <summary className="cursor-pointer text-gray-700 hover:text-gray-900">
        Advanced: Custom API Endpoint
      </summary>
      <div className="mt-2 space-y-2">
        <Input
          id={`custom-${aiProvider}-endpoint`}
          label="Custom API Endpoint"
          type="url"
          value={customEndpoint}
          onChange={(e) => onCustomEndpointChange(e.target.value)}
          placeholder={providerConfig.endpointPlaceholder}
        />
        <p className="text-xs text-gray-500">
          {providerConfig.endpointDescription}
        </p>
      </div>
    </details>
  )

  const ApiKeySection = () => (
    <>
      <Input
        id="ai-api-key"
        label={`${providerConfig.label.replace(' API Key', '')} API Key`}
        type="password"
        value={aiApiKey}
        onChange={(e) => onAiApiKeyChange(e.target.value)}
        placeholder={providerConfig.apiKeyPlaceholder}
        showPasswordToggle={true}
      />
      <p className="mt-1 text-xs text-gray-500">
        Get your API key from{' '}
        <a
          href={providerConfig.apiKeyHelpLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          {providerConfig.apiKeyHelpText}
        </a>
      </p>
    </>
  )

  const ModelSelectionSection = () => {
    if (!aiApiKey) return null

    if (fetchingModels) {
      return <div className="text-sm text-gray-500">Loading models...</div>
    }

    if (modelsFetchError) {
      return (
        <Alert className="mb-3">
          <AlertDescription>
            <p className="text-sm text-red-600">Error: {modelsFetchError}</p>
            <Button onClick={fetchModels} variant="secondary" className="mt-2">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )
    }

    if (aiProvider === 'anthropic-api') {
      return (
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
      )
    }

    if (aiProvider === 'openrouter-api' && Object.keys(groupedModels).length > 0) {
      return (
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
      )
    }

    if (models.length > 0) {
      return (
        <>
          <Select
            id={`${aiProvider}-model-select`}
            label="Model"
            value={llmModel || ''}
            onChange={(e) => onLlmModelChange(e.target.value)}
            options={models.map(m => ({
              value: m.id,
              label: aiProvider === 'gemini-api' && m.contextWindow
                ? `${m.name} (${(m.contextWindow / 1024).toFixed(0)}K context)`
                : m.name
            }))}
          />
          <p className="mt-1 text-xs text-gray-500">
            Select the {aiProvider === 'openai-api' ? 'OpenAI' : 'Gemini'} model to use for generating DOM changes.
          </p>
        </>
      )
    }

    return null
  }

  return (
    <div className="border-t pt-4 mt-4">
      <Select
        id="ai-provider-select"
        label="AI Provider"
        value={aiProvider}
        onChange={(e) => onAiProviderChange(e.target.value as AIProviderType)}
        options={Object.entries(PROVIDER_CONFIGS).map(([value, config]) => ({
          value,
          label: config.label
        }))}
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

          <CustomEndpointSection />

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

      {aiProvider !== 'claude-subscription' && (
        <div className="mt-4 space-y-3">
          <ApiKeySection />
          {aiApiKey && (
            <div>
              <ModelSelectionSection />
              <CustomEndpointSection />
            </div>
          )}
        </div>
      )}
    </div>
  )
})
