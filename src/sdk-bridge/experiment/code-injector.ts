/**
 * Code Injector
 *
 * Handles injection of custom code from experiment variants
 *
 * @module CodeInjector
 */

import { sanitizeHTML } from '../utils/html-sanitizer'
import { Logger } from '../utils/logger'

export interface InjectionCode {
  headStart?: string
  headEnd?: string
  bodyStart?: string
  bodyEnd?: string
  urlFilter?: UrlFilter
}

export type UrlFilter =
  | string
  | string[]
  | {
      include?: string[]
      exclude?: string[]
      mode?: 'wildcard' | 'regex'
      matchType?: 'path' | 'full-url' | 'domain' | 'query' | 'hash'
    }

export type InjectionLocation = 'headStart' | 'headEnd' | 'bodyStart' | 'bodyEnd'

export class CodeInjector {
  /**
   * Inject custom code from experiment variants' __inject_html variables
   */
  injectExperimentCode(context: any): void {
    if (!context || !context.data_) {
      Logger.log('[ABsmartly Extension] No context data available for experiment code injection')
      return
    }

    const data = context.data_

    if (!data.experiments || !Array.isArray(data.experiments)) {
      Logger.log('[ABsmartly Extension] No experiments found in context')
      return
    }

    Logger.log(`[ABsmartly Extension] Checking ${data.experiments.length} experiments for injection code`)

    data.experiments.forEach((experiment: any, idx: number) => {
      try {
        const assignment = context.assignments_ ? context.assignments_[experiment.id] : null
        if (assignment === null || assignment === undefined) {
          return
        }

        const variant = experiment.variants ? experiment.variants[assignment] : null
        if (!variant || !variant.config) {
          return
        }

        let variantConfig: any
        try {
          variantConfig =
            typeof variant.config === 'string' ? JSON.parse(variant.config) : variant.config
        } catch (e) {
          Logger.warn(
            `[ABsmartly Extension] Failed to parse variant config for experiment ${experiment.name}:`,
            e
          )
          return
        }

        const injectHtml = variantConfig.__inject_html
        if (!injectHtml) {
          return
        }

        Logger.log(
          `[ABsmartly Extension] Found __inject_html in experiment "${experiment.name}", variant ${assignment}`
        )

        let injectionCode: InjectionCode
        try {
          injectionCode =
            typeof injectHtml === 'string' ? JSON.parse(injectHtml) : injectHtml
        } catch (e) {
          Logger.warn(
            `[ABsmartly Extension] Failed to parse __inject_html for experiment ${experiment.name}:`,
            e
          )
          return
        }

        if (injectionCode.urlFilter && !this.matchesUrlFilter(injectionCode.urlFilter)) {
          Logger.log(
            `[ABsmartly Extension] Skipping injection for experiment "${experiment.name}" - URL filter not matched`
          )
          return
        }

        const locations: InjectionLocation[] = ['headStart', 'headEnd', 'bodyStart', 'bodyEnd']
        locations.forEach((location) => {
          if (injectionCode[location]) {
            Logger.log(
              `[ABsmartly Extension] Injecting code for experiment "${experiment.name}" at ${location}`
            )
            const sanitizedHtml = sanitizeHTML(injectionCode[location]!)
            this.executeScriptsInHTML(sanitizedHtml, location)
          }
        })

        Logger.log(
          `[ABsmartly Extension] Successfully processed injection code for experiment "${experiment.name}"`
        )
      } catch (error) {
        Logger.error(`[ABsmartly Extension] Error processing experiment ${idx}:`, error)
      }
    })
  }

  /**
   * Executes script tags found in HTML content
   * Scripts injected via innerHTML don't execute, so we need to recreate them
   */
  executeScriptsInHTML(html: string, location: InjectionLocation): void {
    Logger.log(`[ABsmartly Extension] Processing scripts for ${location}`)

    const temp = document.createElement('div')
    temp.innerHTML = html

    const scripts = temp.querySelectorAll('script')

    scripts.forEach((script, index) => {
      Logger.log(`[ABsmartly Extension] Executing script ${index + 1} from ${location}`)

      try {
        if (script.src) {
          const newScript = document.createElement('script')
          newScript.src = script.src

          if (script.async || script.hasAttribute('async')) {
            newScript.async = true
          }
          if (script.defer || script.hasAttribute('defer')) {
            newScript.defer = true
          }

          newScript.setAttribute('data-absmartly-injected', location)

          this.insertAtLocation(newScript, location)
        } else {
          Logger.warn(
            `[ABsmartly Extension] Inline script execution disabled for security from ${location}`
          )
        }
      } catch (error) {
        Logger.error(`[ABsmartly Extension] Failed to execute script from ${location}:`, error)
      }
    })
  }

  /**
   * Inserts an element at the correct location based on the injection point
   */
  insertAtLocation(element: HTMLElement, location: InjectionLocation): void {
    switch (location) {
      case 'headStart':
        if (document.head.firstChild) {
          document.head.insertBefore(element, document.head.firstChild)
        } else {
          document.head.appendChild(element)
        }
        break
      case 'headEnd':
        document.head.appendChild(element)
        break
      case 'bodyStart':
        if (document.body.firstChild) {
          document.body.insertBefore(element, document.body.firstChild)
        } else {
          document.body.appendChild(element)
        }
        break
      case 'bodyEnd':
        document.body.appendChild(element)
        break
      default:
        Logger.warn(`[ABsmartly Extension] Unknown injection location: ${location}`)
    }
  }

  /**
   * Helper function to check if current URL matches the filter
   * Returns true if URL matches or if no filter is specified
   */
  matchesUrlFilter(urlFilter: UrlFilter): boolean {
    if (!urlFilter) return true

    const currentUrl = window.location.href
    const currentPath = window.location.pathname
    const currentDomain = window.location.hostname
    const currentQuery = window.location.search
    const currentHash = window.location.hash

    let matchTarget: string
    const matchType =
      typeof urlFilter === 'object' && !Array.isArray(urlFilter)
        ? urlFilter.matchType || 'path'
        : 'path'

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

    let includePatterns: string[] = []
    let excludePatterns: string[] = []
    let isRegex = false

    if (typeof urlFilter === 'string') {
      includePatterns = [urlFilter]
    } else if (Array.isArray(urlFilter)) {
      includePatterns = urlFilter
    } else {
      includePatterns = urlFilter.include || []
      excludePatterns = urlFilter.exclude || []
      isRegex = urlFilter.mode === 'regex'
    }

    if (excludePatterns.length > 0) {
      for (const pattern of excludePatterns) {
        if (isRegex) {
          try {
            const regex = new RegExp(pattern)
            if (regex.test(matchTarget)) {
              Logger.log(`[ABsmartly Extension] URL excluded by pattern: ${pattern}`)
              return false
            }
          } catch (e) {
            Logger.warn(`[ABsmartly Extension] Invalid regex pattern: ${pattern}`, e)
          }
        } else {
          const escapedPattern = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.')
          const regex = new RegExp(`^${escapedPattern}$`)
          if (regex.test(matchTarget)) {
            Logger.log(`[ABsmartly Extension] URL excluded by pattern: ${pattern}`)
            return false
          }
        }
      }
    }

    if (includePatterns.length === 0) {
      return true
    }

    for (const pattern of includePatterns) {
      if (isRegex) {
        try {
          const regex = new RegExp(pattern)
          if (regex.test(matchTarget)) {
            Logger.log(`[ABsmartly Extension] URL matched by pattern: ${pattern}`)
            return true
          }
        } catch (e) {
          Logger.warn(`[ABsmartly Extension] Invalid regex pattern: ${pattern}`, e)
        }
      } else {
        const escapedPattern = pattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.')
        const regex = new RegExp(`^${escapedPattern}$`)
        if (regex.test(matchTarget)) {
          Logger.log(`[ABsmartly Extension] URL matched by pattern: ${pattern}`)
          return true
        }
      }
    }

    Logger.log(`[ABsmartly Extension] URL did not match any include patterns`)
    return false
  }
}
