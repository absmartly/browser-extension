import {
  initOAuthFlow,
  handleOAuthCallback,
  validateOAuthState,
  refreshOAuthToken,
  revokeOAuthToken
} from '../oauth'
import { jest } from '@jest/globals'

jest.mock('~src/utils/debug', () => ({
  debugLog: jest.fn(),
  debugError: jest.fn(),
  debugWarn: jest.fn()
}))

describe('OAuth Authentication', () => {
  const mockClientId = 'test-client-id'
  const mockClientSecret = 'test-client-secret'
  const mockRedirectUri = 'chrome-extension://test-id/oauth-callback'
  const mockAuthorizationCode = 'auth-code-123'
  const mockAccessToken = 'access-token-xyz'
  const mockRefreshToken = 'refresh-token-abc'

  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
  })

  describe('initOAuthFlow', () => {
    it('should generate authorization URL with correct parameters', () => {
      const authEndpoint = 'https://api.anthropic.com/oauth/authorize'
      const scopes = ['user', 'experiments:read']
      const state = 'random-state-123'

      const url = initOAuthFlow(authEndpoint, mockClientId, mockRedirectUri, scopes, state)

      expect(url).toContain(authEndpoint)
      expect(url).toContain(`client_id=${mockClientId}`)
      expect(url).toContain('response_type=code')
      expect(url).toContain('scope=')
      expect(url).toContain(`state=${state}`)
    })

    it('should handle multiple scopes correctly', () => {
      const authEndpoint = 'https://api.anthropic.com/oauth/authorize'
      const scopes = ['user', 'experiments:read', 'experiments:write', 'experiments:delete']

      const url = initOAuthFlow(authEndpoint, mockClientId, mockRedirectUri, scopes)

      expect(url).toContain('scope=')
      expect(url).toContain('user')
    })

    it('should generate unique state value when not provided', () => {
      const authEndpoint = 'https://api.anthropic.com/oauth/authorize'
      const scopes = ['user']

      const url1 = initOAuthFlow(authEndpoint, mockClientId, mockRedirectUri, scopes)
      const url2 = initOAuthFlow(authEndpoint, mockClientId, mockRedirectUri, scopes)

      const state1 = new URL(url1).searchParams.get('state')
      const state2 = new URL(url2).searchParams.get('state')

      expect(state1).toBeDefined()
      expect(state2).toBeDefined()
      expect(state1).not.toEqual(state2)
    })

    it('should encode redirect URI correctly', () => {
      const authEndpoint = 'https://api.anthropic.com/oauth/authorize'
      const complexUri = 'chrome-extension://test-id/oauth?callback=true&origin=local'

      const url = initOAuthFlow(authEndpoint, mockClientId, complexUri, [])

      expect(url).toContain('redirect_uri=')
    })
  })

  describe('handleOAuthCallback', () => {
    it('should handle network errors', async () => {
      const tokenEndpoint = 'https://invalid-endpoint.test/token'

      await expect(
        handleOAuthCallback(
          mockAuthorizationCode,
          tokenEndpoint,
          mockClientId,
          mockClientSecret,
          mockRedirectUri
        )
      ).rejects.toThrow()
    })
  })

  describe('validateOAuthState', () => {
    it('should validate correct state parameter', () => {
      const state = 'test-state-123'
      localStorage.setItem('oauth_state', state)

      const isValid = validateOAuthState(state)

      expect(isValid).toBe(true)
    })

    it('should reject mismatched state parameter', () => {
      const storedState = 'stored-state-123'
      const receivedState = 'received-state-456'
      localStorage.setItem('oauth_state', storedState)

      const isValid = validateOAuthState(receivedState)

      expect(isValid).toBe(false)
    })

    it('should reject when no state is stored', () => {
      const receivedState = 'received-state-123'

      const isValid = validateOAuthState(receivedState)

      expect(isValid).toBe(false)
    })

    it('should reject when received state is empty', () => {
      localStorage.setItem('oauth_state', 'stored-state')

      const isValid = validateOAuthState('')

      expect(isValid).toBe(false)
    })

    it('should clear state after validation', () => {
      const state = 'test-state-123'
      localStorage.setItem('oauth_state', state)

      validateOAuthState(state)

      expect(localStorage.getItem('oauth_state')).toBeNull()
    })
  })

  describe('refreshOAuthToken', () => {
    it('should handle network errors gracefully', async () => {
      const tokenEndpoint = 'https://invalid-endpoint.test/token'

      await expect(
        refreshOAuthToken(
          mockRefreshToken,
          tokenEndpoint,
          mockClientId,
          mockClientSecret
        )
      ).rejects.toThrow()
    })
  })

  describe('revokeOAuthToken', () => {
    it('should handle revocation errors gracefully', async () => {
      const revokeEndpoint = 'https://invalid-endpoint.test/revoke'

      await expect(
        revokeOAuthToken(
          mockAccessToken,
          revokeEndpoint,
          mockClientId,
          mockClientSecret
        )
      ).rejects.toThrow()
    })
  })

})

