export const DEFAULT_CONFIG = {
  queryPrefix: "_",
  persistQueryToCookie: true,
} as const

export type DefaultConfig = typeof DEFAULT_CONFIG
