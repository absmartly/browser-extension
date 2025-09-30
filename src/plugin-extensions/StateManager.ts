/**
 * StateManager
 * Tracks original DOM element states before modifications
 * Enables reversion of changes applied by the plugin
 */

export interface ElementState {
  textContent?: string
  innerHTML?: string
  attributes?: Record<string, string | null>
  styles?: Record<string, string>
  classList?: string[]
}

export interface AppliedChange {
  experimentName: string
  selector: string
  type: string
  element: Element
  originalState: ElementState
  appliedAt: number
}

export class StateManager {
  private stateMap: Map<Element, Map<string, ElementState>> = new Map()
  private appliedChanges: Map<string, AppliedChange[]> = new Map()
  private debug: boolean

  constructor(debug = false) {
    this.debug = debug
  }

  /**
   * Store the original state of an element before modification
   */
  storeState(element: Element, experimentName: string): ElementState {
    if (!this.stateMap.has(element)) {
      this.stateMap.set(element, new Map())
    }

    const elementStates = this.stateMap.get(element)!

    if (!elementStates.has(experimentName)) {
      const state: ElementState = {
        textContent: element.textContent || undefined,
        innerHTML: (element as HTMLElement).innerHTML || undefined,
        attributes: this.captureAttributes(element),
        styles: this.captureStyles(element as HTMLElement),
        classList: Array.from(element.classList)
      }

      elementStates.set(experimentName, state)

      if (this.debug) {
        console.log(`[StateManager] Stored state for ${experimentName}:`, state)
      }
    }

    return elementStates.get(experimentName)!
  }

  /**
   * Track an applied change
   */
  trackChange(change: Omit<AppliedChange, 'appliedAt'>): void {
    const { experimentName } = change

    if (!this.appliedChanges.has(experimentName)) {
      this.appliedChanges.set(experimentName, [])
    }

    const appliedChange: AppliedChange = {
      ...change,
      appliedAt: Date.now()
    }

    this.appliedChanges.get(experimentName)!.push(appliedChange)

    if (this.debug) {
      console.log(`[StateManager] Tracked change for ${experimentName}:`, appliedChange)
    }
  }

  /**
   * Get original state for an element
   */
  getState(element: Element, experimentName: string): ElementState | null {
    return this.stateMap.get(element)?.get(experimentName) || null
  }

  /**
   * Get all applied changes for an experiment
   */
  getAppliedChanges(experimentName: string): AppliedChange[] {
    return this.appliedChanges.get(experimentName) || []
  }

  /**
   * Revert an element to its original state
   */
  revertElement(element: Element, experimentName: string): boolean {
    const state = this.getState(element, experimentName)

    if (!state) {
      if (this.debug) {
        console.warn(`[StateManager] No state found for element in ${experimentName}`)
      }
      return false
    }

    try {
      // Revert text content
      if (state.textContent !== undefined) {
        element.textContent = state.textContent
      }

      // Revert innerHTML
      if (state.innerHTML !== undefined) {
        (element as HTMLElement).innerHTML = state.innerHTML
      }

      // Revert attributes
      if (state.attributes) {
        Object.entries(state.attributes).forEach(([attr, value]) => {
          if (value === null) {
            element.removeAttribute(attr)
          } else {
            element.setAttribute(attr, value)
          }
        })
      }

      // Revert styles
      if (state.styles) {
        const htmlElement = element as HTMLElement
        Object.entries(state.styles).forEach(([prop, value]) => {
          htmlElement.style[prop as any] = value
        })
      }

      // Revert class list
      if (state.classList) {
        element.className = state.classList.join(' ')
      }

      // Remove tracking attributes
      element.removeAttribute('data-absmartly-experiment')
      element.removeAttribute('data-absmartly-modified')
      element.removeAttribute('data-absmartly-original')

      if (this.debug) {
        console.log(`[StateManager] Reverted element for ${experimentName}`)
      }

      return true
    } catch (error) {
      console.error(`[StateManager] Error reverting element:`, error)
      return false
    }
  }

  /**
   * Remove all tracked changes for an experiment
   */
  removeExperiment(experimentName: string): boolean {
    const changes = this.getAppliedChanges(experimentName)

    if (changes.length === 0) {
      return false
    }

    let success = true
    for (const change of changes) {
      if (!this.revertElement(change.element, experimentName)) {
        success = false
      }
    }

    // Clean up tracking
    this.appliedChanges.delete(experimentName)

    // Clean up state map entries for this experiment
    this.stateMap.forEach((elementStates) => {
      elementStates.delete(experimentName)
    })

    if (this.debug) {
      console.log(`[StateManager] Removed experiment ${experimentName}, success: ${success}`)
    }

    return success
  }

  /**
   * Clear all tracked state
   */
  clear(): void {
    this.stateMap.clear()
    this.appliedChanges.clear()
  }

  private captureAttributes(element: Element): Record<string, string | null> {
    const attrs: Record<string, string | null> = {}

    for (const attr of Array.from(element.attributes)) {
      attrs[attr.name] = attr.value
    }

    return attrs
  }

  private captureStyles(element: HTMLElement): Record<string, string> {
    const styles: Record<string, string> = {}
    const computedStyle = window.getComputedStyle(element)

    // Only capture inline styles, not computed styles
    if (element.style.length > 0) {
      for (let i = 0; i < element.style.length; i++) {
        const prop = element.style[i]
        styles[prop] = element.style.getPropertyValue(prop)
      }
    }

    return styles
  }
}
