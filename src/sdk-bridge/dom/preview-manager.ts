/**
 * Preview Manager
 *
 * Handles applying and removing preview changes with state tracking
 *
 * @module PreviewManager
 */

import type { DOMChange } from '~src/types/dom-changes'
import { ElementStateManager, type ElementState } from './element-state'
import { sanitizeHTML } from '../utils/html-sanitizer'
import { Logger } from '../utils/logger'
import { DOMManipulatorLite as DOMManipulator } from '@absmartly/sdk-plugins/core/dom-manipulator'
import { StyleSheetManager } from '@absmartly/sdk-plugins/core/style-sheet-manager'

interface PreviewState {
  experimentName: string
  originalState: ElementState
  selector: string
  changeType: string
}

export class PreviewManager {
  private previewStateMap: Map<Element, PreviewState>
  private domManipulator: DOMManipulator
  private styleManagers: Map<string, StyleSheetManager> = new Map()

  constructor() {
    this.previewStateMap = new Map()

    // Create mock plugin for DOMManipulator
    const mockPlugin: any = {
      config: { spa: true },
      reapplyingElements: new Set(),
      getStyleManager: (experimentName: string) => {
        if (!this.styleManagers.has(experimentName)) {
          this.styleManagers.set(experimentName, new StyleSheetManager(`absmartly-styles-${experimentName}`, true))
        }
        return this.styleManagers.get(experimentName)
      },
      buildStateRules: this.buildStateRules.bind(this),
      watchElement: () => {}
    }

    // Delegate all DOM manipulation to SDK plugin
    this.domManipulator = new DOMManipulator(true, mockPlugin)
  }

  private buildStateRules(selector: string, states: any, important = true): string {
    const rules: string[] = []
    if (states.normal) rules.push(this.buildCssRule(selector, states.normal, important))
    if (states.hover) rules.push(this.buildCssRule(`${selector}:hover`, states.hover, important))
    if (states.active) rules.push(this.buildCssRule(`${selector}:active`, states.active, important))
    if (states.focus) rules.push(this.buildCssRule(`${selector}:focus`, states.focus, important))
    return rules.join('\n\n')
  }

  private buildCssRule(selector: string, properties: Record<string, any>, important = true): string {
    const declarations = Object.entries(properties)
      .map(([prop, value]) => {
        const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase()
        const bang = important ? ' !important' : ''
        return `  ${cssProp}: ${value}${bang};`
      })
      .join('\n')
    return `${selector} {\n${declarations}\n}`
  }

  /**
   * Apply a single preview change and track it for reversion
   */
  applyPreviewChange(change: DOMChange, experimentName: string): boolean {
    // Skip disabled changes
    if (('disabled' in change && change.disabled) || ('enabled' in change && change.enabled === false)) {
      Logger.log('Skipping disabled change:', change.selector)
      return false
    }

    // Capture original state BEFORE applying (for undo functionality)
    if (change.type !== 'styleRules') {
      try {
        const elements = document.querySelectorAll(change.selector)
        const filtered = Array.from(elements).filter(el => !this.isExtensionElement(el))

        for (const element of filtered) {
          if (!this.previewStateMap.has(element) ||
              this.previewStateMap.get(element)!.experimentName !== experimentName) {
            const originalState = ElementStateManager.captureElementState(element)
            this.previewStateMap.set(element, {
              experimentName,
              originalState,
              selector: change.selector,
              changeType: change.type
            })
          }
        }
      } catch (err) {
        // Selector might be invalid or elements don't exist yet - that's okay
      }
    }

    // Delegate to SDK plugin's DOMManipulator
    // It handles: styleRules, waitForElement, PendingChangeManager, all change types
    const success = this.domManipulator.applyChange(change, experimentName)

    // Mark applied elements AFTER for undo tracking (for non-styleRules)
    if (success && change.type !== 'styleRules') {
      try {
        const elements = document.querySelectorAll(change.selector)
        const filtered = Array.from(elements).filter(el => !this.isExtensionElement(el))

        for (const element of filtered) {
          element.setAttribute('data-absmartly-experiment', experimentName)
          element.setAttribute('data-absmartly-modified', 'true')
        }
      } catch (err) {
        // Ignore - elements might appear later via waitForElement
      }
    }

    return success
  }


  /**
   * Remove all preview changes for an experiment
   */
  removePreviewChanges(experimentName: string): boolean {
    Logger.log('Removing preview changes for experiment:', experimentName)

    let restoredCount = 0
    const elementsToRemove: Element[] = []

    // First, restore elements we tracked in previewStateMap
    for (const [element, data] of this.previewStateMap) {
      if (data.experimentName === experimentName) {
        ElementStateManager.restoreElementState(element, data.originalState)
        elementsToRemove.push(element)
        restoredCount++
      }
    }

    for (const element of elementsToRemove) {
      this.previewStateMap.delete(element)
    }

    // Also remove markers from any elements with this experiment (e.g., from visual editor)
    // Try both the actual experiment name and __preview__ (visual editor default)
    const markedElements = document.querySelectorAll(
      `[data-absmartly-experiment="${experimentName}"], [data-absmartly-experiment="__preview__"]`
    )
    for (const element of markedElements) {
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
            for (const prop of Object.keys(originalData.styles)) {
              htmlElement.style[prop as any] = originalData.styles[prop]
            }
            Logger.log('Restored styles from VE original')
          }

          // Restore attributes
          if (originalData.attributes) {
            for (const attr of Object.keys(originalData.attributes)) {
              if (originalData.attributes[attr] !== null) {
                element.setAttribute(attr, originalData.attributes[attr])
              } else {
                element.removeAttribute(attr)
              }
            }
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
    }

    // Remove styleRules for this experiment via StyleSheetManager
    const styleManager = this.styleManagers.get(experimentName)
    if (styleManager) {
      styleManager.destroy()
      this.styleManagers.delete(experimentName)
      Logger.log(`[PreviewManager] Destroyed stylesheet for experiment:`, experimentName)
    }

    // Remove the style element for this experiment (same ID format as SDK plugin)
    const styleId = `absmartly-styles-${experimentName}`
    const styleElement = document.getElementById(styleId)
    if (styleElement) {
      styleElement.remove()
      Logger.log('[PreviewManager] Destroyed stylesheet:', styleId)
      restoredCount++
    }

    Logger.log(`Removed preview changes, cleaned ${restoredCount} elements`)
    return restoredCount > 0
  }

  /**
   * Clear all preview changes
   */
  clearAll(): void {
    const experimentNames = new Set<string>()
    for (const data of this.previewStateMap.values()) {
      experimentNames.add(data.experimentName)
    }

    for (const name of experimentNames) {
      this.removePreviewChanges(name)
    }
  }

  /**
   * Get count of tracked preview elements
   */
  getPreviewCount(): number {
    return this.previewStateMap.size
  }

  /**
   * Check if an element is part of the extension UI
   * Extension UI elements (including shadow hosts) should never be modified by preview changes
   */
  private isExtensionElement(element: Element): boolean {
    const extensionIds = [
      'absmartly-sidebar-root',
      'absmartly-sidebar-iframe',
      'absmartly-preview-header-host',        // Shadow host for preview toolbar
      'absmartly-visual-editor-toolbar-host'  // Shadow host for VE toolbar
    ]

    // Check if this element IS an extension container
    if (element.id && extensionIds.includes(element.id)) {
      return true
    }

    // Check if this element is INSIDE an extension container
    for (const id of extensionIds) {
      const container = document.getElementById(id)
      if (container && container.contains(element)) {
        return true
      }
    }

    return false
  }
}
