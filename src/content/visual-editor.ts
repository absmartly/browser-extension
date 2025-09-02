import type { DOMChange } from '~src/types/dom-changes'

export interface VisualEditorOptions {
  variantName: string
  onChangesUpdate: (changes: DOMChange[]) => void
  initialChanges?: DOMChange[]
}

export class VisualEditor {
  private isActive = false
  private selectedElement: HTMLElement | null = null
  private contextMenu: HTMLElement | null = null
  private toolbar: HTMLElement | null = null
  private sidebar: HTMLElement | null = null
  private sidebarToggle: HTMLElement | null = null
  private hoverTooltip: HTMLElement | null = null
  private hoveredElement: HTMLElement | null = null
  private changes: DOMChange[] = []
  private originalValues = new Map<HTMLElement, any>()
  private options: VisualEditorOptions
  private mutationObserver: MutationObserver | null = null
  private isInternalChange = false
  private sidebarVisible = true
  
  constructor(options: VisualEditorOptions) {
    this.options = options
    this.changes = options.initialChanges || []
  }
  
  start() {
    if (this.isActive) return
    
    this.isActive = true
    console.log('Visual Editor: Starting...')
    this.injectStyles()
    this.createToolbar()
    this.setupEventListeners()
    this.startMutationObserver()
    this.makeElementsEditable()
    
    // Show notification
    this.showNotification('Visual Editor Active', 'Click any element to edit')
    console.log('Visual Editor: Started successfully')
  }
  
  stop() {
    if (!this.isActive) return
    
    this.isActive = false
    this.removeEventListeners()
    this.stopMutationObserver()
    this.makeElementsNonEditable()
    this.removeContextMenu()
    this.removeToolbar()
    this.removeStyles()
    
    // Save final changes
    this.options.onChangesUpdate(this.changes)
  }
  
  destroy() {
    this.stop()
  }
  
  getChanges() {
    return this.changes
  }
  
  private injectStyles() {
    const style = document.createElement('style')
    style.id = 'absmartly-visual-editor-styles'
    style.textContent = `
      .absmartly-editable {
        outline: 2px dashed transparent !important;
        transition: outline 0.2s !important;
        cursor: pointer !important;
      }
      
      .absmartly-editable:hover {
        outline-color: #3b82f6 !important;
      }
      
      .absmartly-selected {
        outline: 2px solid #3b82f6 !important;
        position: relative !important;
      }
      
      .absmartly-editing {
        outline: 2px solid #10b981 !important;
      }
      
      .absmartly-context-menu {
        position: fixed !important;
        background: white !important;
        border: 1px solid #e5e7eb !important;
        border-radius: 8px !important;
        box-shadow: 0 10px 25px rgba(0,0,0,0.1) !important;
        padding: 8px !important;
        z-index: 2147483647 !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        font-size: 14px !important;
        min-width: 200px !important;
        pointer-events: auto !important;
        user-select: none !important;
      }
      
      .absmartly-menu-item {
        padding: 8px 12px !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        border-radius: 4px !important;
        transition: background 0.15s !important;
        color: #1f2937 !important;
        text-decoration: none !important;
      }
      
      .absmartly-menu-item:hover {
        background: #f3f4f6 !important;
      }
      
      .absmartly-menu-separator {
        height: 1px !important;
        background: #e5e7eb !important;
        margin: 4px 0 !important;
      }
      
      .absmartly-toolbar {
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        background: white !important;
        border: 2px solid #3b82f6 !important;
        border-radius: 12px !important;
        padding: 12px !important;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2) !important;
        z-index: 2147483646 !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        font-size: 14px !important;
        max-width: 320px !important;
        pointer-events: auto !important;
        user-select: none !important;
      }
      
      .absmartly-hover-tooltip {
        position: fixed !important;
        background: #1f2937 !important;
        color: white !important;
        padding: 6px 10px !important;
        border-radius: 6px !important;
        font-size: 12px !important;
        font-family: monospace !important;
        z-index: 2147483645 !important;
        pointer-events: none !important;
        white-space: nowrap !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        opacity: 0.95 !important;
      }
      
      .absmartly-toolbar-instructions {
        background: #eff6ff !important;
        padding: 10px !important;
        border-radius: 6px !important;
        font-size: 12px !important;
        line-height: 1.6 !important;
        color: #1e40af !important;
        border: 1px solid #93c5fd !important;
      }
      
      .absmartly-toolbar-instructions strong {
        color: #1e3a8a !important;
        font-weight: 600 !important;
      }
      
      .absmartly-toolbar-header {
        font-weight: 600 !important;
        padding: 4px 8px !important;
        border-bottom: 1px solid #e5e7eb !important;
        margin-bottom: 4px !important;
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
      }
      
      .absmartly-changes-count {
        background: #3b82f6 !important;
        color: white !important;
        padding: 2px 8px !important;
        border-radius: 12px !important;
        font-size: 12px !important;
        font-weight: 500 !important;
      }
      
      .absmartly-toolbar-button {
        padding: 8px 12px !important;
        background: #f3f4f6 !important;
        border: 1px solid #e5e7eb !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        text-align: center !important;
        transition: all 0.15s !important;
        color: #1f2937 !important;
      }
      
      .absmartly-toolbar-button:hover {
        background: #e5e7eb !important;
      }
      
      .absmartly-toolbar-button.primary {
        background: #3b82f6 !important;
        color: white !important;
        border-color: #3b82f6 !important;
      }
      
      .absmartly-toolbar-button.primary:hover {
        background: #2563eb !important;
      }
      
      .absmartly-toolbar-button.danger {
        background: #ef4444 !important;
        color: white !important;
        border-color: #ef4444 !important;
      }
      
      .absmartly-notification {
        position: fixed !important;
        bottom: 20px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        background: #1f2937 !important;
        color: white !important;
        padding: 12px 20px !important;
        border-radius: 8px !important;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2) !important;
        z-index: 999999 !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        font-size: 14px !important;
        animation: slideUp 0.3s ease-out !important;
      }
      
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
      
      .absmartly-color-picker {
        position: fixed !important;
        background: white !important;
        border: 1px solid #e5e7eb !important;
        border-radius: 8px !important;
        padding: 12px !important;
        box-shadow: 0 10px 25px rgba(0,0,0,0.1) !important;
        z-index: 999999 !important;
      }
      
      .absmartly-color-grid {
        display: grid !important;
        grid-template-columns: repeat(8, 1fr) !important;
        gap: 4px !important;
        margin-bottom: 8px !important;
      }
      
      .absmartly-color-swatch {
        width: 24px !important;
        height: 24px !important;
        border-radius: 4px !important;
        cursor: pointer !important;
        border: 1px solid #e5e7eb !important;
        transition: transform 0.15s !important;
      }
      
      .absmartly-color-swatch:hover {
        transform: scale(1.2) !important;
      }
      
      .absmartly-color-input {
        width: 100% !important;
        padding: 6px 8px !important;
        border: 1px solid #e5e7eb !important;
        border-radius: 4px !important;
        font-family: monospace !important;
        font-size: 12px !important;
      }
    `
    document.head.appendChild(style)
  }
  
  private removeStyles() {
    document.getElementById('absmartly-visual-editor-styles')?.remove()
  }
  
  private createToolbar() {
    this.toolbar = document.createElement('div')
    this.toolbar.className = 'absmartly-toolbar'
    this.toolbar.innerHTML = `
      <div class="absmartly-toolbar-header">
        <span>Visual Editor</span>
        <span class="absmartly-changes-count">${this.changes.length}</span>
      </div>
      <div class="absmartly-toolbar-instructions">
        <strong>How to use:</strong><br>
        • <strong>Click</strong> any element to select & edit<br>
        • Menu opens automatically on selection<br>
        • Selected elements have blue outline<br>
        • Press <strong>ESC</strong> to deselect
      </div>
      <button class="absmartly-toolbar-button" data-action="undo">↶ Undo Last Change</button>
      <button class="absmartly-toolbar-button" data-action="clear">Clear All Changes</button>
      <button class="absmartly-toolbar-button primary" data-action="save">Save Changes</button>
      <button class="absmartly-toolbar-button danger" data-action="exit">Exit Editor</button>
    `
    document.body.appendChild(this.toolbar)
    
    // Add toolbar event listeners
    this.toolbar.addEventListener('click', this.handleToolbarClick)
  }
  
  private removeToolbar() {
    this.toolbar?.remove()
    this.toolbar = null
  }
  
  private updateToolbar() {
    if (!this.toolbar) return
    const count = this.toolbar.querySelector('.absmartly-changes-count')
    if (count) {
      count.textContent = String(this.changes.length)
    }
  }
  
  private handleToolbarClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    
    const target = e.target as HTMLElement
    const action = target.getAttribute('data-action')
    
    switch (action) {
      case 'undo':
        this.undoLastChange()
        break
      case 'clear':
        this.clearAllChanges()
        break
      case 'save':
        this.saveChanges()
        break
      case 'exit':
        this.stop()
        break
    }
  }
  
  private setupEventListeners() {
    // Use capture phase but check target first
    document.addEventListener('click', this.handleElementClick, true)
    document.addEventListener('contextmenu', this.handleContextMenu, true)
    document.addEventListener('keydown', this.handleKeyDown, true)
    
    // Add mouse event handlers to prevent menu selection
    document.addEventListener('mousedown', this.handleMouseDown, true)
    document.addEventListener('mouseup', this.handleMouseUp, true)
    
    // Add hover handlers for tooltip
    document.addEventListener('mouseover', this.handleMouseOver, true)
    document.addEventListener('mouseout', this.handleMouseOut, true)
  }
  
  private removeEventListeners() {
    document.removeEventListener('click', this.handleElementClick, true)
    document.removeEventListener('contextmenu', this.handleContextMenu, true)
    document.removeEventListener('keydown', this.handleKeyDown, true)
    document.removeEventListener('mousedown', this.handleMouseDown, true)
    document.removeEventListener('mouseup', this.handleMouseUp, true)
    document.removeEventListener('mouseover', this.handleMouseOver, true)
    document.removeEventListener('mouseout', this.handleMouseOut, true)
    
    // Remove tooltip if exists
    this.removeHoverTooltip()
  }
  
  private handleMouseDown = (e: MouseEvent) => {
    if (!this.isActive) return
    
    const target = e.target as HTMLElement
    
    // CRITICAL: Check extension element BEFORE doing anything else
    if (this.isExtensionElement(target)) {
      // Don't interfere with extension UI at all
      return
    }
    
    // Only prevent default for page elements
    e.preventDefault()
    e.stopPropagation()
  }
  
  private handleMouseUp = (e: MouseEvent) => {
    if (!this.isActive) return
    
    const target = e.target as HTMLElement
    
    // CRITICAL: Check extension element BEFORE doing anything else
    if (this.isExtensionElement(target)) {
      // Don't interfere with extension UI at all
      return
    }
    
    e.preventDefault()
    e.stopPropagation()
  }
  
  private handleElementClick = (e: MouseEvent) => {
    if (!this.isActive) return
    
    const target = e.target as HTMLElement
    
    // CRITICAL: Check if this is an extension element FIRST before any other processing
    if (this.isExtensionElement(target)) {
      console.log('Visual Editor: Click on extension UI - ignoring completely')
      // Don't process this event at all
      return
    }
    
    console.log('Visual Editor: Click detected on page element', target)
    
    // Now we know it's a page element, so prevent default and stop propagation
    e.preventDefault()
    e.stopPropagation()
    
    // If clicking outside context menu, close it
    if (this.contextMenu) {
      this.removeContextMenu()
    }
    
    // Don't select during certain operations
    if (target.contentEditable === 'true') return
    
    // Select the element on normal click
    this.selectElement(target)
    console.log('Visual Editor: Element selected', this.getSelector(target))
    
    // Show context menu on selection
    this.showContextMenu(e.clientX, e.clientY)
  }
  
  private handleContextMenu = (e: MouseEvent) => {
    if (!this.isActive) return
    
    const target = e.target as HTMLElement
    if (this.isExtensionElement(target)) return
    
    e.preventDefault()
    e.stopPropagation()
    
    this.selectElement(target)
    this.showContextMenu(e.clientX, e.clientY)
  }
  
  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this.isActive) return
    
    if (e.key === 'Escape') {
      if (this.contextMenu) {
        this.removeContextMenu()
      } else if (this.selectedElement) {
        this.deselectElement()
      } else {
        this.stop()
      }
    }
  }
  
  private handleMouseOver = (e: MouseEvent) => {
    if (!this.isActive) return
    
    const target = e.target as HTMLElement
    
    // Don't show tooltip for extension elements or if context menu is open
    if (this.isExtensionElement(target) || this.contextMenu) return
    
    // Don't show tooltip for already selected element
    if (target === this.selectedElement) return
    
    // Remove previous tooltip if hovering new element
    if (this.hoveredElement && this.hoveredElement !== target) {
      this.removeHoverTooltip()
    }
    
    this.hoveredElement = target
    this.showHoverTooltip(target, e.clientX, e.clientY)
  }
  
  private handleMouseOut = (e: MouseEvent) => {
    if (!this.isActive) return
    
    const target = e.target as HTMLElement
    if (target === this.hoveredElement) {
      this.removeHoverTooltip()
      this.hoveredElement = null
    }
  }
  
  private showHoverTooltip(element: HTMLElement, x: number, y: number) {
    // Remove any existing tooltip
    this.removeHoverTooltip()
    
    // Create tooltip
    this.hoverTooltip = document.createElement('div')
    this.hoverTooltip.className = 'absmartly-hover-tooltip'
    this.hoverTooltip.textContent = this.getSelector(element)
    
    // Position tooltip near cursor but avoid edges
    const tooltipX = Math.min(x + 10, window.innerWidth - 200)
    const tooltipY = y - 30
    
    this.hoverTooltip.style.left = `${tooltipX}px`
    this.hoverTooltip.style.top = `${tooltipY}px`
    
    document.body.appendChild(this.hoverTooltip)
  }
  
  private removeHoverTooltip() {
    if (this.hoverTooltip) {
      this.hoverTooltip.remove()
      this.hoverTooltip = null
    }
  }
  
  private selectElement(element: HTMLElement) {
    // Deselect previous element
    if (this.selectedElement) {
      this.selectedElement.classList.remove('absmartly-selected')
    }
    
    this.selectedElement = element
    element.classList.add('absmartly-selected')
  }
  
  private deselectElement() {
    if (this.selectedElement) {
      this.selectedElement.classList.remove('absmartly-selected')
      this.selectedElement = null
    }
    this.removeContextMenu()
  }
  
  private showContextMenu(x: number, y: number) {
    this.removeContextMenu()
    
    if (!this.selectedElement) return
    
    // Create a blocking overlay that covers the entire page
    const overlay = document.createElement('div')
    overlay.id = 'absmartly-menu-overlay'
    overlay.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      z-index: 2147483646 !important;
      background: transparent !important;
      pointer-events: auto !important;
    `
    
    // Create the menu
    this.contextMenu = document.createElement('div')
    this.contextMenu.className = 'absmartly-context-menu'
    this.contextMenu.id = 'absmartly-context-menu-main'
    
    // Create menu items matching Mida's layout
    const menuItems: Array<{ icon: string, label: string, action: string, separator?: boolean, shortcut?: string }> = [
      { icon: '✏️', label: 'Edit Element', action: 'edit-element' },
      { icon: '</>', label: 'Edit HTML', action: 'edit-html' },
      { separator: true, icon: '', label: '', action: '' },
      { icon: '⬆', label: 'Move up', action: 'move-up' },
      { icon: '⬇', label: 'Move down', action: 'move-down' },
      { separator: true, icon: '', label: '', action: '' },
      { icon: '📋', label: 'Copy Element', action: 'copy', shortcut: '⌘+C' },
      { icon: '🔗', label: 'Copy Selector Path', action: 'copy-selector', shortcut: '⌘+Shift+C' },
      { separator: true, icon: '', label: '', action: '' },
      { icon: '🎯', label: 'Select Relative Elements', action: 'select-relative' },
      { separator: true, icon: '', label: '', action: '' },
      { icon: '➕', label: 'Insert new block', action: 'insert-block' },
      { separator: true, icon: '', label: '', action: '' },
      { icon: '👁', label: 'Hide Element', action: 'hide' },
      { icon: '🗑', label: 'Delete Element', action: 'delete', shortcut: 'Delete' },
    ]
    
    let menuHTML = ''
    menuItems.forEach(item => {
      if (item.separator) {
        menuHTML += '<div class="absmartly-menu-separator"></div>'
      } else {
        menuHTML += `
          <div class="absmartly-menu-item" data-action="${item.action}">
            <span style="width: 20px; display: inline-block;">${item.icon}</span>
            <span style="flex: 1;">${item.label}</span>
            ${item.shortcut ? `<span style="color: #9ca3af; font-size: 12px; margin-left: auto;">${item.shortcut}</span>` : ''}
          </div>
        `
      }
    })
    this.contextMenu.innerHTML = menuHTML
    
    // Position the menu
    this.contextMenu.style.cssText = `
      position: fixed !important;
      left: ${Math.min(x, window.innerWidth - 220)}px !important;
      top: ${Math.min(y, window.innerHeight - 400)}px !important;
      z-index: 2147483647 !important;
      pointer-events: auto !important;
    `
    
    // Add the menu to the overlay
    overlay.appendChild(this.contextMenu)
    document.body.appendChild(overlay)
    
    // Handle clicks on the overlay (outside menu)
    overlay.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      
      // If clicking on menu item
      const menuItem = target.closest('.absmartly-menu-item') as HTMLElement
      if (menuItem) {
        e.preventDefault()
        e.stopPropagation()
        const action = menuItem.getAttribute('data-action')
        if (action) {
          this.handleMenuAction(action)
        }
        return
      }
      
      // If clicking outside menu (on overlay), close it
      if (target === overlay) {
        this.removeContextMenu()
      }
    }, true)
    
    // Prevent all propagation from overlay
    overlay.addEventListener('mousedown', (e) => {
      e.stopPropagation()
    }, true)
    
    overlay.addEventListener('mouseup', (e) => {
      e.stopPropagation()
    }, true)
  }
  
  private removeContextMenu() {
    // Remove the overlay which includes the menu
    document.getElementById('absmartly-menu-overlay')?.remove()
    document.getElementById('absmartly-menu-container')?.remove()
    this.contextMenu = null
  }
  
  private handleMenuAction(action: string) {
    if (!this.selectedElement && action !== 'insert-block') return
    
    switch (action) {
      case 'edit-element':
        this.startElementEditing()
        break
      case 'edit-html':
        this.startHTMLEditing()
        break
      case 'move-up':
        this.moveElement('up')
        break
      case 'move-down':
        this.moveElement('down')
        break
      case 'copy':
        this.copyElement()
        break
      case 'copy-selector':
        this.copySelectorPath()
        break
      case 'select-relative':
        this.showRelativeElementSelector()
        break
      case 'insert-block':
        this.insertNewBlock()
        break
      case 'hide':
        this.hideElement()
        break
      case 'delete':
        this.deleteElement()
        break
    }
    
    this.removeContextMenu()
  }
  
  private copySelectorPath() {
    if (!this.selectedElement) return
    
    const selector = this.generateSelector(this.selectedElement)
    
    // Copy to clipboard
    navigator.clipboard.writeText(selector).then(() => {
      // Show a notification that the selector has been copied
      const notification = document.createElement('div')
      notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        z-index: 2147483647;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        animation: slideInRight 0.3s ease-out;
      `
      notification.textContent = `✅ Selector copied: ${selector}`
      
      // Add animation styles
      const style = document.createElement('style')
      style.textContent = `
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `
      document.head.appendChild(style)
      document.body.appendChild(notification)
      
      // Remove notification after 3 seconds
      setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out'
        notification.style.animationFillMode = 'forwards'
        
        // Add slide out animation
        const slideOutStyle = document.createElement('style')
        slideOutStyle.textContent = `
          @keyframes slideOutRight {
            from {
              transform: translateX(0);
              opacity: 1;
            }
            to {
              transform: translateX(100%);
              opacity: 0;
            }
          }
        `
        document.head.appendChild(slideOutStyle)
        
        setTimeout(() => {
          notification.remove()
          style.remove()
          slideOutStyle.remove()
        }, 300)
      }, 3000)
    }).catch(err => {
      console.error('Failed to copy selector:', err)
    })
  }
  
  private insertNewBlock() {
    if (!this.selectedElement) return
    
    // Create insert dialog
    const dialog = document.createElement('div')
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border: 2px solid #3b82f6;
      border-radius: 8px;
      padding: 20px;
      z-index: 2147483647;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      width: 500px;
      max-width: 90%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `
    
    // Add backdrop
    const backdrop = document.createElement('div')
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 2147483646;
    `
    document.body.appendChild(backdrop)
    
    dialog.innerHTML = `
      <h3 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #1f2937;">Insert New Block</h3>
      
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #4b5563;">Position:</label>
        <select id="insert-position" style="width: 100%; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 14px;">
          <option value="before">Before selected element</option>
          <option value="after">After selected element</option>
          <option value="prepend">As first child</option>
          <option value="append">As last child</option>
        </select>
      </div>
      
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #4b5563;">Element Type:</label>
        <select id="element-type" style="width: 100%; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 14px;">
          <option value="div">Div</option>
          <option value="section">Section</option>
          <option value="article">Article</option>
          <option value="header">Header</option>
          <option value="footer">Footer</option>
          <option value="nav">Navigation</option>
          <option value="button">Button</option>
          <option value="a">Link</option>
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="img">Image</option>
          <option value="ul">Unordered List</option>
          <option value="ol">Ordered List</option>
          <option value="custom">Custom HTML</option>
        </select>
      </div>
      
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #4b5563;">Content/HTML:</label>
        <textarea id="element-content" style="width: 100%; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 14px; min-height: 100px; font-family: monospace;" placeholder="Enter text content or HTML">New Block</textarea>
      </div>
      
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #4b5563;">CSS Classes:</label>
        <input id="element-classes" type="text" style="width: 100%; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 14px;" placeholder="e.g., my-class another-class">
      </div>
      
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #4b5563;">ID (optional):</label>
        <input id="element-id" type="text" style="width: 100%; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 14px;" placeholder="e.g., my-element-id">
      </div>
      
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button id="cancel-insert" style="padding: 8px 16px; background: #f3f4f6; color: #1f2937; border: none; border-radius: 6px; font-size: 14px; cursor: pointer;">Cancel</button>
        <button id="apply-insert" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer;">Insert</button>
      </div>
    `
    
    document.body.appendChild(dialog)
    
    // Handle element type change
    const elementType = dialog.querySelector('#element-type') as HTMLSelectElement
    const contentArea = dialog.querySelector('#element-content') as HTMLTextAreaElement
    
    elementType.addEventListener('change', () => {
      if (elementType.value === 'custom') {
        contentArea.placeholder = 'Enter complete HTML (e.g., <div class="my-div">Content</div>)'
        contentArea.style.minHeight = '150px'
      } else {
        contentArea.placeholder = 'Enter text content'
        contentArea.style.minHeight = '100px'
        
        // Set default content based on element type
        const defaults: { [key: string]: string } = {
          button: 'Click Me',
          a: 'Link Text',
          p: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
          h1: 'Main Heading',
          h2: 'Section Heading',
          h3: 'Subsection Heading',
          img: '',
          div: '',
          section: '',
          article: '',
          header: '',
          footer: '',
          nav: '',
          ul: '<li>Item 1</li>\n<li>Item 2</li>\n<li>Item 3</li>',
          ol: '<li>First item</li>\n<li>Second item</li>\n<li>Third item</li>'
        }
        contentArea.value = defaults[elementType.value] || 'New Block'
      }
    })
    
    // Handle cancel
    dialog.querySelector('#cancel-insert')?.addEventListener('click', () => {
      dialog.remove()
      backdrop.remove()
    })
    
    // Handle apply
    dialog.querySelector('#apply-insert')?.addEventListener('click', () => {
      const position = (dialog.querySelector('#insert-position') as HTMLSelectElement).value
      const type = elementType.value
      const content = contentArea.value
      const classes = (dialog.querySelector('#element-classes') as HTMLInputElement).value
      const id = (dialog.querySelector('#element-id') as HTMLInputElement).value
      
      let newElement: HTMLElement
      
      if (type === 'custom') {
        // Parse custom HTML
        const temp = document.createElement('div')
        temp.innerHTML = content
        newElement = temp.firstElementChild as HTMLElement || document.createElement('div')
      } else if (type === 'img') {
        newElement = document.createElement('img')
        if (content) {
          newElement.setAttribute('src', content)
          newElement.setAttribute('alt', 'New Image')
        } else {
          newElement.setAttribute('src', 'https://via.placeholder.com/300x200')
          newElement.setAttribute('alt', 'Placeholder Image')
        }
      } else {
        newElement = document.createElement(type)
        if (type === 'a') {
          newElement.setAttribute('href', '#')
        }
        if (type === 'ul' || type === 'ol') {
          newElement.innerHTML = content
        } else if (content) {
          newElement.textContent = content
        }
      }
      
      // Apply classes and ID
      if (classes) {
        newElement.className = classes
      }
      if (id) {
        newElement.id = id
      }
      
      // Insert the element
      switch (position) {
        case 'before':
          this.selectedElement!.parentNode?.insertBefore(newElement, this.selectedElement!)
          break
        case 'after':
          this.selectedElement!.parentNode?.insertBefore(newElement, this.selectedElement!.nextSibling)
          break
        case 'prepend':
          this.selectedElement!.insertBefore(newElement, this.selectedElement!.firstChild)
          break
        case 'append':
          this.selectedElement!.appendChild(newElement)
          break
      }
      
      // Track the change
      this.trackChange({
        type: 'insert',
        selector: this.generateSelector(this.selectedElement!),
        position: position,
        html: newElement.outerHTML
      })
      
      // Clean up
      dialog.remove()
      backdrop.remove()
      
      // Select the new element
      this.selectElement(newElement)
    })
    
    // Close on backdrop click
    backdrop.addEventListener('click', () => {
      dialog.remove()
      backdrop.remove()
    })
  }
  
  private startTextEditing() {
    if (!this.selectedElement) return
    
    // Store original value
    if (!this.originalValues.has(this.selectedElement)) {
      this.originalValues.set(this.selectedElement, {
        text: this.selectedElement.textContent
      })
    }
    
    this.selectedElement.contentEditable = 'true'
    this.selectedElement.classList.add('absmartly-editing')
    this.selectedElement.focus()
    
    // Select all text
    const range = document.createRange()
    range.selectNodeContents(this.selectedElement)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    
    // Handle when editing ends
    const handleBlur = () => {
      if (!this.selectedElement) return
      
      this.selectedElement.contentEditable = 'false'
      this.selectedElement.classList.remove('absmartly-editing')
      
      // Track the change
      const newText = this.selectedElement.textContent || ''
      const original = this.originalValues.get(this.selectedElement)
      
      if (original && original.text !== newText) {
        this.addChange({
          selector: this.getSelector(this.selectedElement),
          type: 'text',
          value: newText,
          enabled: true
        })
      }
      
      this.selectedElement.removeEventListener('blur', handleBlur)
    }
    
    this.selectedElement.addEventListener('blur', handleBlur)
  }
  
  private startHTMLEditing() {
    if (!this.selectedElement) return
    
    const originalHTML = this.selectedElement.innerHTML
    const editDialog = document.createElement('div')
    editDialog.className = 'absmartly-html-editor'
    editDialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border: 2px solid #3b82f6;
      border-radius: 8px;
      padding: 20px;
      z-index: 2147483647;
      box-shadow: 0 20px 50px rgba(0,0,0,0.2);
      width: 600px;
      max-width: 90vw;
    `
    
    editDialog.innerHTML = `
      <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600;">Edit HTML</h3>
      <textarea style="width: 100%; height: 300px; font-family: monospace; font-size: 13px; padding: 10px; border: 1px solid #e5e7eb; border-radius: 4px;">${originalHTML.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
      <div style="margin-top: 10px; display: flex; gap: 10px; justify-content: flex-end;">
        <button class="absmartly-cancel-btn" style="padding: 8px 16px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; cursor: pointer;">Cancel</button>
        <button class="absmartly-save-btn" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">Save</button>
      </div>
    `
    
    document.body.appendChild(editDialog)
    
    const textarea = editDialog.querySelector('textarea') as HTMLTextAreaElement
    const saveBtn = editDialog.querySelector('.absmartly-save-btn') as HTMLButtonElement
    const cancelBtn = editDialog.querySelector('.absmartly-cancel-btn') as HTMLButtonElement
    
    textarea.focus()
    
    saveBtn.addEventListener('click', () => {
      const newHTML = textarea.value
      if (this.selectedElement && newHTML !== originalHTML) {
        this.selectedElement.innerHTML = newHTML
        this.addChange({
          selector: this.getSelector(this.selectedElement),
          type: 'html',
          value: newHTML,
          enabled: true
        })
      }
      editDialog.remove()
    })
    
    cancelBtn.addEventListener('click', () => {
      editDialog.remove()
    })
  }
  
  private duplicateElement() {
    if (!this.selectedElement) return
    
    const clone = this.selectedElement.cloneNode(true) as HTMLElement
    // Remove any absmartly classes from the clone
    clone.classList.remove('absmartly-selected', 'absmartly-editable', 'absmartly-editing')
    
    this.selectedElement.parentElement?.insertBefore(clone, this.selectedElement.nextSibling)
    
    this.addChange({
      selector: this.getSelector(this.selectedElement),
      type: 'duplicate',
      value: true,
      enabled: true
    })
    
    this.showNotification('Element Duplicated', 'Element has been successfully duplicated')
  }
  
  private copyElementStyle() {
    if (!this.selectedElement) return
    
    const computed = window.getComputedStyle(this.selectedElement)
    const styles = {
      backgroundColor: computed.backgroundColor,
      color: computed.color,
      fontSize: computed.fontSize,
      fontFamily: computed.fontFamily,
      fontWeight: computed.fontWeight,
      padding: computed.padding,
      margin: computed.margin,
      border: computed.border,
      borderRadius: computed.borderRadius,
      boxShadow: computed.boxShadow
    }
    
    // Store in clipboard or internal storage for later paste
    localStorage.setItem('absmartly-copied-styles', JSON.stringify(styles))
    
    this.showNotification('Style Copied', 'Element styles have been copied to clipboard')
  }
  

  

  

  
  private moveElement(direction: 'up' | 'down') {
    if (!this.selectedElement) return
    
    const parent = this.selectedElement.parentElement
    if (!parent) return
    
    if (direction === 'up' && this.selectedElement.previousElementSibling) {
      parent.insertBefore(this.selectedElement, this.selectedElement.previousElementSibling)
      this.addChange({
        selector: this.getSelector(this.selectedElement),
        type: 'move',
        targetSelector: this.getSelector(this.selectedElement.nextElementSibling as HTMLElement),
        position: 'before',
        enabled: true
      })
    } else if (direction === 'down' && this.selectedElement.nextElementSibling) {
      parent.insertBefore(this.selectedElement.nextElementSibling, this.selectedElement)
      this.addChange({
        selector: this.getSelector(this.selectedElement),
        type: 'move',
        targetSelector: this.getSelector(this.selectedElement.previousElementSibling as HTMLElement),
        position: 'after',
        enabled: true
      })
    }
  }
  

  
  private hideElement() {
    if (!this.selectedElement) return
    
    this.selectedElement.style.display = 'none'
    this.addChange({
      selector: this.getSelector(this.selectedElement),
      type: 'style',
      value: { display: 'none' },
      enabled: true
    })
    this.deselectElement()
  }
  
  private deleteElement() {
    if (!this.selectedElement) return
    
    const selector = this.getSelector(this.selectedElement)
    this.selectedElement.remove()
    
    // TODO: Track deletion properly
    this.addChange({
      selector: selector,
      type: 'style',
      value: { display: 'none' },
      enabled: true
    })
    
    this.deselectElement()
  }
  
  private startMutationObserver() {
    this.mutationObserver = new MutationObserver((mutations) => {
      if (this.isInternalChange) return
      
      // TODO: Track external changes
    })
    
    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      characterData: true,
      characterDataOldValue: true
    })
  }
  
  private stopMutationObserver() {
    this.mutationObserver?.disconnect()
    this.mutationObserver = null
  }
  
  private makeElementsEditable() {
    document.querySelectorAll('*').forEach(el => {
      const element = el as HTMLElement
      if (!this.isExtensionElement(element)) {
        element.classList.add('absmartly-editable')
      }
    })
  }
  
  private makeElementsNonEditable() {
    document.querySelectorAll('.absmartly-editable').forEach(el => {
      el.classList.remove('absmartly-editable')
      el.classList.remove('absmartly-selected')
      el.classList.remove('absmartly-editing')
    })
  }
  
  private addChange(change: DOMChange) {
    // Check if we already have a change for this selector and type
    const existingIndex = this.changes.findIndex(c => 
      c.selector === change.selector && c.type === change.type
    )
    
    if (existingIndex >= 0) {
      // Update existing change
      if (change.type === 'style' && this.changes[existingIndex].type === 'style') {
        // Merge style values
        this.changes[existingIndex].value = {
          ...this.changes[existingIndex].value,
          ...change.value
        }
      } else {
        this.changes[existingIndex] = change
      }
    } else {
      // Add new change
      this.changes.push(change)
    }
    
    this.updateToolbar()
    this.options.onChangesUpdate(this.changes)
  }
  
  private undoLastChange() {
    if (this.changes.length === 0) return
    
    this.changes.pop()
    this.updateToolbar()
    this.options.onChangesUpdate(this.changes)
    
    // TODO: Actually revert the visual change
    this.showNotification('Undo', 'Last change has been undone')
  }
  
  private clearAllChanges() {
    if (confirm('Are you sure you want to clear all changes?')) {
      this.changes = []
      this.updateToolbar()
      this.options.onChangesUpdate(this.changes)
      
      // TODO: Revert all visual changes
      this.showNotification('Cleared', 'All changes have been cleared')
    }
  }
  
  private saveChanges() {
    this.options.onChangesUpdate(this.changes)
    this.showNotification('Saved', `${this.changes.length} changes saved`)
  }
  
  private showNotification(title: string, message: string) {
    const notification = document.createElement('div')
    notification.className = 'absmartly-notification'
    notification.innerHTML = `<strong>${title}</strong> · ${message}`
    document.body.appendChild(notification)
    
    setTimeout(() => {
      notification.remove()
    }, 3000)
  }
  
  private getSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id}`
    }
    
    const path: string[] = []
    let current: HTMLElement | null = element
    
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase()
      
      const className = typeof current.className === 'string' 
        ? current.className 
        : current.className?.baseVal || ''
      
      if (className) {
        const classes = className.split(' ').filter(c => 
          c && !c.includes('absmartly')
        )
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
    // Check if element or any parent has our extension identifiers
    let current: HTMLElement | null = element
    while (current) {
      const id = current.id || ''
      const className = typeof current.className === 'string' 
        ? current.className 
        : current.className?.baseVal || ''
      
      if (id.includes('absmartly') || className.includes('absmartly')) {
        return true
      }
      
      current = current.parentElement
    }
    
    return false
  }
  
  
  private trackChange(element: HTMLElement, type: string) {
    const selector = this.getSelector(element)
    const existingIndex = this.changes.findIndex(c => c.selector === selector)
    
    const change: DOMChange = {
      selector,
      type: type as any,
      value: this.getElementValue(element, type),
      timestamp: Date.now()
    }
    
    if (existingIndex >= 0) {
      this.changes[existingIndex] = change
    } else {
      this.changes.push(change)
    }
    
    this.updateToolbar()
    this.options.onChangesUpdate(this.changes)
  }
  
  private getElementValue(element: HTMLElement, type: string): any {
    switch (type) {
      case 'text':
      case 'modify':
        return element.textContent
      case 'style':
        return {
          background: element.style.backgroundColor || window.getComputedStyle(element).backgroundColor,
          color: element.style.color || window.getComputedStyle(element).color,
          fontSize: element.style.fontSize || window.getComputedStyle(element).fontSize,
          display: element.style.display || window.getComputedStyle(element).display
        }
      case 'hide':
        return { display: 'none' }
      case 'delete':
        return null
      default:
        return element.outerHTML
    }
  }
  
  private startElementEditing() {
    if (!this.selectedElement) return
    
    // Show a comprehensive edit dialog with all properties
    const editDialog = document.createElement('div')
    editDialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border: 2px solid #3b82f6;
      border-radius: 8px;
      padding: 20px;
      z-index: 2147483648;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      max-width: 500px;
      width: 90%;
    `
    
    editDialog.innerHTML = `
      <h3 style="margin: 0 0 15px 0; color: #1f2937;">Edit Element</h3>
      <div style="margin-bottom: 10px;">
        <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #6b7280;">Text Content</label>
        <input type="text" id="edit-text" value="${this.selectedElement.textContent || ''}" style="width: 100%; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px;">
      </div>
      <div style="margin-bottom: 10px;">
        <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #6b7280;">Background Color</label>
        <input type="color" id="edit-bg-color" value="${this.rgbToHex(window.getComputedStyle(this.selectedElement).backgroundColor)}" style="width: 100%; height: 35px; border: 1px solid #e5e7eb; border-radius: 4px;">
      </div>
      <div style="margin-bottom: 10px;">
        <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #6b7280;">Text Color</label>
        <input type="color" id="edit-text-color" value="${this.rgbToHex(window.getComputedStyle(this.selectedElement).color)}" style="width: 100%; height: 35px; border: 1px solid #e5e7eb; border-radius: 4px;">
      </div>
      <div style="margin-bottom: 10px;">
        <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #6b7280;">Font Size</label>
        <input type="text" id="edit-font-size" value="${window.getComputedStyle(this.selectedElement).fontSize}" style="width: 100%; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px;">
      </div>
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button id="edit-apply" style="flex: 1; padding: 8px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">Apply</button>
        <button id="edit-cancel" style="flex: 1; padding: 8px; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
      </div>
    `
    
    document.body.appendChild(editDialog)
    
    const element = this.selectedElement
    document.getElementById('edit-apply')?.addEventListener('click', () => {
      if (element) {
        const textInput = document.getElementById('edit-text') as HTMLInputElement
        const bgColorInput = document.getElementById('edit-bg-color') as HTMLInputElement
        const textColorInput = document.getElementById('edit-text-color') as HTMLInputElement
        const fontSizeInput = document.getElementById('edit-font-size') as HTMLInputElement
        
        if (textInput.value !== element.textContent) {
          this.addChange({
            selector: this.getSelector(element),
            type: 'text',
            value: textInput.value,
            enabled: true
          })
          element.textContent = textInput.value
        }
        
        const styleChanges: Record<string, string> = {}
        if (bgColorInput.value) styleChanges['background-color'] = bgColorInput.value
        if (textColorInput.value) styleChanges['color'] = textColorInput.value
        if (fontSizeInput.value) styleChanges['font-size'] = fontSizeInput.value
        
        if (Object.keys(styleChanges).length > 0) {
          this.addChange({
            selector: this.getSelector(element),
            type: 'style',
            value: styleChanges,
            enabled: true
          })
          Object.assign(element.style, styleChanges)
        }
      }
      editDialog.remove()
    })
    
    document.getElementById('edit-cancel')?.addEventListener('click', () => {
      editDialog.remove()
    })
  }
  
  private startRearrangeMode() {
    if (!this.selectedElement) return
    this.showNotification('Rearrange Mode', 'Use arrow keys to move element, ESC to exit')
    // Implementation for drag and drop rearrange
  }
  
  private startInlineEditing() {
    if (!this.selectedElement) return
    this.startTextEditing()
  }
  
  private startMoveResizeMode() {
    if (!this.selectedElement) return
    this.showNotification('Move/Resize Mode', 'Drag to move, drag corners to resize')
    // Implementation for move and resize
  }
  
  private showRelativeElementSelector() {
    if (!this.selectedElement) return
    
    // Highlight parent, siblings, and children
    const parent = this.selectedElement.parentElement
    const siblings = parent ? Array.from(parent.children) : []
    const children = Array.from(this.selectedElement.children)
    
    this.showNotification('Select Relative', 'Click on highlighted parent, sibling, or child element')
    
    // Add highlighting to relatives
    if (parent) parent.style.outline = '2px dashed #10b981'
    siblings.forEach(sib => {
      if (sib !== this.selectedElement) {
        (sib as HTMLElement).style.outline = '2px dashed #f59e0b'
      }
    })
    children.forEach(child => {
      (child as HTMLElement).style.outline = '2px dashed #8b5cf6'
    })
    
    // Remove highlighting after 3 seconds
    setTimeout(() => {
      if (parent) parent.style.outline = ''
      siblings.forEach(sib => (sib as HTMLElement).style.outline = '')
      children.forEach(child => (child as HTMLElement).style.outline = '')
    }, 3000)
  }
  
  private copyElement() {
    if (!this.selectedElement) return
    
    // Store element HTML in clipboard
    const html = this.selectedElement.outerHTML
    navigator.clipboard.writeText(html).then(() => {
      this.showNotification('Copied!', 'Element HTML copied to clipboard')
    })
  }
  
  private saveToLibrary() {
    if (!this.selectedElement) return
    this.showNotification('Save to Library', 'Feature coming soon!')
    // Implementation for saving to library
  }
  
  private applySavedModification() {
    this.showNotification('Apply Saved', 'Feature coming soon!')
    // Implementation for applying saved modifications
  }
  
  private trackClicks() {
    if (!this.selectedElement) return
    this.showNotification('Track Clicks', 'Click tracking enabled for this element')
    // Implementation for click tracking
  }
  
  private suggestVariations() {
    if (!this.selectedElement) return
    this.showNotification('AI Suggestions', 'Generating variation suggestions...')
    // Implementation for AI-powered suggestions
  }
  
  private rgbToHex(rgb: string): string {
    // Convert rgb(r, g, b) to #rrggbb
    const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)
    if (!match) return '#000000'
    
    const r = parseInt(match[1]).toString(16).padStart(2, '0')
    const g = parseInt(match[2]).toString(16).padStart(2, '0')
    const b = parseInt(match[3]).toString(16).padStart(2, '0')
    
    return `#${r}${g}${b}`
  }
}