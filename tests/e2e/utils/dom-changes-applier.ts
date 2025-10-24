/**
 * DOM Changes Applier for Tests
 *
 * This module provides utilities for applying DOM changes directly in tests
 * without requiring the SDK plugin. It implements URL filtering and DOM
 * manipulation logic that mirrors the extension's behavior.
 */

export interface DOMChange {
  selector: string
  type: 'text' | 'html' | 'style' | 'attribute' | 'class' | 'delete' | 'remove'
  value?: any
  styles?: Record<string, string>
  attribute?: string
  className?: string
  action?: 'add' | 'remove' | 'toggle'
  enabled?: boolean
}

export interface URLFilter {
  include?: string[]
  exclude?: string[]
  mode?: 'simple' | 'regex'
  matchType?: 'path' | 'full-url' | 'domain' | 'query' | 'hash'
}

export interface DOMChangesData {
  changes: DOMChange[]
  urlFilter?: URLFilter
}

/**
 * Check if current URL matches the URL filter
 */
export function matchesUrlFilter(urlFilter: URLFilter | undefined): boolean {
  if (!urlFilter) return true

  const currentPath = window.location.pathname
  const currentDomain = window.location.hostname
  const currentQuery = window.location.search
  const currentHash = window.location.hash
  const currentUrl = window.location.href

  // Determine what to match against
  let matchTarget: string
  const matchType = urlFilter.matchType || 'path'

  switch (matchType) {
    case 'full-url':
      matchTarget = currentUrl
      break
    case 'domain':
      matchTarget = currentDomain
      break
    case 'query':
      matchTarget = currentQuery
      break
    case 'hash':
      matchTarget = currentHash
      break
    case 'path':
    default:
      matchTarget = currentPath
  }

  const includePatterns = urlFilter.include || []
  const excludePatterns = urlFilter.exclude || []
  const isRegex = urlFilter.mode === 'regex'

  // Check exclude patterns first
  if (excludePatterns.length > 0) {
    for (const pattern of excludePatterns) {
      if (isRegex) {
        const regex = new RegExp(pattern)
        if (regex.test(matchTarget)) {
          return false
        }
      } else {
        // Simple wildcard matching
        const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.')
        const regex = new RegExp(`^${regexPattern}$`)
        if (regex.test(matchTarget)) {
          return false
        }
      }
    }
  }

  // Check include patterns
  if (includePatterns.length === 0) {
    return true // No include patterns means include all (that aren't excluded)
  }

  for (const pattern of includePatterns) {
    if (isRegex) {
      const regex = new RegExp(pattern)
      if (regex.test(matchTarget)) {
        return true
      }
    } else {
      // Simple wildcard matching
      const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.')
      const regex = new RegExp(`^${regexPattern}$`)
      if (regex.test(matchTarget)) {
        return true
      }
    }
  }

  return false
}

/**
 * Apply a single DOM change to matching elements
 */
export function applyDOMChange(change: DOMChange): boolean {
  if (!change.selector || !change.type) {
    console.warn('[DOMChanges] Invalid change, missing selector or type')
    return false
  }

  // Skip disabled changes
  if (change.enabled === false) {
    console.log('[DOMChanges] Skipping disabled change:', change.selector)
    return false
  }

  const elements = document.querySelectorAll(change.selector)

  if (elements.length === 0) {
    console.warn('[DOMChanges] No elements found for selector:', change.selector)
    return false
  }

  console.log(`[DOMChanges] Applying change to ${elements.length} element(s):`, change.selector, change.type)

  elements.forEach((element) => {
    const htmlElement = element as HTMLElement

    // Store original state for potential restoration
    if (!htmlElement.dataset.absmartlyOriginal) {
      htmlElement.dataset.absmartlyOriginal = JSON.stringify({
        textContent: htmlElement.textContent,
        innerHTML: htmlElement.innerHTML,
        styles: {},
        attributes: {}
      })
    }

    // Mark element as modified
    htmlElement.dataset.absmartlyModified = 'true'

    // Apply the change based on type
    switch (change.type) {
      case 'text':
        htmlElement.textContent = change.value
        break

      case 'html':
        htmlElement.innerHTML = change.value
        break

      case 'style':
      case 'styles':
        const styles = change.styles || change.value
        if (typeof styles === 'object') {
          Object.entries(styles).forEach(([prop, value]) => {
            htmlElement.style[prop as any] = value as string
          })
        } else if (typeof styles === 'string') {
          htmlElement.setAttribute('style', styles)
        }
        break

      case 'class':
        if (change.action === 'add' && change.className) {
          htmlElement.classList.add(change.className)
        } else if (change.action === 'remove' && change.className) {
          htmlElement.classList.remove(change.className)
        } else if (change.action === 'toggle' && change.className) {
          htmlElement.classList.toggle(change.className)
        }
        break

      case 'attribute':
        if (change.attribute && change.value !== undefined) {
          htmlElement.setAttribute(change.attribute, change.value)
        }
        break

      case 'delete':
      case 'remove':
        // In test mode, mimic delete by hiding
        htmlElement.style.display = 'none'
        break
    }

    console.log('[DOMChanges] Applied change to element:', element)
  })

  return true
}

/**
 * Apply DOM changes with URL filtering
 */
export function applyDOMChanges(domChangesData: DOMChangesData): void {
  console.log('[DOMChanges] Applying DOM changes:', domChangesData)

  // Check URL filter first
  if (domChangesData.urlFilter && !matchesUrlFilter(domChangesData.urlFilter)) {
    console.log('[DOMChanges] URL filter not matched, skipping changes')
    return
  }

  console.log('[DOMChanges] URL filter matched, applying changes')

  // Apply each change
  domChangesData.changes.forEach((change, index) => {
    console.log(`[DOMChanges] Applying change ${index + 1}/${domChangesData.changes.length}`)
    applyDOMChange(change)
  })

  console.log('[DOMChanges] All changes applied')
}

/**
 * Remove all applied DOM changes
 */
export function removeDOMChanges(): void {
  console.log('[DOMChanges] Removing all DOM changes')

  const modifiedElements = document.querySelectorAll('[data-absmartly-modified]')
  console.log(`[DOMChanges] Found ${modifiedElements.length} modified elements`)

  modifiedElements.forEach((element) => {
    const htmlElement = element as HTMLElement

    try {
      // Restore original state if available
      if (htmlElement.dataset.absmartlyOriginal) {
        const originalData = JSON.parse(htmlElement.dataset.absmartlyOriginal)

        if (originalData.innerHTML !== undefined) {
          htmlElement.innerHTML = originalData.innerHTML
        } else if (originalData.textContent !== undefined) {
          htmlElement.textContent = originalData.textContent
        }

        if (originalData.styles) {
          Object.entries(originalData.styles).forEach(([prop, value]) => {
            htmlElement.style[prop as any] = value as string
          })
        }

        if (originalData.attributes) {
          Object.entries(originalData.attributes).forEach(([attr, value]) => {
            if (value === null) {
              htmlElement.removeAttribute(attr)
            } else {
              htmlElement.setAttribute(attr, value as string)
            }
          })
        }
      }

      // Clean up data attributes
      delete htmlElement.dataset.absmartlyOriginal
      delete htmlElement.dataset.absmartlyModified
    } catch (error) {
      console.error('[DOMChanges] Error restoring element:', error)
    }
  })

  console.log('[DOMChanges] DOM changes removed')
}

/**
 * Initialize a mock ABsmartly context with DOM changes support
 */
export function createMockContextWithDOMChanges(
  experiments: Array<{
    name: string
    assignedVariant: number
    variants: Array<{
      domChanges?: DOMChangesData
    }>
  }>
) {
  return {
    Context: class {
      constructor() {}

      async ready() {
        return Promise.resolve()
      }

      data() {
        return {
          experiments: experiments.map(exp => ({
            name: exp.name,
            variants: exp.variants.map(v => ({
              variables: v.domChanges ? { __dom_changes: v.domChanges } : {}
            }))
          }))
        }
      }

      treatment(experimentName: string) {
        const exp = experiments.find(e => e.name === experimentName)
        return exp ? exp.assignedVariant : 0
      }

      peek(experimentName: string) {
        const exp = experiments.find(e => e.name === experimentName)
        return exp ? exp.assignedVariant : 0
      }

      override(experimentName: string, variant: number) {}
    }
  }
}
