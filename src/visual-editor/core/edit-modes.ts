/**
 * Edit Modes for Visual Editor
 * Handles rearrange mode (drag & drop) and resize mode functionality
 */

import StateManager from './state-manager'

export class EditModes {
  private stateManager: StateManager

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager
  }

  enableRearrangeMode(element: Element): void {
    console.log('[ABSmartly] Enabling rearrange mode for element:', element)

    const smartElement = this.getSmartDraggableElement(element)
    if (!smartElement) return

    this.stateManager.setRearranging(true)
    smartElement.classList.add('absmartly-draggable')

    // Store original parent info
    const originalParent = smartElement.parentElement
    const originalNextSibling = smartElement.nextElementSibling

    // Make element draggable
    ;(smartElement as HTMLElement).draggable = true

    const handleDragStart = (e: DragEvent) => {
      console.log('[ABSmartly] Drag start')
      this.stateManager.setDraggedElement(smartElement)
      smartElement.classList.add('absmartly-dragging')

      // Set drag data
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/html', smartElement.outerHTML)
      }
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move'
      }
      const target = e.target as Element
      if (target !== smartElement && !smartElement.contains(target)) {
        target.classList.add('absmartly-drop-target')
      }
    }

    const handleDragLeave = (e: DragEvent) => {
      ;(e.target as Element).classList.remove('absmartly-drop-target')
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      const target = e.target as Element
      const dropTarget = target.closest('*:not(script):not(style):not(link)') as Element

      if (dropTarget && dropTarget !== smartElement && !smartElement.contains(dropTarget)) {
        // Remove drop target styling
        document.querySelectorAll('.absmartly-drop-target').forEach(el => {
          el.classList.remove('absmartly-drop-target')
        })

        // Determine drop position
        const rect = dropTarget.getBoundingClientRect()
        const dropY = e.clientY
        const insertAfter = dropY > rect.top + rect.height / 2

        try {
          if (insertAfter && dropTarget.nextElementSibling) {
            dropTarget.parentElement?.insertBefore(smartElement, dropTarget.nextElementSibling)
          } else if (!insertAfter) {
            dropTarget.parentElement?.insertBefore(smartElement, dropTarget)
          } else {
            dropTarget.parentElement?.appendChild(smartElement)
          }

          // Track the change
          this.trackMoveChange(smartElement, originalParent, originalNextSibling)
          console.log('[ABSmartly] Element moved successfully')
        } catch (error) {
          console.warn('[ABSmartly] Move failed:', error)
        }
      }
    }

    const handleDragEnd = (e: DragEvent) => {
      console.log('[ABSmartly] Drag end')

      // Clean up drag state
      smartElement.classList.remove('absmartly-dragging')
      ;(smartElement as HTMLElement).draggable = false
      this.stateManager.setDraggedElement(null)
      this.stateManager.setRearranging(false)

      // Remove all drop target indicators
      document.querySelectorAll('.absmartly-drop-target').forEach(el => {
        el.classList.remove('absmartly-drop-target')
      })

      // Remove event listeners
      smartElement.removeEventListener('dragstart', handleDragStart)
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('drop', handleDrop)
      smartElement.removeEventListener('dragend', handleDragEnd)

      smartElement.classList.remove('absmartly-draggable')
    }

    // Add event listeners
    smartElement.addEventListener('dragstart', handleDragStart)
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('drop', handleDrop)
    smartElement.addEventListener('dragend', handleDragEnd)

    // Auto-exit after 10 seconds
    setTimeout(() => {
      if (this.stateManager.getState().isRearranging) {
        handleDragEnd(new DragEvent('dragend'))
      }
    }, 10000)
  }

  enableResizeMode(element: Element): void {
    console.log('[ABSmartly] Enabling resize mode for element:', element)

    this.stateManager.setResizing(true)
    element.classList.add('absmartly-resize-active')

    // Store original styles
    const originalStyles = {
      width: (element as HTMLElement).style.width,
      height: (element as HTMLElement).style.height,
      position: (element as HTMLElement).style.position,
      top: (element as HTMLElement).style.top,
      left: (element as HTMLElement).style.left
    }

    // Create resize handles
    const handles = this.createResizeHandles(element as HTMLElement)

    const handleMouseDown = (e: MouseEvent, direction: string) => {
      e.preventDefault()
      e.stopPropagation()

      const startX = e.clientX
      const startY = e.clientY
      const startRect = element.getBoundingClientRect()

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX
        const deltaY = moveEvent.clientY - startY

        this.applyResize(element as HTMLElement, direction, deltaX, deltaY, startRect)
      }

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)

        // Track the change
        this.trackResizeChange(element, originalStyles)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    // Attach handlers to resize handles
    handles.forEach(handle => {
      const direction = handle.dataset.direction!
      handle.addEventListener('mousedown', (e) => handleMouseDown(e, direction))
    })

    // Exit resize mode on Escape or click outside
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.exitResizeMode(element as HTMLElement, handles)
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element
      if (!element.contains(target) && !target.closest('[data-absmartly-resize-handle]')) {
        this.exitResizeMode(element as HTMLElement, handles)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('click', handleClickOutside, true)

    // Store cleanup functions
    ;(element as any).__absmartlyResizeCleanup = () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('click', handleClickOutside, true)
    }
  }

  private getSmartDraggableElement(element: Element): Element | null {
    // Logic to find the best draggable parent element
    let current: Element | null = element

    while (current && current !== document.body) {
      const tagName = current.tagName.toLowerCase()
      const computedStyle = window.getComputedStyle(current)

      // Skip inline elements unless they have specific styling
      if (computedStyle.display === 'inline' &&
          !['a', 'button', 'span'].includes(tagName)) {
        current = current.parentElement
        continue
      }

      // Prefer block-level containers
      if (['div', 'section', 'article', 'header', 'footer', 'main', 'aside'].includes(tagName)) {
        return current
      }

      // Also good candidates
      if (['li', 'tr', 'td', 'th', 'figure', 'blockquote'].includes(tagName)) {
        return current
      }

      current = current.parentElement
    }

    return element // Fallback to original element
  }

  private createResizeHandles(element: HTMLElement): HTMLElement[] {
    const handles: HTMLElement[] = []
    const directions = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

    directions.forEach(direction => {
      const handle = document.createElement('div')
      handle.dataset.absmartlyResizeHandle = 'true'
      handle.dataset.direction = direction
      handle.style.cssText = `
        position: absolute;
        background: #3b82f6;
        border: 2px solid white;
        border-radius: 50%;
        width: 10px;
        height: 10px;
        cursor: ${this.getResizeCursor(direction)};
        z-index: 2147483647;
        pointer-events: auto;
      `

      this.positionResizeHandle(handle, direction, element)
      handles.push(handle)
      document.body.appendChild(handle)
    })

    return handles
  }

  private positionResizeHandle(handle: HTMLElement, direction: string, element: HTMLElement): void {
    const rect = element.getBoundingClientRect()
    const scrollX = window.scrollX
    const scrollY = window.scrollY

    const positions: { [key: string]: { left: number; top: number } } = {
      'nw': { left: rect.left - 5, top: rect.top - 5 },
      'n': { left: rect.left + rect.width / 2 - 5, top: rect.top - 5 },
      'ne': { left: rect.right - 5, top: rect.top - 5 },
      'e': { left: rect.right - 5, top: rect.top + rect.height / 2 - 5 },
      'se': { left: rect.right - 5, top: rect.bottom - 5 },
      's': { left: rect.left + rect.width / 2 - 5, top: rect.bottom - 5 },
      'sw': { left: rect.left - 5, top: rect.bottom - 5 },
      'w': { left: rect.left - 5, top: rect.top + rect.height / 2 - 5 }
    }

    const pos = positions[direction]
    handle.style.left = (pos.left + scrollX) + 'px'
    handle.style.top = (pos.top + scrollY) + 'px'
    handle.style.position = 'absolute'
  }

  private getResizeCursor(direction: string): string {
    const cursors: { [key: string]: string } = {
      'nw': 'nw-resize',
      'n': 'n-resize',
      'ne': 'ne-resize',
      'e': 'e-resize',
      'se': 'se-resize',
      's': 's-resize',
      'sw': 'sw-resize',
      'w': 'w-resize'
    }
    return cursors[direction] || 'move'
  }

  private applyResize(element: HTMLElement, direction: string, deltaX: number, deltaY: number, startRect: DOMRect): void {
    const style = element.style

    switch (direction) {
      case 'se': // Southeast - resize both width and height
        style.width = Math.max(50, startRect.width + deltaX) + 'px'
        style.height = Math.max(20, startRect.height + deltaY) + 'px'
        break

      case 'e': // East - resize width only
        style.width = Math.max(50, startRect.width + deltaX) + 'px'
        break

      case 's': // South - resize height only
        style.height = Math.max(20, startRect.height + deltaY) + 'px'
        break

      case 'sw': // Southwest
        style.width = Math.max(50, startRect.width - deltaX) + 'px'
        style.height = Math.max(20, startRect.height + deltaY) + 'px'
        break

      case 'w': // West
        style.width = Math.max(50, startRect.width - deltaX) + 'px'
        break

      case 'nw': // Northwest
        style.width = Math.max(50, startRect.width - deltaX) + 'px'
        style.height = Math.max(20, startRect.height - deltaY) + 'px'
        break

      case 'n': // North
        style.height = Math.max(20, startRect.height - deltaY) + 'px'
        break

      case 'ne': // Northeast
        style.width = Math.max(50, startRect.width + deltaX) + 'px'
        style.height = Math.max(20, startRect.height - deltaY) + 'px'
        break
    }
  }

  private exitResizeMode(element: HTMLElement, handles: HTMLElement[]): void {
    element.classList.remove('absmartly-resize-active')
    this.stateManager.setResizing(false)

    // Remove handles
    handles.forEach(handle => handle.remove())

    // Clean up event listeners
    if ((element as any).__absmartlyResizeCleanup) {
      ;(element as any).__absmartlyResizeCleanup()
      delete (element as any).__absmartlyResizeCleanup
    }
  }

  private trackMoveChange(element: Element, originalParent: Element | null, originalNextSibling: Element | null): void {
    // This will be handled by the change tracking module
    console.log('[ABSmartly] Tracking move change for element:', element)
  }

  private trackResizeChange(element: Element, originalStyles: any): void {
    // This will be handled by the change tracking module
    console.log('[ABSmartly] Tracking resize change for element:', element)
  }
}

export default EditModes