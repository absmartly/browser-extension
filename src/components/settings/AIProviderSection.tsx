import React, { useState, useEffect } from 'react'
import { Select } from '../ui/Select'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Alert, AlertDescription } from '../ui/Alert'
import { ClaudeCodeBridgeClient, ConnectionState, getConnectionStateMessage } from '~src/lib/claude-code-client'

interface AIProviderSectionProps {
  aiProvider: 'claude-subscription' | 'anthropic-api' | 'openai-api'
  aiApiKey: string
  llmModel: string
  onAiProviderChange: (value: 'claude-subscription' | 'anthropic-api' | 'openai-api') => void
  onAiApiKeyChange: (value: string) => void
  onLlmModelChange: (value: string) => void
}

export const AIProviderSection = React.memo(function AIProviderSection({
  aiProvider,
  aiApiKey,
  llmModel,
  onAiProviderChange,
  onAiApiKeyChange,
  onLlmModelChange
}: AIProviderSectionProps) {
  const [bridgeClient] = useState(() => new ClaudeCodeBridgeClient())
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.NOT_CONFIGURED)
  const [testingConnection, setTestingConnection] = useState(false)
  const [bridgePort, setBridgePort] = useState<number | null>(null)
  const [subscriptionType, setSubscriptionType] = useState<string | undefined>(undefined)
  const [customPort, setCustomPort] = useState('')

  useEffect(() => {
    if (aiProvider === 'claude-subscription') {
      checkBridgeConnection()
    }
  }, [aiProvider])

  const checkBridgeConnection = async () => {
    setConnectionState(ConnectionState.CONNECTING)
    try {
      await bridgeClient.connect()
      const connection = bridgeClient.getConnection()
      if (connection) {
        setBridgePort(connection.port)
        setSubscriptionType(connection.subscriptionType)
        setConnectionState(ConnectionState.CONNECTED)
      }
    } catch (error) {
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
        onChange={(e) => onAiProviderChange(e.target.value as 'claude-subscription' | 'anthropic-api' | 'openai-api')}
        options={[
          { value: 'claude-subscription', label: 'Claude Subscription (Default)' },
          { value: 'anthropic-api', label: 'Anthropic API Key' },
          { value: 'openai-api', label: 'OpenAI API Key' }
        ]}
      />
      <p className="mt-1 text-xs text-gray-500">
        Choose how to generate AI-powered DOM changes. Claude Subscription uses your local Claude CLI.
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
        <div className="mt-4">
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
        </div>
      )}

      {aiProvider === 'openai-api' && (
        <div className="mt-4">
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
        </div>
      )}
    </div>
  )
})
