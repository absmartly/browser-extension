/**
 * CodeInjector
 * Handles dynamic injection of scripts and styles into the page
 */

export interface InjectionCode {
  headStart?: string
  headEnd?: string
  bodyStart?: string
  bodyEnd?: string
}

export type InjectionLocation = 'headStart' | 'headEnd' | 'bodyStart' | 'bodyEnd'

export class CodeInjector {
  private debug: boolean
  private injectedElements: Set<Element> = new Set()

  constructor(debug = false) {
    this.debug = debug
  }

  /**
   * Inject custom code at specified locations
   */
  injectCode(code: InjectionCode): void {
    if (this.debug) {
      console.log('[CodeInjector] Injecting custom code:', code)
    }

    if (code.headStart) {
      this.injectAtLocation(code.headStart, 'headStart')
    }

    if (code.headEnd) {
      this.injectAtLocation(code.headEnd, 'headEnd')
    }

    if (code.bodyStart) {
      this.injectAtLocation(code.bodyStart, 'bodyStart')
    }

    if (code.bodyEnd) {
      this.injectAtLocation(code.bodyEnd, 'bodyEnd')
    }
  }

  /**
   * Inject HTML content at a specific location
   */
  private injectAtLocation(html: string, location: InjectionLocation): void {
    if (!html) {
      return
    }

    if (this.debug) {
      console.log(`[CodeInjector] Injecting at ${location}:`, html.substring(0, 100))
    }

    const container = document.createElement('div')
    container.innerHTML = html
    container.setAttribute('data-absmartly-injected', location)

    // Process and inject each child element
    const children = Array.from(container.children)

    children.forEach((child) => {
      this.injectElement(child, location)
    })

    // Also execute any scripts found in the HTML
    this.executeScriptsInHTML(html, location)
  }

  /**
   * Inject a single element at the specified location
   */
  private injectElement(element: Element, location: InjectionLocation): void {
    element.setAttribute('data-absmartly-injected', location)

    const targetLocation = this.getTargetLocation(location)

    if (targetLocation) {
      targetLocation.appendChild(element)
      this.injectedElements.add(element)

      if (this.debug) {
        console.log(`[CodeInjector] Injected element at ${location}:`, element)
      }
    }
  }

  /**
   * Get the DOM location for injection
   */
  private getTargetLocation(location: InjectionLocation): Element | null {
    switch (location) {
      case 'headStart':
        return document.head.firstChild ? document.head : null
      case 'headEnd':
        return document.head
      case 'bodyStart':
        return document.body.firstChild ? document.body : null
      case 'bodyEnd':
        return document.body
      default:
        return null
    }
  }

  /**
   * Execute script tags found in HTML content
   * Scripts injected via innerHTML don't execute automatically
   */
  private executeScriptsInHTML(html: string, location: InjectionLocation): void {
    const temp = document.createElement('div')
    temp.innerHTML = html

    const scripts = temp.querySelectorAll('script')

    scripts.forEach((script) => {
      try {
        if (script.src) {
          // External script
          const newScript = document.createElement('script')
          newScript.src = script.src
          newScript.async = script.async
          newScript.defer = script.defer
          newScript.setAttribute('data-absmartly-injected', location)

          this.insertAtLocation(newScript, location)
          this.injectedElements.add(newScript)
        } else {
          // Inline script
          const code = script.textContent || script.innerText || ''
          if (code) {
            const fn = new Function(code)
            fn()

            if (this.debug) {
              console.log(`[CodeInjector] Executed inline script from ${location}`)
            }
          }
        }
      } catch (error) {
        console.error(`[CodeInjector] Failed to execute script from ${location}:`, error)
      }
    })
  }

  /**
   * Insert element at the correct position based on injection point
   */
  private insertAtLocation(element: Element, location: InjectionLocation): void {
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
    }
  }

  /**
   * Inject a style element with CSS
   */
  injectStyle(css: string, id?: string): void {
    const style = document.createElement('style')

    if (id) {
      style.id = id
    }

    style.setAttribute('data-absmartly-injected', 'style')
    style.textContent = css

    document.head.appendChild(style)
    this.injectedElements.add(style)

    if (this.debug) {
      console.log('[CodeInjector] Injected style:', css.substring(0, 100))
    }
  }

  /**
   * Inject a script element
   */
  injectScript(src: string, id?: string): void {
    const script = document.createElement('script')

    if (id) {
      script.id = id
    }

    script.src = src
    script.setAttribute('data-absmartly-injected', 'script')

    document.head.appendChild(script)
    this.injectedElements.add(script)

    if (this.debug) {
      console.log('[CodeInjector] Injected script:', src)
    }
  }

  /**
   * Remove all injected elements
   */
  removeAll(): void {
    this.injectedElements.forEach((element) => {
      try {
        element.parentNode?.removeChild(element)
      } catch (error) {
        console.error('[CodeInjector] Failed to remove injected element:', error)
      }
    })

    this.injectedElements.clear()

    if (this.debug) {
      console.log('[CodeInjector] Removed all injected elements')
    }
  }

  /**
   * Get all injected elements
   */
  getInjectedElements(): Element[] {
    return Array.from(this.injectedElements)
  }
}
