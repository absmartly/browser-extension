import {
  initOAuthFlow,
  handleOAuthCallback,
  validateOAuthState,
  refreshOAuthToken,
  revokeOAuthToken
} from '../oauth'
import axios from 'axios'
import { jest } from '@jest/globals'

jest.mock('axios')
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
    it('should exchange authorization code for access token', async () => {
      const tokenEndpoint = 'https://api.anthropic.com/oauth/token'
      const mockResponse = {
        data: {
          access_token: mockAccessToken,
          refresh_token: mockRefreshToken,
          expires_in: 3600,
          token_type: 'Bearer'
        }
      }

      jest.mocked(axios).mockResolvedValue(mockResponse)

      const result = await handleOAuthCallback(
        mockAuthorizationCode,
        tokenEndpoint,
        mockClientId,
        mockClientSecret,
        mockRedirectUri
      )

      expect(result.accessToken).toBe(mockAccessToken)
      expect(result.refreshToken).toBe(mockRefreshToken)
      expect(result.expiresIn).toBe(3600)
      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: tokenEndpoint,
          data: expect.objectContaining({
            grant_type: 'authorization_code',
            code: mockAuthorizationCode
          })
        })
      )
    })

    it('should handle token endpoint error responses', async () => {
      const tokenEndpoint = 'https://api.anthropic.com/oauth/token'
      const mockError = {
        response: {
          status: 400,
          data: {
            error: 'invalid_code',
            error_description: 'Authorization code has expired'
          }
        }
      }

      jest.mocked(axios).mockRejectedValue(mockError)

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

    it('should throw error for invalid authorization code', async () => {
      const tokenEndpoint = 'https://api.anthropic.com/oauth/token'
      const mockError = {
        response: {
          status: 401,
          data: {
            error: 'invalid_request',
            error_description: 'Invalid authorization code'
          }
        }
      }

      jest.mocked(axios).mockRejectedValue(mockError)

      await expect(
        handleOAuthCallback(
          'invalid-code',
          tokenEndpoint,
          mockClientId,
          mockClientSecret,
          mockRedirectUri
        )
      ).rejects.toThrow()
    })

    it('should calculate token expiration time correctly', async () => {
      const tokenEndpoint = 'https://api.anthropic.com/oauth/token'
      const expiresIn = 7200
      const mockResponse = {
        data: {
          access_token: mockAccessToken,
          refresh_token: mockRefreshToken,
          expires_in: expiresIn,
          token_type: 'Bearer'
        }
      }

      jest.mocked(axios).mockResolvedValue(mockResponse)

      const beforeCall = Date.now()
      const result = await handleOAuthCallback(
        mockAuthorizationCode,
        tokenEndpoint,
        mockClientId,
        mockClientSecret,
        mockRedirectUri
      )
      const afterCall = Date.now()

      expect(result.expiresAt).toBeGreaterThanOrEqual(beforeCall + expiresIn * 1000)
      expect(result.expiresAt).toBeLessThanOrEqual(afterCall + expiresIn * 1000)
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
    it('should refresh expired access token using refresh token', async () => {
      const tokenEndpoint = 'https://api.anthropic.com/oauth/token'
      const newAccessToken = 'new-access-token-456'
      const mockResponse = {
        data: {
          access_token: newAccessToken,
          refresh_token: mockRefreshToken,
          expires_in: 3600,
          token_type: 'Bearer'
        }
      }

      jest.mocked(axios).mockResolvedValue(mockResponse)

      const result = await refreshOAuthToken(
        mockRefreshToken,
        tokenEndpoint,
        mockClientId,
        mockClientSecret
      )

      expect(result.accessToken).toBe(newAccessToken)
      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: tokenEndpoint,
          data: expect.objectContaining({
            grant_type: 'refresh_token',
            refresh_token: mockRefreshToken
          })
        })
      )
    })

    it('should throw error when refresh token is invalid', async () => {
      const tokenEndpoint = 'https://api.anthropic.com/oauth/token'
      const mockError = {
        response: {
          status: 401,
          data: {
            error: 'invalid_grant',
            error_description: 'Refresh token has expired'
          }
        }
      }

      jest.mocked(axios).mockRejectedValue(mockError)

      await expect(
        refreshOAuthToken(
          'expired-refresh-token',
          tokenEndpoint,
          mockClientId,
          mockClientSecret
        )
      ).rejects.toThrow()
    })

    it('should handle network errors gracefully', async () => {
      const tokenEndpoint = 'https://api.anthropic.com/oauth/token'
      const mockError = new Error('Network timeout')

      jest.mocked(axios).mockRejectedValue(mockError)

      await expect(
        refreshOAuthToken(
          mockRefreshToken,
          tokenEndpoint,
          mockClientId,
          mockClientSecret
        )
      ).rejects.toThrow('Network timeout')
    })
  })

  describe('revokeOAuthToken', () => {
    it('should revoke access token', async () => {
      const revokeEndpoint = 'https://api.anthropic.com/oauth/revoke'
      const mockResponse = { data: { success: true } }

      jest.mocked(axios).mockResolvedValue(mockResponse)

      const result = await revokeOAuthToken(
        mockAccessToken,
        revokeEndpoint,
        mockClientId,
        mockClientSecret
      )

      expect(result.success).toBe(true)
      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: revokeEndpoint
        })
      )
    })

    it('should handle revocation errors gracefully', async () => {
      const revokeEndpoint = 'https://api.anthropic.com/oauth/revoke'
      const mockError = {
        response: {
          status: 400,
          data: {
            error: 'invalid_request'
          }
        }
      }

      jest.mocked(axios).mockRejectedValue(mockError)

      await expect(
        revokeOAuthToken(
          mockAccessToken,
          revokeEndpoint,
          mockClientId,
          mockClientSecret
        )
      ).rejects.toThrow()
    })

    it('should support revoking refresh token', async () => {
      const revokeEndpoint = 'https://api.anthropic.com/oauth/revoke'
      const mockResponse = { data: { success: true } }

      jest.mocked(axios).mockResolvedValue(mockResponse)

      await revokeOAuthToken(
        mockRefreshToken,
        revokeEndpoint,
        mockClientId,
        mockClientSecret,
        'refresh_token'
      )

      expect(axios).toHaveBeenCalled()
    })
  })

  describe('Token Storage and Retrieval', () => {
    it('should store OAuth token securely', async () => {
      const tokenEndpoint = 'https://api.anthropic.com/oauth/token'
      const mockResponse = {
        data: {
          access_token: mockAccessToken,
          refresh_token: mockRefreshToken,
          expires_in: 3600,
          token_type: 'Bearer'
        }
      }

      jest.mocked(axios).mockResolvedValue(mockResponse)

      const result = await handleOAuthCallback(
        mockAuthorizationCode,
        tokenEndpoint,
        mockClientId,
        mockClientSecret,
        mockRedirectUri
      )

      expect(result.accessToken).toBeDefined()
      expect(result.refreshToken).toBeDefined()
    })

    it('should handle token expiration detection', async () => {
      const tokenEndpoint = 'https://api.anthropic.com/oauth/token'
      const expiresIn = 1
      const mockResponse = {
        data: {
          access_token: mockAccessToken,
          refresh_token: mockRefreshToken,
          expires_in: expiresIn,
          token_type: 'Bearer'
        }
      }

      jest.mocked(axios).mockResolvedValue(mockResponse)

      const result = await handleOAuthCallback(
        mockAuthorizationCode,
        tokenEndpoint,
        mockClientId,
        mockClientSecret,
        mockRedirectUri
      )

      await new Promise(resolve => setTimeout(resolve, 2000))

      const hasExpired = result.expiresAt && result.expiresAt < Date.now()
      expect(hasExpired).toBe(true)
    })
  })
})
