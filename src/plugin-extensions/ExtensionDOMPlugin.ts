/**
 * ExtensionDOMPlugin
 * Wraps DOMChangesPluginLite with extension-specific functionality
 * - State management for change reversion
 * - Message bridge for extension communication
 * - Code injection capabilities
 */

import { StateManager } from './StateManager'
import { MessageBridge } from './MessageBridge'
import { CodeInjector, InjectionCode } from './CodeInjector'

export interface PluginConfig {
  context: any
  autoApply?: boolean
  spa?: boolean
  visibilityTracking?: boolean
  dataSource?: 'variable' | 'customData'
  dataFieldName?: string
  debug?: boolean
}

export interface DOMChange {
  selector: string
  type: string
  value?: any
  styles?: Record<string, string>
  className?: string
  attribute?: string
  enabled?: boolean
}

/**
 * ExtensionDOMPlugin
 * Extends DOMChangesPluginLite with browser extension features
 */
export class ExtensionDOMPlugin {
  private basePlugin: any // Will be DOMChangesPluginLite
  private stateManager: StateManager
  private messageBridge: MessageBridge
  private codeInjector: CodeInjector
  private config: Required<PluginConfig>
  private initialized = false

  constructor(basePlugin: any, config: PluginConfig) {
    this.basePlugin = basePlugin
    this.config = {
      context: config.context,
      autoApply: config.autoApply ?? true,
      spa: config.spa ?? true,
      visibilityTracking: config.visibilityTracking ?? true,
      dataSource: config.dataSource ?? 'variable',
      dataFieldName: config.dataFieldName ?? '__dom_changes',
      debug: config.debug ?? false
    }

    this.stateManager = new StateManager(this.config.debug)
    this.messageBridge = new MessageBridge(this.config.debug)
    this.codeInjector = new CodeInjector(this.config.debug)

    this.setupMessageHandlers()
  }

  /**
   * Initialize the plugin
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    // Initialize base plugin
    if (this.basePlugin.initialize) {
      await this.basePlugin.initialize()
    }

    // Listen to base plugin events
    if (this.basePlugin.on) {
      this.basePlugin.on('change-applied', (data: any) => {
        this.handleChangeApplied(data)
      })

      this.basePlugin.on('experiment-triggered', (data: any) => {
        this.messageBridge.notifyExperimentTriggered(
          data.experimentName,
          data.variant
        )
      })
    }

    // Notify extension that plugin is ready
    this.messageBridge.notifyReady('1.0.0', [
      'state-management',
      'change-reversion',
      'code-injection',
      'preview-changes'
    ])

    // Register with context (MUST be after base plugin initialization)
    // This ensures we override any registration from the base plugin
    if (this.config.context) {
      this.config.context.__domPlugin = {
        instance: this,
        initialized: true,
        version: '1.0.0',
        capabilities: ['state-management', 'change-reversion'],
        timestamp: Date.now()
      }

      // Also store globally for easier access
      if (typeof window !== 'undefined') {
        ;(window as any).__absmartlyPlugin = this
        ;(window as any).__absmartlyDOMChangesPlugin = this
      }
    }

    this.initialized = true

    if (this.config.debug) {
      console.log('[ExtensionDOMPlugin] Initialized successfully')
      console.log('[ExtensionDOMPlugin] Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(this)).filter(name => typeof (this as any)[name] === 'function'))
      console.log('[ExtensionDOMPlugin] removeChanges is function:', typeof this.removeChanges === 'function')
    }
  }

  /**
   * Apply a single DOM change with state tracking
   */
  applyChange(change: DOMChange, experimentName: string = '__preview__'): boolean {
    if (!change.selector || !change.type) {
      return false
    }

    // Skip disabled changes
    if (change.enabled === false) {
      return false
    }

    const elements = document.querySelectorAll(change.selector)

    if (elements.length === 0) {
      if (this.config.debug) {
        console.warn(`[ExtensionDOMPlugin] No elements found for: ${change.selector}`)
      }
      return false
    }

    let success = true

    elements.forEach((element) => {
      try {
        // Store original state before modification
        const originalState = this.stateManager.storeState(element, experimentName)

        // Apply the change manually (we handle all preview changes ourselves)
        // The base plugin (Lite) only handles automatic application from context
        this.applyChangeManually(element as HTMLElement, change, experimentName)

        // Track the applied change
        this.stateManager.trackChange({
          experimentName,
          selector: change.selector,
          type: change.type,
          element,
          originalState
        })

        if (this.config.debug) {
          console.log(`[ExtensionDOMPlugin] Applied ${change.type} change to element:`, {
            selector: change.selector,
            experimentName,
            element
          })
        }
      } catch (error) {
        console.error('[ExtensionDOMPlugin] Error applying change:', error)
        success = false
      }
    })

    return success
  }

  /**
   * Remove all changes for an experiment
   */
  removeChanges(experimentName: string): boolean {
    if (this.config.debug) {
      console.log(`[ExtensionDOMPlugin] Removing changes for: ${experimentName}`)
    }

    return this.stateManager.removeExperiment(experimentName)
  }

  /**
   * Revert a specific change
   */
  revertChange(element: Element, experimentName: string): boolean {
    return this.stateManager.revertElement(element, experimentName)
  }

  /**
   * Get original state of an element
   */
  getOriginalState(element: Element, experimentName: string): any {
    return this.stateManager.getState(element, experimentName)
  }

  /**
   * Get all applied changes for an experiment
   */
  getAppliedChanges(experimentName: string): any[] {
    return this.stateManager.getAppliedChanges(experimentName)
  }

  /**
   * Inject custom code
   */
  injectCode(code: InjectionCode): void {
    this.codeInjector.injectCode(code)
  }

  /**
   * Listen for base plugin events
   */
  on(event: string, handler: (data: any) => void): void {
    if (this.basePlugin.on) {
      this.basePlugin.on(event, handler)
    }
  }

  /**
   * Get the base plugin instance
   */
  getBasePlugin(): any {
    return this.basePlugin
  }

  /**
   * Setup message handlers for extension communication
   */
  private setupMessageHandlers(): void {
    // Handle preview changes from extension
    this.messageBridge.on('PREVIEW_CHANGES', (payload) => {
      const { changes, experimentName, updateMode } = payload || {}
      const expName = experimentName || '__preview__'

      if (this.config.debug) {
        console.log(`[ExtensionDOMPlugin] Applying preview for: ${expName}`)
      }

      // Remove existing changes first
      this.removeChanges(expName)

      // Apply new changes
      if (changes && Array.isArray(changes)) {
        changes.forEach((change: DOMChange) => {
          this.applyChange(change, expName)
        })
      }
    })

    // Handle remove preview
    this.messageBridge.on('REMOVE_PREVIEW', (payload) => {
      const { experimentName } = payload || {}
      const expName = experimentName || '__preview__'

      if (this.config.debug) {
        console.log(`[ExtensionDOMPlugin] Removing preview: ${expName}`)
      }

      this.removeChanges(expName)
    })

    // Handle custom code injection
    this.messageBridge.on('INJECT_CUSTOM_CODE', (payload) => {
      if (payload && payload.code) {
        this.injectCode(payload.code)
      }
    })
  }

  /**
   * Handle change applied event from base plugin
   */
  private handleChangeApplied(data: any): void {
    const { experimentName, change, element } = data

    if (element && experimentName) {
      const originalState = this.stateManager.storeState(element, experimentName)

      this.stateManager.trackChange({
        experimentName,
        selector: change.selector,
        type: change.type,
        element,
        originalState
      })
    }
  }

  /**
   * Fallback manual change application
   */
  private applyChangeManually(
    element: HTMLElement,
    change: DOMChange,
    experimentName: string
  ): void {
    // Mark element with experiment
    element.setAttribute('data-absmartly-experiment', experimentName)
    element.setAttribute('data-absmartly-modified', 'true')

    switch (change.type) {
      case 'text':
        element.textContent = change.value
        break

      case 'html':
        element.innerHTML = change.value
        break

      case 'style':
      case 'styles':
        const styles = change.styles || change.value
        if (typeof styles === 'object') {
          Object.entries(styles).forEach(([prop, value]) => {
            element.style[prop as any] = value as string
          })
        } else if (typeof styles === 'string') {
          element.setAttribute('style', styles)
        }
        break

      case 'class':
        if (change.className) {
          element.classList.add(change.className)
        }
        break

      case 'attribute':
        if (change.attribute && change.value !== undefined) {
          element.setAttribute(change.attribute, change.value)
        }
        break
    }
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.stateManager.clear()
    this.messageBridge.destroy()
    this.codeInjector.removeAll()

    if (this.basePlugin.destroy) {
      this.basePlugin.destroy()
    }

    // Remove from context
    if (this.config.context?.__domPlugin) {
      delete this.config.context.__domPlugin
    }

    this.initialized = false
  }
}
