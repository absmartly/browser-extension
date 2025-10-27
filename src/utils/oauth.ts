import axios from 'axios'
import { debugLog, debugError } from './debug'

export interface OAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  authEndpoint: string
  tokenEndpoint: string
  revokeEndpoint?: string
  scopes?: string[]
}

export interface OAuthToken {
  accessToken: string
  refreshToken?: string
  expiresIn: number
  expiresAt?: number
  tokenType: string
}

export function initOAuthFlow(
  authEndpoint: string,
  clientId: string,
  redirectUri: string,
  scopes: string[] = [],
  state?: string
): string {
  const stateParam = state || generateRandomState()

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    state: stateParam
  })

  return `${authEndpoint}?${params.toString()}`
}

export async function handleOAuthCallback(
  authorizationCode: string,
  tokenEndpoint: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<OAuthToken> {
  try {
    debugLog('Exchanging authorization code for access token...')

    const response = await axios({
      method: 'POST',
      url: tokenEndpoint,
      data: {
        grant_type: 'authorization_code',
        code: authorizationCode,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri
      },
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const { access_token, refresh_token, expires_in, token_type } = response.data

    const token: OAuthToken = {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
      expiresAt: Date.now() + expires_in * 1000,
      tokenType: token_type || 'Bearer'
    }

    debugLog('Successfully exchanged authorization code for access token')
    return token
  } catch (error) {
    debugError('Failed to exchange authorization code:', error)
    throw error
  }
}

export function validateOAuthState(receivedState: string): boolean {
  if (!receivedState) {
    return false
  }

  const storedState = localStorage.getItem('oauth_state')
  const isValid = storedState === receivedState

  if (isValid) {
    localStorage.removeItem('oauth_state')
  }

  return isValid
}

export async function refreshOAuthToken(
  refreshToken: string,
  tokenEndpoint: string,
  clientId: string,
  clientSecret: string
): Promise<OAuthToken> {
  try {
    debugLog('Refreshing OAuth token...')

    const response = await axios({
      method: 'POST',
      url: tokenEndpoint,
      data: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret
      },
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const { access_token, refresh_token, expires_in, token_type } = response.data

    const token: OAuthToken = {
      accessToken: access_token,
      refreshToken: refresh_token || refreshToken,
      expiresIn: expires_in,
      expiresAt: Date.now() + expires_in * 1000,
      tokenType: token_type || 'Bearer'
    }

    debugLog('Successfully refreshed OAuth token')
    return token
  } catch (error) {
    debugError('Failed to refresh OAuth token:', error)
    throw error
  }
}

export async function revokeOAuthToken(
  token: string,
  revokeEndpoint: string,
  clientId: string,
  clientSecret: string,
  tokenTypeHint?: string
): Promise<{ success: boolean }> {
  try {
    debugLog('Revoking OAuth token...')

    const data: any = {
      token,
      client_id: clientId,
      client_secret: clientSecret
    }

    if (tokenTypeHint) {
      data.token_type_hint = tokenTypeHint
    }

    await axios({
      method: 'POST',
      url: revokeEndpoint,
      data,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    debugLog('Successfully revoked OAuth token')
    return { success: true }
  } catch (error) {
    debugError('Failed to revoke OAuth token:', error)
    throw error
  }
}

export async function exchangeClaudeOAuthCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<OAuthToken> {
  try {
    debugLog('Exchanging Claude OAuth code for access token...')

    const response = await axios({
      method: 'POST',
      url: 'https://api.anthropic.com/oauth/token',
      data: {
        grant_type: 'authorization_code',
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri
      },
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const { access_token, refresh_token, expires_in, token_type } = response.data

    const token: OAuthToken = {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
      expiresAt: Date.now() + expires_in * 1000,
      tokenType: token_type || 'Bearer'
    }

    debugLog('Successfully exchanged Claude OAuth code for access token')
    return token
  } catch (error) {
    debugError('Failed to exchange Claude OAuth code:', error)
    throw error
  }
}

function generateRandomState(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let state = ''
  for (let i = 0; i < length; i++) {
    state += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  localStorage.setItem('oauth_state', state)
  return state
}
