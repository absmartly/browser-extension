export interface ABSmartlyContext {
  treatment(experimentName: string): number
  peek(experimentName: string): number | undefined

  ready(): Promise<void>
  pending(): boolean
  data(): ContextData | null

  eventLogger?(): EventLogger | null
  _eventLogger?: EventLogger

  assignments_?: Record<string, number>

  __domPlugin?: PluginRegistration
  __overridesPlugin?: PluginRegistration
  __eventLoggerIntercepted?: boolean

  data_?: ContextData
}

export interface ContextData {
  experiments: Experiment[]
  [key: string]: unknown
}

export interface Experiment {
  id: number
  name: string
  variants: Variant[]
  [key: string]: unknown
}

export interface Variant {
  name: string
  config?: string | Record<string, unknown>
  [key: string]: unknown
}

export interface EventLogger {
  (ctx: ABSmartlyContext, eventName: string, data?: unknown): void
}

export interface PluginRegistration {
  initialized: boolean
  version?: string
  capabilities?: string[]
  timestamp?: number
  instance?: unknown
}

export interface ABSmartlySDK {
  createContext(config: unknown): Promise<ABSmartlyContext>
  __createContextIntercepted?: boolean
}

export interface ABSmartlySDKModule {
  SDK: new (config: unknown) => ABSmartlySDK
}
