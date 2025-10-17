/**
 * Element State Management
 *
 * Handles capturing and restoring element state
 *
 * @module ElementState
 */

import { sanitizeHTML } from '../utils/html-sanitizer'
import { Logger } from '../utils/logger'

export interface ElementState {
  textContent: string
  innerHTML: string
  attributes: Record<string, string>
  styles: Record<string, string>
  classList: string[]
}

export class ElementStateManager {
  /**
   * Capture the current state of an element
   */
  static captureElementState(element: Element): ElementState {
    const htmlElement = element as HTMLElement

    const state: ElementState = {
      textContent: element.textContent || '',
      innerHTML: element.innerHTML,
      attributes: {},
      styles: {},
      classList: Array.from(element.classList)
    }

    // Capture all attributes
    for (const attr of Array.from(element.attributes)) {
      state.attributes[attr.name] = attr.value
    }

    // Capture inline styles
    if (htmlElement.style && htmlElement.style.length > 0) {
      for (let i = 0; i < htmlElement.style.length; i++) {
        const prop = htmlElement.style[i]
        state.styles[prop] = htmlElement.style.getPropertyValue(prop)
      }
    }

    return state
  }

  /**
   * Restore an element to its original state
   */
  static restoreElementState(element: Element, originalState: ElementState): void {
    const htmlElement = element as HTMLElement

    try {
      // Restore innerHTML first (this clears textContent)
      if (originalState.innerHTML !== undefined) {
        element.innerHTML = sanitizeHTML(originalState.innerHTML)
      }

      // Note: textContent is derived from innerHTML, so we don't restore it separately
      // The innerHTML restoration above will set the correct textContent

      // Restore attributes
      if (originalState.attributes) {
        // First, remove all current attributes except data-* ones we want to clean
        const currentAttrs = Array.from(element.attributes)
        currentAttrs.forEach((attr) => {
          if (!originalState.attributes.hasOwnProperty(attr.name)) {
            element.removeAttribute(attr.name)
          }
        })

        // Then restore original attributes
        Object.entries(originalState.attributes).forEach(([name, value]) => {
          element.setAttribute(name, value)
        })
      }

      // Restore styles
      if (originalState.styles && htmlElement.style) {
        // Clear all inline styles first
        element.removeAttribute('style')

        // Restore original styles
        Object.entries(originalState.styles).forEach(([prop, value]) => {
          htmlElement.style.setProperty(prop, value)
        })
      }

      // Restore class list
      if (originalState.classList) {
        element.className = originalState.classList.join(' ')
      }

      // Remove tracking attributes
      element.removeAttribute('data-absmartly-experiment')
      element.removeAttribute('data-absmartly-modified')

      Logger.log('Restored element to original state:', element)
    } catch (error) {
      Logger.error('Error restoring element:', error)
    }
  }
}
