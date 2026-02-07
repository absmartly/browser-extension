/**
 * Integration test for AI error handling - verifies errors reach the UI properly
 */

import { BridgeProvider } from '../ai-providers/bridge'
import { ClaudeCodeBridgeClient } from '../claude-code-client'

jest.mock('../claude-code-client')

describe('AI Error Handling - End-to-End Flow', () => {
  let mockBridgeClient: jest.Mocked<ClaudeCodeBridgeClient>

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()

    mockBridgeClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
      createConversation: jest.fn(),
      sendMessage: jest.fn().mockResolvedValue(undefined),
      streamResponses: jest.fn(),
      getConnection: jest.fn().mockReturnValue({ url: 'http://localhost:3000' })
    } as any

    ;(ClaudeCodeBridgeClient as jest.MockedClass<typeof ClaudeCodeBridgeClient>)
      .mockImplementation(() => mockBridgeClient)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should propagate invalid model error to UI with clear message', async () => {
    const provider = new BridgeProvider({
      aiProvider: 'claude-subscription',
      useOAuth: true,
      oauthToken: 'test-token',
      llmModel: 'invalid-model'
    })

    mockBridgeClient.createConversation.mockResolvedValue({
      conversationId: 'conv-123'
    })

    const invalidModelError = 'Invalid model: "invalid-model" is not supported. Available models: sonnet, opus, haiku'

    const mockEventSource = {
      close: jest.fn()
    }

    mockBridgeClient.streamResponses.mockImplementation((conversationId, onEvent, onError) => {
      setTimeout(() => {
        onEvent({ type: 'error', data: invalidModelError })
      }, 150)
      return mockEventSource as any
    })

    // Simulate what happens in AIDOMChangesPage.tsx
    try {
      await provider.generate('<html></html>', 'test prompt', [], undefined, {})
      fail('Should have thrown an error')
    } catch (err) {
      // This is what AIDOMChangesPage does:
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate DOM changes'

      // Verify the error message would be user-friendly
      expect(errorMessage).toContain('Invalid model')
      expect(errorMessage).toContain('invalid-model')
      expect(errorMessage).toContain('Available models')
      expect(errorMessage).toContain('sonnet')

      // Verify it has only one error prefix (not double-prefixed)
      const prefixCount = (errorMessage.match(/error:/gi) || []).length
      expect(prefixCount).toBeLessThanOrEqual(1)

      // Simulate what the UI would display
      console.log('\n📱 UI Display Simulation:')
      console.log('Error shown to user in red box:')
      console.log('┌─────────────────────────────────────────────┐')
      console.log(`│ ${errorMessage.padEnd(43)} │`)
      console.log('└─────────────────────────────────────────────┘')

      // Verify message is actionable
      const isActionable = errorMessage.includes('Available models') ||
                          errorMessage.includes('supported') ||
                          errorMessage.includes('should be')
      expect(isActionable).toBe(true)

      // Verify message doesn't have redundant prefixes
      expect(errorMessage).not.toMatch(/error:.*error:/i)
    }
  })

  it('should handle API authentication errors clearly', async () => {
    const provider = new BridgeProvider({
      aiProvider: 'claude-subscription',
      useOAuth: true,
      oauthToken: 'test-token'
    })

    mockBridgeClient.createConversation.mockResolvedValue({
      conversationId: 'conv-123'
    })

    const authError = 'Authentication failed: Invalid API key or subscription expired'

    const mockEventSource = {
      close: jest.fn()
    }

    mockBridgeClient.streamResponses.mockImplementation((conversationId, onEvent, onError) => {
      setTimeout(() => {
        onEvent({ type: 'error', data: authError })
      }, 150)
      return mockEventSource as any
    })

    try {
      await provider.generate('<html></html>', 'test prompt', [], undefined, {})
      fail('Should have thrown an error')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate DOM changes'

      // Verify auth error is clear
      expect(errorMessage).toContain('Authentication failed')
      expect(errorMessage).toContain('Invalid API key')

      // User should understand they need to fix authentication
      const helpsUser = errorMessage.includes('API key') ||
                       errorMessage.includes('subscription') ||
                       errorMessage.includes('login')
      expect(helpsUser).toBe(true)

      console.log('\n🔐 Auth Error Display:')
      console.log(`User sees: "${errorMessage}"`)
    }
  })

  it('should handle rate limit errors with helpful information', async () => {
    const provider = new BridgeProvider({
      aiProvider: 'claude-subscription',
      useOAuth: true,
      oauthToken: 'test-token'
    })

    mockBridgeClient.createConversation.mockResolvedValue({
      conversationId: 'conv-123'
    })

    const rateLimitError = 'Rate limit exceeded: Too many requests. Please try again in 60 seconds.'

    const mockEventSource = {
      close: jest.fn()
    }

    mockBridgeClient.streamResponses.mockImplementation((conversationId, onEvent, onError) => {
      setTimeout(() => {
        onEvent({ type: 'error', data: rateLimitError })
      }, 150)
      return mockEventSource as any
    })

    try {
      await provider.generate('<html></html>', 'test prompt', [], undefined, {})
      fail('Should have thrown an error')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate DOM changes'

      // Verify rate limit info is preserved
      expect(errorMessage).toContain('Rate limit')
      expect(errorMessage).toContain('60 seconds')

      // User knows what to do (wait)
      const isActionable = errorMessage.includes('try again') ||
                          errorMessage.includes('wait') ||
                          errorMessage.includes('seconds')
      expect(isActionable).toBe(true)

      console.log('\n⏱️  Rate Limit Error Display:')
      console.log(`User sees: "${errorMessage}"`)
    }
  })

  it('should preserve all error context when displaying to user', async () => {
    const provider = new BridgeProvider({
      aiProvider: 'claude-subscription',
      useOAuth: true,
      oauthToken: 'test-token'
    })

    mockBridgeClient.createConversation.mockResolvedValue({
      conversationId: 'conv-123'
    })

    // Complex error with multiple pieces of information
    const complexError = 'Request failed: Model "moonshot/kimi-k2.5" requires pro subscription. Current plan: free. Upgrade at https://example.com/upgrade'

    const mockEventSource = {
      close: jest.fn()
    }

    mockBridgeClient.streamResponses.mockImplementation((conversationId, onEvent, onError) => {
      setTimeout(() => {
        onEvent({ type: 'error', data: complexError })
      }, 150)
      return mockEventSource as any
    })

    try {
      await provider.generate('<html></html>', 'test prompt', [], undefined, {})
      fail('Should have thrown an error')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate DOM changes'

      // Verify ALL parts of the error are preserved
      expect(errorMessage).toContain('moonshot/kimi-k2.5')
      expect(errorMessage).toContain('requires pro subscription')
      expect(errorMessage).toContain('Current plan: free')
      expect(errorMessage).toContain('https://example.com/upgrade')

      // Verify error is properly formatted for display
      const lines = errorMessage.split('\n')
      const hasPrefix = errorMessage.startsWith('Claude Code Bridge error:')
      expect(hasPrefix).toBe(true)

      // Verify the original message is intact after the prefix
      const withoutPrefix = errorMessage.replace('Claude Code Bridge error: ', '')
      expect(withoutPrefix).toBe(complexError)

      console.log('\n📋 Complex Error Display:')
      console.log('Full message preserved:', errorMessage.length > 100)
      console.log(`User sees: "${errorMessage}"`)
    }
  })
})
