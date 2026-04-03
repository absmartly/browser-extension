import type { AIProviderType } from './base'
import type { ModelInfo } from './base'
import type { GroupedModels } from '~src/lib/model-fetcher'
import { ModelFetcher } from '~src/lib/model-fetcher'
import { AnthropicProvider } from './anthropic'
import { OpenAIProvider } from './openai'
import { OpenRouterProvider } from './openrouter'
import { GeminiProvider } from './gemini'

export interface ProviderMetadata {
  id: AIProviderType
  label: string
  defaultEndpoint: string
  apiKeyPlaceholder: string
  apiKeyHelpLink: string
  apiKeyHelpText: string
  endpointDescription: string
  modelLabel: string
  modelHelpText: string
  modelDisplayType: 'simple' | 'grouped' | 'static'
  fetchModels?: (apiKey: string, customEndpoint?: string) => Promise<ModelInfo[] | GroupedModels>
  getStaticModels?: () => ModelInfo[]
  isBridge: boolean
}

export const PROVIDER_REGISTRY: Record<AIProviderType, ProviderMetadata> = {
  'claude-subscription': {
    id: 'claude-subscription',
    label: 'Claude Code CLI',
    defaultEndpoint: '',
    apiKeyPlaceholder: '',
    apiKeyHelpLink: '',
    apiKeyHelpText: '',
    endpointDescription: 'Optional: Specify a custom API endpoint for the bridge to use (e.g., for self-hosted or custom LLM providers).',
    modelLabel: 'Claude Model',
    modelHelpText: 'Default lets the CLI choose the best model. Select a specific model to override.',
    modelDisplayType: 'static',
    isBridge: true
  },
  'codex': {
    id: 'codex',
    label: 'Codex CLI',
    defaultEndpoint: 'http://localhost:9000',
    apiKeyPlaceholder: '',
    apiKeyHelpLink: '',
    apiKeyHelpText: '',
    endpointDescription: 'Optional: Specify a custom port for the bridge server.',
    modelLabel: 'Codex Model',
    modelHelpText: 'Default lets the CLI choose the best model. Select a specific model to override.',
    modelDisplayType: 'static',
    isBridge: true
  },
  'anthropic-api': {
    id: 'anthropic-api',
    label: 'Anthropic API Key',
    defaultEndpoint: AnthropicProvider.modelConfig.defaultEndpoint,
    apiKeyPlaceholder: 'sk-ant-...',
    apiKeyHelpLink: 'https://console.anthropic.com/',
    apiKeyHelpText: 'console.anthropic.com',
    endpointDescription: 'Optional: Use a custom API endpoint (e.g., for proxy or self-hosted deployments). Leave blank for default.',
    modelLabel: 'Claude Model',
    modelHelpText: 'Models are fetched from the API. Select the Claude model to use for generating DOM changes.',
    modelDisplayType: 'simple',
    fetchModels: (apiKey, endpoint) => ModelFetcher.fetchModels('anthropic', apiKey, AnthropicProvider.modelConfig, endpoint),
    getStaticModels: () => AnthropicProvider.modelConfig.staticModels(),
    isBridge: false
  },
  'openai-api': {
    id: 'openai-api',
    label: 'OpenAI API Key',
    defaultEndpoint: OpenAIProvider.modelConfig.defaultEndpoint,
    apiKeyPlaceholder: 'sk-...',
    apiKeyHelpLink: 'https://platform.openai.com/api-keys',
    apiKeyHelpText: 'platform.openai.com',
    endpointDescription: 'Optional: Use a custom OpenAI-compatible endpoint (e.g., local LLM, Azure OpenAI). Leave blank for default.',
    modelLabel: 'Model',
    modelHelpText: 'Select the OpenAI model to use for generating DOM changes.',
    modelDisplayType: 'simple',
    fetchModels: (apiKey, endpoint) => ModelFetcher.fetchModels('openai', apiKey, OpenAIProvider.modelConfig, endpoint),
    getStaticModels: () => OpenAIProvider.modelConfig.staticModels(),
    isBridge: false
  },
  'openrouter-api': {
    id: 'openrouter-api',
    label: 'OpenRouter API Key',
    defaultEndpoint: OpenRouterProvider.modelConfig.defaultEndpoint,
    apiKeyPlaceholder: 'sk-or-...',
    apiKeyHelpLink: 'https://openrouter.ai/keys',
    apiKeyHelpText: 'openrouter.ai/keys',
    endpointDescription: 'Optional: Use a custom OpenRouter endpoint. Leave blank for default.',
    modelLabel: 'Model',
    modelHelpText: 'Models are grouped by provider. Pricing shown as input/output per 1M tokens.',
    modelDisplayType: 'grouped',
    fetchModels: (apiKey, endpoint) => ModelFetcher.fetchGroupedModels('openrouter', apiKey, OpenRouterProvider.modelConfig, endpoint),
    isBridge: false
  },
  'gemini-api': {
    id: 'gemini-api',
    label: 'Google Gemini API Key',
    defaultEndpoint: GeminiProvider.modelConfig.defaultEndpoint,
    apiKeyPlaceholder: 'AIza...',
    apiKeyHelpLink: 'https://makersuite.google.com/app/apikey',
    apiKeyHelpText: 'Google AI Studio',
    endpointDescription: 'Optional: Use a custom Gemini-compatible endpoint. Leave blank for default.',
    modelLabel: 'Model',
    modelHelpText: 'Select the Gemini model to use for generating DOM changes.',
    modelDisplayType: 'simple',
    fetchModels: (apiKey, endpoint) => ModelFetcher.fetchModels('gemini', apiKey, GeminiProvider.modelConfig, endpoint),
    getStaticModels: () => GeminiProvider.modelConfig.staticModels(),
    isBridge: false
  }
}

function toOriginPattern(url: string): string | null {
  try {
    const parsed = new URL(url)
    return `${parsed.origin}/*`
  } catch {
    return null
  }
}

export function getProviderOrigins(providerId: AIProviderType, customEndpoint?: string): string[] {
  const meta = PROVIDER_REGISTRY[providerId]
  if (!meta || meta.isBridge) return []

  const origins = new Set<string>()

  if (customEndpoint) {
    const o = toOriginPattern(customEndpoint)
    if (o) origins.add(o)
  }

  if (meta.defaultEndpoint) {
    const o = toOriginPattern(meta.defaultEndpoint)
    if (o) origins.add(o)
  }

  return [...origins]
}
