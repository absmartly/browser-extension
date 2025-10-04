export class DragDropPicker {
  private isActive = false
  private draggedElement: HTMLElement | null = null
  private draggedClone: HTMLElement | null = null
  private originalParent: HTMLElement | null = null
  private originalNextSibling: Element | null = null
  private highlightedDropZone: HTMLElement | null = null
  private dropZoneOverlay: HTMLElement | null = null
  private onComplete: ((result: { selector: string, targetSelector: string, position: string }) => void) | null = null
  
  // Styles for visual feedback
  private readonly DRAGGING_STYLE = `
    opacity: 0.5 !important;
    cursor: grabbing !important;
  `
  
  private readonly CLONE_STYLE = `
    position: fixed !important;
    pointer-events: none !important;
    z-index: 999999 !important;
    opacity: 0.7 !important;
    cursor: grabbing !important;
    transition: none !important;
    box-shadow: 0 10px 20px rgba(0,0,0,0.3) !important;
  `
  
  private readonly DROP_ZONE_STYLE = `
    outline: 2px dashed #3b82f6 !important;
    outline-offset: 2px !important;
    background-color: rgba(59, 130, 246, 0.05) !important;
  `
  
  private readonly DROP_INDICATOR_STYLE = `
    position: absolute !important;
    background-color: #3b82f6 !important;
    z-index: 999998 !important;
    pointer-events: none !important;
  `

  start(callback: (result: { selector: string, targetSelector: string, position: string }) => void) {
    if (this.isActive) return
    
    this.isActive = true
    this.onComplete = callback
    
    // Add event listeners
    document.addEventListener('mousedown', this.handleMouseDown, true)
    document.addEventListener('mouseover', this.handleMouseOver, true)
    document.addEventListener('click', this.handleClick, true)
    document.addEventListener('keydown', this.handleKeyDown, true)
    
    // Add visual feedback
    this.addPickerStyles()
    this.showInstructions()
  }
  
  stop() {
    this.isActive = false
    this.cleanup()
    
    // Remove event listeners
    document.removeEventListener('mousedown', this.handleMouseDown, true)
    document.removeEventListener('mouseover', this.handleMouseOver, true)
    document.removeEventListener('click', this.handleClick, true)
    document.removeEventListener('keydown', this.handleKeyDown, true)
    
    // Remove visual feedback
    this.removePickerStyles()
    this.hideInstructions()
  }
  
  private handleMouseDown = (e: MouseEvent) => {
    if (!this.isActive) return
    
    e.preventDefault()
    e.stopPropagation()
    
    const target = e.target as HTMLElement
    if (this.isExtensionElement(target)) return
    
    // Start dragging
    this.draggedElement = target
    this.originalParent = target.parentElement
    this.originalNextSibling = target.nextElementSibling
    
    // Create a clone for visual dragging
    this.createDragClone(target, e.clientX, e.clientY)
    
    // Add dragging styles to original element
    target.style.cssText += this.DRAGGING_STYLE
    
    // Add drag event listeners
    document.addEventListener('mousemove', this.handleMouseMove, true)
    document.addEventListener('mouseup', this.handleMouseUp, true)
  }
  
  private handleMouseMove = (e: MouseEvent) => {
    if (!this.draggedClone || !this.draggedElement) return
    
    e.preventDefault()
    e.stopPropagation()
    
    // Update clone position
    this.draggedClone.style.left = `${e.clientX - 20}px`
    this.draggedClone.style.top = `${e.clientY - 20}px`
    
    // Find and highlight potential drop zones
    const elementBelow = this.getElementBelow(e.clientX, e.clientY)
    
    if (elementBelow && elementBelow !== this.draggedElement) {
      this.highlightDropZone(elementBelow, e)
    } else {
      this.clearDropZoneHighlight()
    }
  }
  
  private handleMouseUp = (e: MouseEvent) => {
    if (!this.draggedElement) return
    
    e.preventDefault()
    e.stopPropagation()
    
    // Find the drop target
    const dropTarget = this.getElementBelow(e.clientX, e.clientY)
    
    if (dropTarget && dropTarget !== this.draggedElement) {
      // Check if target is a descendant of the dragged element
      if (this.draggedElement.contains(dropTarget)) {
        console.warn('Cannot move element into its own descendant')
        // Show error feedback
        this.draggedElement.style.outline = '2px solid #ef4444'
        this.draggedElement.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
        setTimeout(() => {
          this.cleanup()
        }, 500)
        return
      }
      
      const position = this.getDropPosition(dropTarget, e)
      const result = {
        selector: this.getSelector(this.draggedElement),
        targetSelector: this.getSelector(dropTarget),
        position: position
      }
      
      // Show preview of the move
      this.previewMove(this.draggedElement, dropTarget, position)
      
      // Wait a moment to show the preview, then complete
      setTimeout(() => {
        this.cleanup()
        if (this.onComplete) {
          this.onComplete(result)
        }
        this.stop()
      }, 500)
    } else {
      // Cancel the drag
      this.cleanup()
    }
    
    // Remove drag event listeners
    document.removeEventListener('mousemove', this.handleMouseMove, true)
    document.removeEventListener('mouseup', this.handleMouseUp, true)
  }
  
  private handleMouseOver = (e: MouseEvent) => {
    if (this.draggedElement) return // Don't highlight during drag
    
    const target = e.target as HTMLElement
    if (this.isExtensionElement(target)) return
    
    // Highlight potential draggable element
    target.style.outline = '2px solid #3b82f6'
    target.style.cursor = 'grab'
  }
  
  private handleClick = (e: MouseEvent) => {
    // Prevent default click behavior during drag-drop mode
    if (this.isActive) {
      e.preventDefault()
      e.stopPropagation()
    }
  }
  
  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.cleanup()
      this.stop()
    }
  }
  
  private createDragClone(element: HTMLElement, x: number, y: number) {
    this.draggedClone = element.cloneNode(true) as HTMLElement
    this.draggedClone.style.cssText = this.CLONE_STYLE
    this.draggedClone.style.left = `${x - 20}px`
    this.draggedClone.style.top = `${y - 20}px`
    this.draggedClone.style.width = `${element.offsetWidth}px`
    this.draggedClone.style.height = `${element.offsetHeight}px`
    
    document.body.appendChild(this.draggedClone)
  }
  
  private getElementBelow(x: number, y: number): HTMLElement | null {
    // Temporarily hide the clone to get element below
    if (this.draggedClone) {
      this.draggedClone.style.display = 'none'
    }
    
    const element = document.elementFromPoint(x, y) as HTMLElement
    
    if (this.draggedClone) {
      this.draggedClone.style.display = ''
    }
    
    // Don't allow dropping on extension elements or the dragged element itself
    if (element && !this.isExtensionElement(element) && element !== this.draggedElement) {
      return element
    }
    
    return null
  }
  
  private highlightDropZone(element: HTMLElement, e: MouseEvent) {
    // Don't highlight if it's an invalid drop target (descendant of dragged element)
    if (this.draggedElement && this.draggedElement.contains(element)) {
      // Show invalid drop zone
      this.clearDropZoneHighlight()
      this.highlightedDropZone = element
      element.style.outline = '2px dashed #ef4444'
      element.style.backgroundColor = 'rgba(239, 68, 68, 0.05)'
      return
    }
    
    // Clear previous highlight
    this.clearDropZoneHighlight()
    
    this.highlightedDropZone = element
    element.style.cssText += this.DROP_ZONE_STYLE
    
    // Show drop position indicator
    this.showDropIndicator(element, e)
  }
  
  private clearDropZoneHighlight() {
    if (this.highlightedDropZone) {
      this.highlightedDropZone.style.outline = ''
      this.highlightedDropZone.style.backgroundColor = ''
      this.highlightedDropZone = null
    }
    
    if (this.dropZoneOverlay) {
      this.dropZoneOverlay.remove()
      this.dropZoneOverlay = null
    }
  }
  
  private showDropIndicator(element: HTMLElement, e: MouseEvent) {
    const rect = element.getBoundingClientRect()
    const position = this.getDropPosition(element, e)
    
    // Remove existing overlay
    if (this.dropZoneOverlay) {
      this.dropZoneOverlay.remove()
    }
    
    // Create drop position indicator
    this.dropZoneOverlay = document.createElement('div')
    this.dropZoneOverlay.style.cssText = this.DROP_INDICATOR_STYLE
    
    switch (position) {
      case 'before':
        this.dropZoneOverlay.style.left = `${rect.left}px`
        this.dropZoneOverlay.style.top = `${rect.top - 2}px`
        this.dropZoneOverlay.style.width = `${rect.width}px`
        this.dropZoneOverlay.style.height = '4px'
        break
      case 'after':
        this.dropZoneOverlay.style.left = `${rect.left}px`
        this.dropZoneOverlay.style.top = `${rect.bottom - 2}px`
        this.dropZoneOverlay.style.width = `${rect.width}px`
        this.dropZoneOverlay.style.height = '4px'
        break
      case 'firstChild':
      case 'lastChild':
        // Show as inner border for child positions
        this.dropZoneOverlay.style.left = `${rect.left + 5}px`
        this.dropZoneOverlay.style.top = `${rect.top + 5}px`
        this.dropZoneOverlay.style.width = `${rect.width - 10}px`
        this.dropZoneOverlay.style.height = `${rect.height - 10}px`
        this.dropZoneOverlay.style.border = '2px solid #3b82f6'
        this.dropZoneOverlay.style.backgroundColor = 'transparent'
        break
    }
    
    document.body.appendChild(this.dropZoneOverlay)
  }
  
  private getDropPosition(element: HTMLElement, e: MouseEvent): string {
    const rect = element.getBoundingClientRect()
    const y = e.clientY
    
    // Determine position based on mouse position relative to element
    const topQuarter = rect.top + rect.height * 0.25
    const bottomQuarter = rect.bottom - rect.height * 0.25
    
    if (y < topQuarter) {
      return 'before'
    } else if (y > bottomQuarter) {
      return 'after'
    } else {
      // Check if element can have children
      const hasChildren = element.children.length > 0
      const canHaveChildren = !['IMG', 'INPUT', 'BR', 'HR'].includes(element.tagName)
      
      if (canHaveChildren) {
        // Decide between first child and last child based on position
        return y < rect.top + rect.height / 2 ? 'firstChild' : 'lastChild'
      } else {
        // Default to after for elements that can't have children
        return 'after'
      }
    }
  }
  
  private previewMove(element: HTMLElement, target: HTMLElement, position: string) {
    // Check if target is a descendant of element to prevent hierarchy errors
    if (element.contains(target)) {
      console.warn('Cannot move element into its own descendant')
      // Just highlight without moving
      element.style.outline = '2px solid #ef4444'
      element.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
      setTimeout(() => {
        element.style.outline = ''
        element.style.backgroundColor = ''
      }, 400)
      return
    }
    
    // Temporarily move the element to show preview
    switch (position) {
      case 'before':
        target.parentElement?.insertBefore(element, target)
        break
      case 'after':
        if (target.nextSibling) {
          target.parentElement?.insertBefore(element, target.nextSibling)
        } else {
          target.parentElement?.appendChild(element)
        }
        break
      case 'firstChild':
        if (target.firstChild) {
          target.insertBefore(element, target.firstChild)
        } else {
          target.appendChild(element)
        }
        break
      case 'lastChild':
        target.appendChild(element)
        break
    }
    
    // Add highlight to show the move
    element.style.outline = '2px solid #10b981'
    element.style.backgroundColor = 'rgba(16, 185, 129, 0.1)'
    
    // Restore original position after preview
    setTimeout(() => {
      if (this.originalParent) {
        if (this.originalNextSibling) {
          this.originalParent.insertBefore(element, this.originalNextSibling)
        } else {
          this.originalParent.appendChild(element)
        }
      }
      element.style.outline = ''
      element.style.backgroundColor = ''
    }, 400)
  }
  
  private cleanup() {
    // Remove clone
    if (this.draggedClone) {
      this.draggedClone.remove()
      this.draggedClone = null
    }
    
    // Restore original element
    if (this.draggedElement) {
      this.draggedElement.style.opacity = ''
      this.draggedElement.style.cursor = ''
      this.draggedElement = null
    }
    
    // Clear highlights
    this.clearDropZoneHighlight()
    
    // Clear all element styles
    document.querySelectorAll('*').forEach(el => {
      const element = el as HTMLElement
      if (!this.isExtensionElement(element)) {
        element.style.outline = ''
        element.style.cursor = ''
        element.style.backgroundColor = ''
      }
    })
  }
  
  private getSelector(element: HTMLElement): string {
    // Generate a unique selector for the element
    if (element.id) {
      return `#${element.id}`
    }
    
    const path: string[] = []
    let current: HTMLElement | null = element
    
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase()
      
      // Handle both regular elements and SVG elements
      const className = typeof current.className === 'string' 
        ? current.className 
        : (current.className as SVGAnimatedString)?.baseVal || ''
      
      if (className) {
        const classes = className.split(' ').filter(c => c && !c.includes('absmartly'))
        if (classes.length > 0) {
          selector += '.' + classes.join('.')
        }
      }
      
      // Add nth-child if needed
      const parent = current.parentElement
      if (parent) {
        const siblings = Array.from(parent.children)
        const index = siblings.indexOf(current)
        if (siblings.filter(s => s.tagName === current!.tagName).length > 1) {
          selector += `:nth-child(${index + 1})`
        }
      }
      
      path.unshift(selector)
      current = current.parentElement
    }
    
    return path.join(' > ')
  }
  
  private isExtensionElement(element: HTMLElement): boolean {
    // Check if element is part of the extension UI
    const className = typeof element.className === 'string' 
      ? element.className 
      : (element.className as SVGAnimatedString)?.baseVal || ''
    
    return element.id?.includes('absmartly') || 
           className.includes('absmartly') ||
           element.closest('#absmartly-visual-editor-root') !== null ||
           element.closest('[id*="absmartly"]') !== null
  }
  
  private addPickerStyles() {
    const style = document.createElement('style')
    style.id = 'absmartly-dragdrop-styles'
    style.textContent = `
      body.absmartly-dragdrop-mode * {
        user-select: none !important;
      }
      body.absmartly-dragdrop-mode *:hover {
        cursor: grab !important;
      }
    `
    document.head.appendChild(style)
    document.body.classList.add('absmartly-dragdrop-mode')
  }
  
  private removePickerStyles() {
    document.getElementById('absmartly-dragdrop-styles')?.remove()
    document.body.classList.remove('absmartly-dragdrop-mode')
  }
  
  private showInstructions() {
    const instructions = document.createElement('div')
    instructions.id = 'absmartly-dragdrop-instructions'
    instructions.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px 25px;
      border-radius: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      z-index: 999999;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      animation: slideDown 0.3s ease-out;
    `
    instructions.innerHTML = `
      <strong>🎯 Drag & Drop Mode</strong><br>
      Click and drag any element to move it. Release to drop. Press ESC to cancel.
    `
    
    // Add animation
    const styleSheet = document.createElement('style')
    styleSheet.textContent = `
      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
    `
    document.head.appendChild(styleSheet)
    document.body.appendChild(instructions)
  }
  
  private hideInstructions() {
    document.getElementById('absmartly-dragdrop-instructions')?.remove()
  }
}