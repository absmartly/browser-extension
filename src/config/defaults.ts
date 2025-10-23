export const DEFAULT_CONFIG = {
  queryPrefix: "_",
  persistQueryToCookie: true,
  injectSDK: false,
  sdkUrl: "",
} as const

export type DefaultConfig = typeof DEFAULT_CONFIG
