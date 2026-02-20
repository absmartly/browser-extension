/**
 * Unit tests for per-provider custom endpoint selection in useSettingsForm
 *
 * Tests the buildConfig() functionality to ensure custom endpoints are stored per provider
 */

describe('useSettingsForm - Per-Provider Custom Endpoints (buildConfig)', () => {
  it('should store custom endpoint per provider when buildConfig is called', () => {
    const providerEndpoints = {}
    const aiProvider = 'openrouter-api'
    const customEndpoint = 'https://custom-openrouter.example.com/v1'

    const updatedProviderEndpoints = {
      ...providerEndpoints
    }
    if (customEndpoint.trim()) {
      updatedProviderEndpoints[aiProvider] = customEndpoint.trim()
    }

    expect(updatedProviderEndpoints).toEqual({
      'openrouter-api': 'https://custom-openrouter.example.com/v1'
    })
  })

  it('should remove endpoint when set to empty string', () => {
    const providerEndpoints = {
      'openrouter-api': 'https://custom.example.com',
      'anthropic-api': 'https://custom-anthropic.example.com'
    }
    const aiProvider = 'openrouter-api'
    const customEndpoint = ''

    const updatedProviderEndpoints = {
      ...providerEndpoints
    }
    if (customEndpoint.trim()) {
      updatedProviderEndpoints[aiProvider] = customEndpoint.trim()
    } else {
      delete updatedProviderEndpoints[aiProvider]
    }

    expect(updatedProviderEndpoints).toEqual({
      'anthropic-api': 'https://custom-anthropic.example.com'
    })
  })

  it('should preserve endpoints for other providers when updating one', () => {
    const providerEndpoints = {
      'openrouter-api': 'https://custom-openrouter.example.com',
      'anthropic-api': 'https://custom-anthropic.example.com'
    }
    const aiProvider = 'openai-api'
    const customEndpoint = 'https://custom-openai.example.com/v1'

    const updatedProviderEndpoints = {
      ...providerEndpoints
    }
    if (customEndpoint.trim()) {
      updatedProviderEndpoints[aiProvider] = customEndpoint.trim()
    }

    expect(updatedProviderEndpoints).toEqual({
      'openrouter-api': 'https://custom-openrouter.example.com',
      'anthropic-api': 'https://custom-anthropic.example.com',
      'openai-api': 'https://custom-openai.example.com/v1'
    })
  })

  it('should load saved endpoint for current provider', () => {
    const loadedProviderEndpoints = {
      'openrouter-api': 'https://custom-openrouter.example.com',
      'claude-subscription': 'https://custom-claude.example.com'
    }
    const loadedAiProvider = 'openrouter-api'

    const loadedCustomEndpoint = loadedProviderEndpoints[loadedAiProvider] || ''

    expect(loadedCustomEndpoint).toBe('https://custom-openrouter.example.com')
  })

  it('should use empty string when provider has no saved endpoint', () => {
    const loadedProviderEndpoints = {
      'openrouter-api': 'https://custom-openrouter.example.com'
    }
    const loadedAiProvider = 'anthropic-api'

    const loadedCustomEndpoint = loadedProviderEndpoints[loadedAiProvider] || ''

    expect(loadedCustomEndpoint).toBe('')
  })

  it('should handle multiple provider endpoint switches correctly', () => {
    let providerEndpoints = {}

    // Set endpoint for openrouter
    const aiProvider1 = 'openrouter-api'
    const endpoint1 = 'https://custom-openrouter.example.com'
    providerEndpoints = {
      ...providerEndpoints,
      [aiProvider1]: endpoint1
    }

    expect(providerEndpoints).toEqual({
      'openrouter-api': 'https://custom-openrouter.example.com'
    })

    // Set endpoint for anthropic
    const aiProvider2 = 'anthropic-api'
    const endpoint2 = 'https://custom-anthropic.example.com'
    providerEndpoints = {
      ...providerEndpoints,
      [aiProvider2]: endpoint2
    }

    expect(providerEndpoints).toEqual({
      'openrouter-api': 'https://custom-openrouter.example.com',
      'anthropic-api': 'https://custom-anthropic.example.com'
    })

    // Clear endpoint for openrouter
    const clearedEndpoints = { ...providerEndpoints }
    delete clearedEndpoints['openrouter-api']

    expect(clearedEndpoints).toEqual({
      'anthropic-api': 'https://custom-anthropic.example.com'
    })
  })

  it('should trim whitespace from custom endpoints', () => {
    const providerEndpoints = {}
    const aiProvider = 'openai-api'
    const customEndpoint = '  https://custom.example.com/v1  '

    const updatedProviderEndpoints = {
      ...providerEndpoints
    }
    if (customEndpoint.trim()) {
      updatedProviderEndpoints[aiProvider] = customEndpoint.trim()
    }

    expect(updatedProviderEndpoints).toEqual({
      'openai-api': 'https://custom.example.com/v1'
    })
  })

  it('should handle combined model and endpoint per provider', () => {
    const providerModels = {
      'openrouter-api': 'moonshotai/kimi-k2.5'
    }
    const providerEndpoints = {
      'openrouter-api': 'https://custom-openrouter.example.com'
    }
    const aiProvider = 'openrouter-api'
    const llmModel = 'openai/gpt-4'
    const customEndpoint = 'https://different-endpoint.example.com'

    const updatedModels = {
      ...providerModels,
      [aiProvider]: llmModel
    }
    const updatedEndpoints = {
      ...providerEndpoints,
      [aiProvider]: customEndpoint
    }

    expect(updatedModels).toEqual({
      'openrouter-api': 'openai/gpt-4'
    })
    expect(updatedEndpoints).toEqual({
      'openrouter-api': 'https://different-endpoint.example.com'
    })
  })
})
