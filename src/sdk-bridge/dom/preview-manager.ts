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

interface StyleRuleTracking {
  experimentName: string
  ruleKey: string
  css: string
}

export class PreviewManager {
  private previewStateMap: Map<Element, PreviewState>
  // Track style rules per experiment: experimentName -> Map<ruleKey, css>
  private styleRulesByExperiment: Map<string, Map<string, string>>

  constructor() {
    this.previewStateMap = new Map()
    this.styleRulesByExperiment = new Map()
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

    // Validate javascript action before processing
    if (change.type === 'javascript') {
      if (!change.value || typeof change.value !== 'string') {
        Logger.warn('Invalid javascript change, missing or invalid value')
        return false
      }
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
          if (change.value && typeof change.value === 'object') {
            Object.entries(change.value).forEach(([attr, value]) => {
              if (value === null || value === undefined) {
                element.removeAttribute(attr)
              } else {
                element.setAttribute(attr, String(value))
              }
            })
          }
          break

        case 'delete':
          // In preview mode, mimic delete by hiding (display: none)
          htmlElement.style.display = 'none'
          Logger.log('Mimicking delete by hiding element')
          break

        case 'javascript':
          // Validation already done before loop, value is guaranteed to be a string here
          const success = CodeExecutor.execute(change.value as string, {
            element: htmlElement,
            experimentName
          })
          if (!success) {
            Logger.warn('Failed to execute JavaScript for:', change.selector)
          }
          break
      }

      Logger.log('Applied change to element:', element)
    })

    // Handle styleRules separately (affects all matching elements via CSS rules)
    if (change.type === 'styleRules') {
      return this.applyStyleRules(change, experimentName)
    }

    return true
  }

  /**
   * Apply style rules (CSS rules that affect all matching elements)
   * Matches SDK plugin behavior exactly
   */
  private applyStyleRules(change: DOMChange, experimentName: string): boolean {
    try {
      // Use same ruleKey format as SDK plugin: ${change.selector}::states
      const ruleKey = `${change.selector}::states`

      let css: string

      // Support both raw CSS string in value and structured states (same as SDK plugin)
      if (typeof change.value === 'string' && change.value.trim()) {
        // Raw CSS provided in value
        css = change.value
      } else if (change.states) {
        // Structured states provided - build CSS from states
        css = this.buildStateRules(change.selector, change.states, change.important !== false)
      } else {
        // No CSS provided
        Logger.warn('[PreviewManager] styleRules change missing both value and states:', change.selector)
        return false
      }

      // Get or create rules map for this experiment
      let rulesMap = this.styleRulesByExperiment.get(experimentName)
      if (!rulesMap) {
        rulesMap = new Map()
        this.styleRulesByExperiment.set(experimentName, rulesMap)
      }

      // Set the rule (same as StyleSheetManager.setRule)
      rulesMap.set(ruleKey, css)

      // Render the stylesheet (same as StyleSheetManager.render)
      this.renderStyleSheet(experimentName)

      Logger.log('[PreviewManager] Applied style rule:', ruleKey)
      Logger.log('[PreviewManager] CSS:', css)

      return true
    } catch (error) {
      Logger.error('[PreviewManager] Error applying style rules:', error)
      return false
    }
  }

  /**
   * Render stylesheet for an experiment (matches StyleSheetManager.render)
   */
  private renderStyleSheet(experimentName: string): void {
    // Use same ID format as SDK plugin: absmartly-styles-${experimentName}
    const styleId = `absmartly-styles-${experimentName}`
    let styleElement = document.getElementById(styleId) as HTMLStyleElement

    if (!styleElement) {
      styleElement = document.createElement('style')
      styleElement.id = styleId
      // Use same attribute as SDK plugin
      styleElement.setAttribute('data-absmartly-styles', 'true')
      document.head.appendChild(styleElement)
      Logger.log('[PreviewManager] Created stylesheet:', styleId)
    }

    // Get all rules for this experiment
    const rulesMap = this.styleRulesByExperiment.get(experimentName)
    if (rulesMap) {
      // Join all rules with \n\n (same as StyleSheetManager.render)
      const cssText = Array.from(rulesMap.values()).join('\n\n')
      styleElement.textContent = cssText
    } else {
      styleElement.textContent = ''
    }
  }

  /**
   * Build CSS rules from structured states (hover, active, etc.)
   */
  private buildStateRules(selector: string, states: any, important = true): string {
    const rules: string[] = []

    if (states.normal) {
      rules.push(this.buildCssRule(selector, states.normal, important))
    }
    if (states.hover) {
      rules.push(this.buildCssRule(`${selector}:hover`, states.hover, important))
    }
    if (states.active) {
      rules.push(this.buildCssRule(`${selector}:active`, states.active, important))
    }
    if (states.focus) {
      rules.push(this.buildCssRule(`${selector}:focus`, states.focus, important))
    }

    return rules.join('\n\n')
  }

  /**
   * Build a single CSS rule from properties
   */
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

    // Remove styleRules for this experiment (matches StyleSheetManager.destroy)
    const rulesMap = this.styleRulesByExperiment.get(experimentName)
    if (rulesMap) {
      const hadRules = rulesMap.size > 0
      this.styleRulesByExperiment.delete(experimentName)

      if (hadRules) {
        Logger.log(`[PreviewManager] Cleared ${rulesMap.size} style rules for experiment:`, experimentName)
      }
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
