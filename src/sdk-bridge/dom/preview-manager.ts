/**
 * Preview Manager
 *
 * Handles applying and removing preview changes with state tracking
 *
 * @module PreviewManager
 */

import type { DOMChange } from '../types/dom-changes'
import { ElementStateManager, type ElementState } from './element-state'
import { sanitizeHTML } from '../utils/html-sanitizer'
import { Logger } from '../utils/logger'
import { CodeExecutor } from '../experiment/code-executor'

interface PreviewState {
  experimentName: string
  originalState: ElementState
  selector: string
  changeType: string
}

export class PreviewManager {
  private previewStateMap: Map<Element, PreviewState>

  constructor() {
    this.previewStateMap = new Map()
  }

  /**
   * Apply a single preview change and track it for reversion
   */
  applyPreviewChange(change: DOMChange, experimentName: string): boolean {
    if (!change.selector || !change.type) {
      Logger.warn('Invalid change, missing selector or type')
      return false
    }

    // Skip disabled changes
    if (change.enabled === false) {
      Logger.log('Skipping disabled change:', change.selector)
      return false
    }

    const elements = document.querySelectorAll(change.selector)

    if (elements.length === 0) {
      Logger.warn('No elements found for selector:', change.selector)
      return false
    }

    Logger.log(
      `Applying preview change to ${elements.length} element(s):`,
      change.selector,
      change.type
    )

    elements.forEach((element) => {
      const htmlElement = element as HTMLElement

      // Store original state if not already stored for this experiment
      if (
        !this.previewStateMap.has(element) ||
        this.previewStateMap.get(element)!.experimentName !== experimentName
      ) {
        const originalState = ElementStateManager.captureElementState(element)
        this.previewStateMap.set(element, {
          experimentName,
          originalState,
          selector: change.selector,
          changeType: change.type
        })
        Logger.log('Stored original state for element:', element)
      }

      // Mark element with experiment
      element.setAttribute('data-absmartly-experiment', experimentName)
      element.setAttribute('data-absmartly-modified', 'true')

      // Apply the change based on type
      switch (change.type) {
        case 'text':
          element.textContent = change.value
          break

        case 'html':
          element.innerHTML = sanitizeHTML(change.value)
          break

        case 'style':
        case 'styles':
          const styles = change.styles || change.value
          if (typeof styles === 'object') {
            Object.entries(styles).forEach(([prop, value]) => {
              const cssValue = value as string
              // Check if the value includes !important and extract it
              const hasImportant = cssValue.includes('!important')
              const cleanValue = cssValue.replace(/\s*!important\s*$/i, '').trim()
              const priority = hasImportant ? 'important' : ''

              htmlElement.style.setProperty(
                prop.replace(/([A-Z])/g, '-$1').toLowerCase(),
                cleanValue,
                priority
              )
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

        case 'delete':
          // In preview mode, mimic delete by hiding (display: none)
          htmlElement.style.display = 'none'
          Logger.log('Mimicking delete by hiding element')
          break

        case 'javascript':
          if (change.value && typeof change.value === 'string') {
            const success = CodeExecutor.execute(change.value, {
              element: htmlElement,
              experimentName
            })
            if (!success) {
              Logger.warn('Failed to execute JavaScript for:', change.selector)
            }
          } else {
            Logger.warn('Invalid javascript change, missing or invalid value')
          }
          break
      }

      Logger.log('Applied change to element:', element)
    })

    return true
  }

  /**
   * Remove all preview changes for an experiment
   */
  removePreviewChanges(experimentName: string): boolean {
    Logger.log('Removing preview changes for experiment:', experimentName)

    let restoredCount = 0
    const elementsToRemove: Element[] = []

    // First, restore elements we tracked in previewStateMap
    this.previewStateMap.forEach((data, element) => {
      if (data.experimentName === experimentName) {
        // Restore element to original state
        ElementStateManager.restoreElementState(element, data.originalState)
        elementsToRemove.push(element)
        restoredCount++
      }
    })

    // Clean up the map
    elementsToRemove.forEach((element) => this.previewStateMap.delete(element))

    // Also remove markers from any elements with this experiment (e.g., from visual editor)
    // Try both the actual experiment name and __preview__ (visual editor default)
    const markedElements = document.querySelectorAll(
      `[data-absmartly-experiment="${experimentName}"], [data-absmartly-experiment="__preview__"]`
    )
    markedElements.forEach((element) => {
      // If element has data-absmartly-original, restore from it (VE-modified elements)
      if (element.hasAttribute('data-absmartly-original')) {
        try {
          const originalData = JSON.parse(
            element.getAttribute('data-absmartly-original') || '{}'
          )
          Logger.log('Original data for element:', {
            tagName: element.tagName,
            id: element.id,
            textContent: originalData.textContent?.substring(0, 100),
            innerHTML: originalData.innerHTML?.substring(0, 100),
            hasStyles: !!originalData.styles
          })

          // Restore innerHTML (which also restores textContent)
          if (originalData.innerHTML !== undefined) {
            element.innerHTML = sanitizeHTML(originalData.innerHTML)
            Logger.log('Restored innerHTML from VE original')
          } else if (originalData.textContent !== undefined) {
            // Fallback to textContent if innerHTML not available
            element.textContent = originalData.textContent
            Logger.log('Restored text content from VE original')
          }

          // Restore styles
          if (originalData.styles) {
            const htmlElement = element as HTMLElement
            Object.keys(originalData.styles).forEach((prop) => {
              htmlElement.style[prop as any] = originalData.styles[prop]
            })
            Logger.log('Restored styles from VE original')
          }

          // Restore attributes
          if (originalData.attributes) {
            Object.keys(originalData.attributes).forEach((attr) => {
              if (originalData.attributes[attr] !== null) {
                element.setAttribute(attr, originalData.attributes[attr])
              } else {
                element.removeAttribute(attr)
              }
            })
            Logger.log('Restored attributes from VE original')
          }
        } catch (e) {
          Logger.warn('Failed to restore element from data-absmartly-original:', e)
        }

        // Remove the original data attribute - we're back at original state now
        element.removeAttribute('data-absmartly-original')
      }

      element.removeAttribute('data-absmartly-experiment')
      element.removeAttribute('data-absmartly-modified')
      restoredCount++
    })

    Logger.log(`Removed preview changes, cleaned ${restoredCount} elements`)
    return restoredCount > 0
  }

  /**
   * Clear all preview changes
   */
  clearAll(): void {
    const experimentNames = new Set<string>()
    this.previewStateMap.forEach((data) => {
      experimentNames.add(data.experimentName)
    })

    experimentNames.forEach((name) => {
      this.removePreviewChanges(name)
    })
  }

  /**
   * Get count of tracked preview elements
   */
  getPreviewCount(): number {
    return this.previewStateMap.size
  }
}
