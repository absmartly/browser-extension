/**
 * Configuration Type Definitions
 *
 * Types for configuration and settings
 */

export interface PluginConfig {
  context?: any
  sdkEndpoint?: string
  apiEndpoint?: string
  absmartlyEndpoint?: string
  cookieName?: string
  cookieOptions?: CookieOptions
  useQueryString?: boolean
  queryPrefix?: string
  envParam?: string
  persistQueryToCookie?: boolean
  debug?: boolean
}

export interface CookieOptions {
  path?: string
  maxAge?: number
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
}

export interface URLFilter {
  matchType?: 'path' | 'full-url' | 'domain' | 'query' | 'hash'
  include?: string[]
  exclude?: string[]
  mode?: 'regex' | 'wildcard'
}

export interface InjectionCode {
  urlFilter?: URLFilter | string | string[]
  headStart?: string
  headEnd?: string
  bodyStart?: string
  bodyEnd?: string
}

export interface OverrideMetadata {
  variant?: number
  env?: number
  id?: number
}

export type ExperimentOverrides = Record<string, number | OverrideMetadata>
