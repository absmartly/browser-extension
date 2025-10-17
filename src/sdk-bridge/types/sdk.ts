/**
 * ABsmartly SDK Type Definitions
 *
 * Types for the ABsmartly JavaScript SDK running on the page
 */

export interface ABSmartlyContext {
  // Treatment methods
  treatment(experimentName: string): number
  peek(experimentName: string): number | undefined

  // Context state
  ready(): Promise<void>
  pending(): boolean
  data(): ContextData | null

  // Event logging
  eventLogger?(): EventLogger | null
  _eventLogger?: EventLogger

  // Assignments
  assignments_?: Record<string, number>

  // Plugin registration
  __domPlugin?: PluginRegistration
  __overridesPlugin?: PluginRegistration
  __eventLoggerIntercepted?: boolean

  // Internal data
  data_?: ContextData
}

export interface ContextData {
  experiments: Experiment[]
  [key: string]: any
}

export interface Experiment {
  id: number
  name: string
  variants: Variant[]
  [key: string]: any
}

export interface Variant {
  name: string
  config?: string | Record<string, any>
  [key: string]: any
}

export interface EventLogger {
  (ctx: ABSmartlyContext, eventName: string, data?: any): void
}

export interface PluginRegistration {
  initialized: boolean
  version?: string
  capabilities?: string[]
  timestamp?: number
  instance?: any
}

export interface ABSmartlySDK {
  createContext(config: any): Promise<ABSmartlyContext>
  __createContextIntercepted?: boolean
}

export interface ABSmartlySDKModule {
  SDK: new (config: any) => ABSmartlySDK
}
