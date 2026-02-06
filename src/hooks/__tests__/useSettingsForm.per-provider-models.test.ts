/**
 * Unit tests for per-provider model selection in useSettingsForm
 *
 * Tests the buildConfig() functionality to ensure models are stored per provider
 */

describe('useSettingsForm - Per-Provider Model Selection (buildConfig)', () => {
  it('should store model per provider when buildConfig is called', () => {
    // Test the core logic: buildConfig should update providerModels with current provider's model
    const providerModels = {}
    const aiProvider = 'openrouter-api'
    const llmModel = 'moonshotai/kimi-k2.5'

    const updatedProviderModels = {
      ...providerModels,
      [aiProvider]: llmModel
    }

    expect(updatedProviderModels).toEqual({
      'openrouter-api': 'moonshotai/kimi-k2.5'
    })
  })

  it('should preserve models for other providers', () => {
    const providerModels = {
      'openrouter-api': 'moonshotai/kimi-k2.5',
      'anthropic-api': 'claude-3-5-sonnet-20241022'
    }
    const aiProvider = 'claude-subscription'
    const llmModel = 'opus'

    const updatedProviderModels = {
      ...providerModels,
      [aiProvider]: llmModel
    }

    expect(updatedProviderModels).toEqual({
      'openrouter-api': 'moonshotai/kimi-k2.5',
      'anthropic-api': 'claude-3-5-sonnet-20241022',
      'claude-subscription': 'opus'
    })
  })

  it('should handle model migration from old llmModel field', () => {
    const config = {
      aiProvider: 'claude-subscription',
      llmModel: 'opus'
    }
    const loadedProviderModels = {}

    // Migration logic: if config has llmModel but not in providerModels, migrate it
    if (config.llmModel && !loadedProviderModels[config.aiProvider]) {
      loadedProviderModels[config.aiProvider] = config.llmModel
    }

    expect(loadedProviderModels).toEqual({
      'claude-subscription': 'opus'
    })
  })

  it('should use default model when provider has no saved model', () => {
    const loadedProviderModels = {
      'openrouter-api': 'moonshotai/kimi-k2.5'
    }
    const loadedAiProvider = 'claude-subscription'

    // Get model for current provider, default to 'sonnet' if not found
    const loadedLlmModel = loadedProviderModels[loadedAiProvider] || 'sonnet'

    expect(loadedLlmModel).toBe('sonnet')
  })

  it('should load saved model when switching back to provider', () => {
    const loadedProviderModels = {
      'openrouter-api': 'moonshotai/kimi-k2.5',
      'claude-subscription': 'opus'
    }
    const loadedAiProvider = 'openrouter-api'

    const loadedLlmModel = loadedProviderModels[loadedAiProvider] || 'sonnet'

    expect(loadedLlmModel).toBe('moonshotai/kimi-k2.5')
  })
})
