import { generateRobustSelector } from '~src/utils/selector-generator'

export class ElementPicker {
  private overlay: HTMLDivElement | null = null
  private notification: HTMLDivElement | null = null
  private isActive = false
  private selectedElement: Element | null = null
  private highlightedElement: Element | null = null
  private callback: ((selector: string) => void) | null = null
  private messageListener: ((message: any) => void) | null = null

  start(callback: (selector: string) => void) {
    if (this.isActive) {
      console.log('ElementPicker already active')
      return
    }
    
    console.log('ElementPicker starting...')
    this.isActive = true
    this.callback = callback
    this.createOverlay()
    this.createNotification()
    this.addEventListeners()
    
    // Listen for cancel message
    this.messageListener = (message: any) => {
      if (message.type === 'CANCEL_ELEMENT_PICKER') {
        console.log('ElementPicker received cancel message')
        this.stop()
      }
    }
    chrome.runtime.onMessage.addListener(this.messageListener)
    console.log('ElementPicker started successfully')
  }

  stop() {
    if (!this.isActive) return
    
    this.isActive = false
    this.removeOverlay()
    this.removeNotification()
    this.removeEventListeners()
    this.callback = null
    
    // Remove message listener
    if (this.messageListener) {
      chrome.runtime.onMessage.removeListener(this.messageListener)
      this.messageListener = null
    }
  }

  private removeNotification() {
    if (this.notification) {
      this.notification.remove()
      this.notification = null
    }
    // Remove animation style
    const style = document.querySelector('style[data-absmartly-animation]')
    if (style) {
      style.remove()
    }
  }

  private createOverlay() {
    this.overlay = document.createElement('div')
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 999999;
      pointer-events: none;
      background: none;
    `
    document.body.appendChild(this.overlay)
  }

  private createNotification() {
    this.notification = document.createElement('div')
    this.notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #4299e1;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 16px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000000;
      pointer-events: none;
      animation: slideDown 0.3s ease-out;
    `
    this.notification.textContent = '🎯 Click an element on the page...'
    
    // Add animation keyframes
    const style = document.createElement('style')
    style.setAttribute('data-absmartly-animation', 'true')
    style.textContent = `
      @keyframes slideDown {
        from {
          transform: translateX(-50%) translateY(-100%);
          opacity: 0;
        }
        to {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
      }
    `
    document.head.appendChild(style)
    document.body.appendChild(this.notification)
  }

  private removeOverlay() {
    if (this.overlay) {
      this.overlay.remove()
      this.overlay = null
    }
    this.removeHighlight()
  }

  private highlightElement(element: Element) {
    this.removeHighlight()
    
    const rect = element.getBoundingClientRect()
    const highlight = document.createElement('div')
    highlight.className = 'absmartly-element-highlight'
    highlight.style.cssText = `
      position: fixed;
      top: ${rect.top}px;
      left: ${rect.left}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      background: rgba(66, 153, 225, 0.3);
      border: 2px solid #4299e1;
      pointer-events: none;
      z-index: 999998;
      box-sizing: border-box;
    `
    
    // Add info tooltip
    const info = document.createElement('div')
    info.style.cssText = `
      position: absolute;
      top: -30px;
      left: 0;
      background: #4299e1;
      color: white;
      padding: 4px 8px;
      font-size: 12px;
      border-radius: 4px;
      white-space: nowrap;
      font-family: monospace;
    `
    const selector = this.generateSelector(element)
    info.textContent = selector
    highlight.appendChild(info)
    
    document.body.appendChild(highlight)
    this.highlightedElement = element
  }

  private removeHighlight() {
    const existing = document.querySelector('.absmartly-element-highlight')
    if (existing) {
      existing.remove()
    }
    this.highlightedElement = null
  }

  private generateSelector(element: Element, debug = false): string {
    // Try increasingly specific selectors until we find a unique one
    const maxParentLevels = [2, 3, 4, 5, 6, 7, 8]

    for (const levels of maxParentLevels) {
      const selector = generateRobustSelector(element, {
        preferDataAttributes: true,
        includeParentContext: true,
        maxParentLevels: levels,
        avoidAutoGenerated: true
      })

      const matches = document.querySelectorAll(selector)

      if (matches.length === 1 && matches[0] === element) {
        return selector
      }
    }

    // If still not unique, find the first diverging ancestor
    // and use descendant selector for better performance

    // Build ancestor chain
    const ancestors: Element[] = []
    let current: Element | null = element
    while (current && current !== document.body && ancestors.length < 10) {
      ancestors.push(current)
      current = current.parentElement
    }

    // Find the first ancestor level where elements diverge
    // by comparing attributes at each level for all matching target elements
    const targetTag = element.tagName.toLowerCase()
    const allTargets = Array.from(document.querySelectorAll(targetTag))

    for (let ancestorDepth = 1; ancestorDepth < ancestors.length; ancestorDepth++) {
      const ancestor = ancestors[ancestorDepth]
      const tagName = ancestor.tagName.toLowerCase()

      // Get data-* attributes for this ancestor
      const dataAttrs = Array.from(ancestor.attributes).filter(attr => attr.name.startsWith('data-'))

      // Try building a selector with this ancestor
      let ancestorSelector = tagName

      // Add data attributes if available
      if (dataAttrs.length > 0) {
        // Prefer data-framer-name and other stable attributes
        const stableAttr = dataAttrs.find(attr =>
          attr.name === 'data-framer-name' ||
          attr.name === 'data-name' ||
          attr.name === 'data-testid'
        )
        if (stableAttr) {
          ancestorSelector = `${tagName}[${stableAttr.name}="${stableAttr.value}"]`
        }
      }

      // Check if we need :nth-of-type
      if (ancestor.parentElement) {
        const siblings = Array.from(ancestor.parentElement.children).filter(
          child => child.tagName === ancestor.tagName
        )
        if (siblings.length > 1) {
          const index = siblings.indexOf(ancestor) + 1
          ancestorSelector += `:nth-of-type(${index})`
        }
      }

      // Build selector: ancestor descendant target
      const testSelector = `${ancestorSelector} ${targetTag}`
      const matches = document.querySelectorAll(testSelector)

      if (matches.length === 1 && matches[0] === element) {
        return testSelector
      }
    }

    // Fallback to child combinator approach if descendant didn't work
    const parts: string[] = []
    current = element
    let depth = 0

    while (current && current !== document.body && depth < 10) {
      const tagName = current.tagName.toLowerCase()
      const parent = current.parentElement

      if (parent) {
        const siblings = Array.from(parent.children).filter(child => child.tagName === current!.tagName)
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1
          parts.unshift(`${tagName}:nth-of-type(${index})`)
        } else {
          parts.unshift(tagName)
        }
      } else {
        parts.unshift(tagName)
      }

      // Check if current selector is unique
      const testSelector = parts.join(' > ')
      const matches = document.querySelectorAll(testSelector)
      if (matches.length === 1 && matches[0] === element) {
        return testSelector
      }

      current = parent
      depth++
    }

    const positionalSelector = parts.join(' > ')
    return positionalSelector
  }

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.isActive) return
    
    const element = document.elementFromPoint(e.clientX, e.clientY)
    if (element && element !== this.highlightedElement) {
      this.highlightElement(element)
    }
  }

  private handleClick = (e: MouseEvent) => {
    if (!this.isActive) return

    e.preventDefault()
    e.stopPropagation()

    const element = document.elementFromPoint(e.clientX, e.clientY)
    if (element) {
      const selector = this.generateSelector(element)
      this.selectedElement = element

      // Send message with the selected element
      chrome.runtime.sendMessage({
        type: 'ELEMENT_SELECTED',
        selector: selector
      })

      if (this.callback) {
        this.callback(selector)
      }

      this.stop()
    }
    
    return false
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.stop()
    }
  }

  private addEventListeners() {
    document.addEventListener('mousemove', this.handleMouseMove, true)
    document.addEventListener('click', this.handleClick, true)
    document.addEventListener('keydown', this.handleKeyDown, true)
    
    // Prevent context menu
    document.addEventListener('contextmenu', this.preventEvent, true)
  }

  private removeEventListeners() {
    document.removeEventListener('mousemove', this.handleMouseMove, true)
    document.removeEventListener('click', this.handleClick, true)
    document.removeEventListener('keydown', this.handleKeyDown, true)
    document.removeEventListener('contextmenu', this.preventEvent, true)
  }

  private preventEvent = (e: Event) => {
    if (this.isActive) {
      e.preventDefault()
      e.stopPropagation()
      return false
    }
  }
}