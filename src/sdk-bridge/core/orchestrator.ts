/**
 * Core Orchestrator
 *
 * Coordinates SDK detection, plugin initialization, and message handling
 *
 * @module Orchestrator
 */

import { Logger } from '../utils/logger'
import { SDKDetector } from '../sdk/sdk-detector'
import { PluginDetector } from '../sdk/plugin-detector'
import { SDKInterceptor } from '../sdk/sdk-interceptor'
import { CodeInjector } from '../experiment/code-injector'
import { OverrideManager } from '../experiment/override-manager'
import { PreviewManager } from '../dom/preview-manager'

export interface OrchestratorConfig {
  maxAttempts?: number
  attemptInterval?: number
  debug?: boolean
}

export interface InitializationState {
  isInitializing: boolean
  isInitialized: boolean
  cachedContext: any | null
  contextPropertyPath: string | null
}

export class Orchestrator {
  private config: Required<OrchestratorConfig>
  private state: InitializationState
  private sdkDetector: SDKDetector
  private pluginDetector: PluginDetector
  private sdkInterceptor: SDKInterceptor
  private codeInjector: CodeInjector
  private overrideManager: OverrideManager
  private previewManager: PreviewManager
  private messageListenerSet: boolean = false

  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      maxAttempts: config.maxAttempts || 5, // 0.5 seconds at 100ms intervals
      attemptInterval: config.attemptInterval || 100,
      debug: config.debug !== false
    }

    this.state = {
      isInitializing: false,
      isInitialized: false,
      cachedContext: null,
      contextPropertyPath: null
    }

    this.sdkDetector = new SDKDetector()
    this.pluginDetector = new PluginDetector()
    this.sdkInterceptor = new SDKInterceptor({
      onSDKEvent: (eventName, data) => {
        this.handleSDKEvent(eventName, data)
      }
    })
    this.codeInjector = new CodeInjector()
    this.overrideManager = new OverrideManager()
    this.previewManager = new PreviewManager()
  }

  /**
   * Start the initialization process
   */
  start(): void {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.waitForSDKAndInitialize())
    } else {
      // Give the page a moment to initialize its SDK
      setTimeout(() => this.waitForSDKAndInitialize(), 100)
    }
  }

  /**
   * Wait for SDK and initialize
   */
  private waitForSDKAndInitialize(): void {
    Logger.log('[ABsmartly Extension] \u{1F680} waitForSDKAndInitialize started')

    let attempts = 0

    const checkAndInit = (): void => {
      attempts++
      Logger.log(`[ABsmartly Extension] \u{1F50D} Check attempt ${attempts}/${this.config.maxAttempts}`)

      // Detect context only once
      if (!this.state.cachedContext) {
        Logger.log('[ABsmartly Extension] \u{1F50E} No cached context, detecting SDK...')
        this.detectAndCacheContext()
      } else {
        Logger.log('[ABsmartly Extension] \u2705 Using cached context')
      }

      // Log context data when found (but only if context is ready)
      if (this.state.cachedContext && this.state.cachedContext.data && typeof this.state.cachedContext.data === 'function') {
        // Use ready() promise to wait for context to be ready before accessing data
        if (this.state.cachedContext.ready && typeof this.state.cachedContext.ready === 'function') {
          this.state.cachedContext.ready()
            .then(() => {
              try {
                const data = this.state.cachedContext.data()
                Logger.log('[ABsmartly Extension] Context data on init:', data)
                Logger.log('[ABsmartly Extension] Experiments available:', data?.experiments ? Object.keys(data.experiments) : 'none')
              } catch (error: any) {
                Logger.log('[ABsmartly Extension] Error accessing context data:', error.message)
              }
            })
            .catch((error: any) => {
              Logger.log('[ABsmartly Extension] Context ready() failed:', error.message)
            })
        }
      }

      // Check if plugin is already loaded (uses cached context)
      const existingPlugin = this.pluginDetector.detectPlugin(this.state.cachedContext)
      if (existingPlugin) {
        if (existingPlugin === 'active-but-inaccessible') {
          Logger.log('[ABsmartly Extension] Plugin is active but we cannot access it to inject custom code')
          return
        }

        Logger.log('[ABsmartly Extension] Plugin already loaded, requesting custom code injection only')

        // Plugin is already loaded and registered with context
        // Store metadata for SDK consumption (OverridesPlugin handles actual application)
        this.overrideManager.checkOverridesCookie()

        // Request custom code from extension
        this.sendMessageToExtension({
          source: 'absmartly-page',
          type: 'REQUEST_CUSTOM_CODE'
        })
        return
      }

      const context = this.state.cachedContext

      if (context) {
        Logger.log('[ABsmartly Extension] SDK context found, requesting plugin initialization')

        // Check if context needs to be ready
        if (context.ready && typeof context.ready === 'function' && context.pending && context.pending()) {
          Logger.log('[ABsmartly Extension] Context is pending, waiting for it to be ready...')
          context.ready()
            .then(() => {
              Logger.log('[ABsmartly Extension] Context is now ready after waiting')
              const data = context.data ? context.data() : null
              Logger.log('[ABsmartly Extension] Context data after ready:', data)
              Logger.log('[ABsmartly Extension] Experiments after ready:', data?.experiments ? Object.keys(data.experiments) : 'none')
            })
            .catch((err: any) => {
              Logger.error('[ABsmartly Extension] Error waiting for context:', err)
            })
        }

        // Store override metadata for SDK consumption
        // The OverridesPlugin will handle actual application of overrides
        this.overrideManager.checkOverridesCookie()

        // Request plugin initialization from extension
        this.sendMessageToExtension({
          source: 'absmartly-page',
          type: 'SDK_CONTEXT_READY'
        })
      } else if (attempts < this.config.maxAttempts) {
        setTimeout(checkAndInit, this.config.attemptInterval)
      } else {
        Logger.log('[ABsmartly Extension] No ABsmartly SDK found after 5 seconds')
      }
    }

    // Start checking
    checkAndInit()
  }

  /**
   * Detect SDK and cache context
   */
  private detectAndCacheContext(): void {
    const detection = this.sdkDetector.detectSDK()

    if (detection.context && !this.state.cachedContext) {
      this.state.cachedContext = detection.context
      this.state.contextPropertyPath = detection.contextPath || 'unknown'

      Logger.log('[ABsmartly Extension] \u2705 Context found and cached at:', this.state.contextPropertyPath)
      Logger.log('[ABsmartly Extension] \u{1F4CA} Context details:', {
        hasTreatment: !!detection.context.treatment,
        hasPeek: !!detection.context.peek,
        hasData: !!detection.context.data,
        hasEventLogger: !!detection.context.eventLogger,
        has_eventLogger: detection.context._eventLogger !== undefined,
        contextType: typeof detection.context
      })

      // Intercept eventLogger on this context
      this.sdkInterceptor.interceptEventLogger(detection.context)
    } else if (!detection.context) {
      Logger.warn('[ABsmartly Extension] \u26A0\uFE0F No context found after detection')
    }
  }

  /**
   * Setup message listener for extension communication
   */
  setupMessageListener(): void {
    if (this.messageListenerSet) {
      return
    }

    this.messageListenerSet = true
    Logger.log('[ABsmartly Extension] Setting up message listener for extension messages')

    window.addEventListener('message', (event) => {
      if (!event.data || event.data.source !== 'absmartly-extension') {
        return
      }

      Logger.log('[ABsmartly Page] Received message from extension:', event.data)

      this.handleExtensionMessage(event.data)
    })
  }

  /**
   * Handle messages from extension
   */
  private handleExtensionMessage(message: any): void {
    const { type, payload } = message

    switch (type) {
      case 'APPLY_OVERRIDES':
        this.handleApplyOverrides(payload)
        break

      case 'ABSMARTLY_PREVIEW':
        if (payload?.action === 'apply') {
          this.handlePreviewChanges(payload)
        } else if (payload?.action === 'remove') {
          this.handleRemovePreview(payload)
        }
        break

      case 'PREVIEW_CHANGES':
        this.handlePreviewChanges(payload)
        break

      case 'REMOVE_PREVIEW':
        this.handleRemovePreview(payload)
        break

      case 'INITIALIZE_PLUGIN':
        this.handleInitializePlugin(payload)
        break

      case 'INJECT_CUSTOM_CODE':
        Logger.log('[ABsmartly Extension] INJECT_CUSTOM_CODE message received but not used')
        break

      default:
        Logger.warn('[ABsmartly Extension] Unknown message type:', type)
    }
  }

  /**
   * Handle apply overrides message
   */
  private handleApplyOverrides(payload: any): void {
    Logger.log('[ABsmartly Page] Applying overrides dynamically')
    const { overrides } = payload || {}

    // The OverridesPlugin handles override application
    // We just need to update metadata and reload the page
    if (overrides) {
      // Store metadata about overrides
      this.overrideManager.checkOverridesCookie()
      // After updating overrides, we need to refresh the page for changes to take effect
      Logger.log('[ABsmartly Page] Override metadata updated. Page will reload to apply changes.')
    }
  }

  /**
   * Handle preview changes message (applies changes directly using PreviewManager)
   */
  private handlePreviewChanges(payload: any): void {
    Logger.log('[ABsmartly Page] Handling PREVIEW_CHANGES message')
    const { changes, experimentName, variantName } = payload || {}
    const expName = experimentName || '__preview__'

    Logger.log('[ABsmartly Page] Preview changes received for experiment:', expName)
    Logger.log('[ABsmartly Page] Variant name:', variantName)
    Logger.log('[ABsmartly Page] Changes to apply:', changes)

    if (!changes || changes.length === 0) {
      Logger.warn('[ABsmartly Page] No changes to apply')
      return
    }

    // Apply changes using the PreviewManager
    try {
      Logger.log('[ABsmartly Page] Applying changes via PreviewManager')
      let appliedCount = 0
      changes.forEach((change: any) => {
        const success = this.previewManager.applyPreviewChange(change, expName)
        if (success) appliedCount++
      })
      Logger.log(`[ABsmartly Page] Applied ${appliedCount}/${changes.length} changes successfully`)
    } catch (error) {
      Logger.error('[ABsmartly Page] Error applying preview changes:', error)
    }
  }

  /**
   * Handle remove preview message (removes changes directly using PreviewManager)
   */
  private handleRemovePreview(payload: any): void {
    Logger.log('[ABsmartly Page] Handling REMOVE_PREVIEW message')
    const { experimentName } = payload || {}
    const expName = experimentName || '__preview__'

    Logger.log('[ABsmartly Page] Removing preview changes for experiment:', expName)

    // Remove changes using the PreviewManager
    try {
      Logger.log('[ABsmartly Page] Removing changes via PreviewManager')
      const success = this.previewManager.removePreviewChanges(expName)
      if (success) {
        Logger.log('[ABsmartly Page] Changes removed successfully')
      } else {
        Logger.warn('[ABsmartly Page] No changes were removed (no elements found)')
      }
    } catch (error) {
      Logger.error('[ABsmartly Page] Error removing preview changes:', error)
    }
  }

  /**
   * Handle initialize plugin message
   */
  private handleInitializePlugin(payload: any): void {
    // Prevent multiple initializations
    if (this.state.isInitialized || this.state.isInitializing) {
      Logger.log('[ABsmartly Extension] Already initialized or initializing, skipping')
      return
    }

    this.state.isInitializing = true

    const { config } = payload || {}
    Logger.log('[ABsmartly Extension] Received config from extension:', config)

    // Check again if plugin is already loaded
    const existingPlugin = this.pluginDetector.detectPlugin(this.state.cachedContext)
    if (existingPlugin && existingPlugin !== 'active-but-inaccessible') {
      // Custom code will be injected via INJECTION_CODE message from the plugin
      this.state.isInitialized = true
      this.state.isInitializing = false
      return
    }

    // Use cached context (should already be detected by waitForSDKAndInitialize)
    const context = this.state.cachedContext

    if (!context) {
      Logger.error('[ABsmartly Extension] No context available for plugin initialization')
      this.state.isInitializing = false
      return
    }

    // Check if plugin is already registered with context
    if (context.__domPlugin && context.__domPlugin.initialized) {
      Logger.log('[ABsmartly Extension] Plugin already initialized via context.__domPlugin')
      this.state.isInitializing = false
      return
    }

    // Inject experiment code
    try {
      Logger.log('[ABsmartly Extension] Checking for experiment-specific injection code')
      this.codeInjector.injectExperimentCode(context)
    } catch (error) {
      Logger.error('[ABsmartly Extension] Failed to inject experiment code:', error)
    }

    // Notify extension that initialization is complete
    this.sendMessageToExtension({
      source: 'absmartly-page',
      type: 'PLUGIN_INITIALIZED',
      payload: {
        version: '1.0.0',
        capabilities: ['code-injection']
      }
    })

    this.state.isInitialized = true
    this.state.isInitializing = false
  }

  /**
   * Handle SDK event
   */
  private handleSDKEvent(eventName: string, data: any): void {
    Logger.log('[ABsmartly Extension] \u{1F514} SDK Event:', { eventName, data })

    // Send to extension
    this.sendMessageToExtension({
      source: 'absmartly-page',
      type: 'SDK_EVENT',
      payload: {
        eventName,
        data,
        timestamp: new Date().toISOString()
      }
    })
  }

  /**
   * Send message to extension
   */
  private sendMessageToExtension(message: any): void {
    // Always send via window.postMessage (content script will relay to background)
    window.postMessage(message, '*')
  }

  /**
   * Get cached context
   */
  getContext(): any | null {
    return this.state.cachedContext
  }

  /**
   * Get initialization state
   */
  getState(): InitializationState {
    return { ...this.state }
  }

  /**
   * Expose variant assignments getter for extension
   */
  exposeVariantAssignments(): void {
    (window as any).__absmartlyGetVariantAssignments = async (experimentNames: string[]) => {
      Logger.log('[ABsmartly Extension] Getting variant assignments for:', experimentNames)

      const context = this.state.cachedContext || this.sdkDetector.detectSDK().context

      if (!context) {
        Logger.warn('[ABsmartly Extension] No context available for getting variants')
        return { assignments: {}, experimentsInContext: [] }
      }

      // Check if context is ready, if not wait for it
      if (context.ready && typeof context.ready === 'function') {
        try {
          await context.ready()
        } catch (error) {
          Logger.warn('[ABsmartly Extension] Error waiting for context ready:', error)
        }
      }

      // Get experiments that exist in the context data
      let experimentsInContext: string[] = []
      if (context.data && typeof context.data === 'function') {
        const contextData = context.data()
        if (contextData?.experiments) {
          experimentsInContext = Object.keys(contextData.experiments)
        }
      }

      const assignments: Record<string, number> = {}
      for (const expName of experimentNames) {
        try {
          if (typeof context.peek === 'function') {
            const variant = context.peek(expName)

            // Only include valid variant assignments (not -1, null, or undefined)
            // But DO include 0 as it's a valid variant
            if (variant !== undefined && variant !== null && variant !== -1) {
              assignments[expName] = variant
            }
          }
        } catch (error) {
          Logger.warn(`[ABsmartly Extension] Failed to peek experiment ${expName}:`, error)
        }
      }

      return { assignments, experimentsInContext }
    }
  }

  /**
   * Expose context path getter for extension
   */
  exposeContextPath(): void {
    (window as any).__absmartlyGetContextPath = () => {
      // First detect SDK if not already cached
      if (!this.state.cachedContext) {
        this.detectAndCacheContext()
      }

      return {
        found: !!this.state.cachedContext,
        path: this.state.contextPropertyPath || null,
        hasContext: !!this.state.cachedContext,
        hasPeek: !!(this.state.cachedContext && typeof this.state.cachedContext.peek === 'function'),
        hasTreatment: !!(this.state.cachedContext && typeof this.state.cachedContext.treatment === 'function')
      }
    }
  }
}
