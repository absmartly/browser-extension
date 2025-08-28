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
  private changes: DOMChange[] = []
  private originalValues = new Map<HTMLElement, any>()
  private options: VisualEditorOptions
  private mutationObserver: MutationObserver | null = null
  private isInternalChange = false
  
  constructor(options: VisualEditorOptions) {
    this.options = options
    this.changes = options.initialChanges || []
  }
  
  start() {
    if (this.isActive) return
    
    this.isActive = true
    this.injectStyles()
    this.createToolbar()
    this.setupEventListeners()
    this.startMutationObserver()
    this.makeElementsEditable()
    
    // Show notification
    this.showNotification('Visual Editor Active', 'Click on any element to edit')
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
        z-index: 999999 !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        font-size: 14px !important;
        min-width: 200px !important;
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
        border: 1px solid #e5e7eb !important;
        border-radius: 12px !important;
        padding: 12px !important;
        box-shadow: 0 10px 25px rgba(0,0,0,0.1) !important;
        z-index: 999998 !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        font-size: 14px !important;
        max-width: 250px !important;
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
    document.addEventListener('click', this.handleElementClick, true)
    document.addEventListener('contextmenu', this.handleContextMenu, true)
    document.addEventListener('keydown', this.handleKeyDown, true)
  }
  
  private removeEventListeners() {
    document.removeEventListener('click', this.handleElementClick, true)
    document.removeEventListener('contextmenu', this.handleContextMenu, true)
    document.removeEventListener('keydown', this.handleKeyDown, true)
  }
  
  private handleElementClick = (e: MouseEvent) => {
    if (!this.isActive) return
    
    const target = e.target as HTMLElement
    
    // Ignore clicks on our own UI elements
    if (this.isExtensionElement(target)) return
    
    // If clicking outside context menu, close it
    if (this.contextMenu && !this.contextMenu.contains(target)) {
      this.removeContextMenu()
    }
    
    // Don't select during certain operations
    if (target.contentEditable === 'true') return
    
    e.preventDefault()
    e.stopPropagation()
    
    this.selectElement(target)
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
    
    this.contextMenu = document.createElement('div')
    this.contextMenu.className = 'absmartly-context-menu'
    
    // Create menu items based on element type
    const menuItems: Array<{ icon: string, label: string, action: string, separator?: boolean }> = [
      { icon: '✏️', label: 'Edit Text', action: 'edit-text' },
      { icon: '🎨', label: 'Change Background Color', action: 'bg-color' },
      { icon: '🔤', label: 'Change Text Color', action: 'text-color' },
      { icon: '📐', label: 'Change Size', action: 'size' },
      { separator: true, icon: '', label: '', action: '' },
      { icon: '⬆️', label: 'Move Up', action: 'move-up' },
      { icon: '⬇️', label: 'Move Down', action: 'move-down' },
      { icon: '🔄', label: 'Drag to Reorder', action: 'drag-drop' },
      { separator: true, icon: '', label: '', action: '' },
      { icon: '📋', label: 'Copy Element', action: 'copy' },
      { icon: '👁️', label: 'Hide Element', action: 'hide' },
      { icon: '🗑️', label: 'Delete Element', action: 'delete' },
    ]
    
    menuItems.forEach(item => {
      if (item.separator) {
        const separator = document.createElement('div')
        separator.className = 'absmartly-menu-separator'
        this.contextMenu!.appendChild(separator)
      } else {
        const menuItem = document.createElement('div')
        menuItem.className = 'absmartly-menu-item'
        menuItem.innerHTML = `<span>${item.icon}</span><span>${item.label}</span>`
        menuItem.setAttribute('data-action', item.action)
        menuItem.addEventListener('click', () => this.handleMenuAction(item.action))
        this.contextMenu!.appendChild(menuItem)
      }
    })
    
    // Position the menu
    this.contextMenu.style.left = `${Math.min(x, window.innerWidth - 220)}px`
    this.contextMenu.style.top = `${Math.min(y, window.innerHeight - 400)}px`
    
    document.body.appendChild(this.contextMenu)
  }
  
  private removeContextMenu() {
    this.contextMenu?.remove()
    this.contextMenu = null
  }
  
  private handleMenuAction(action: string) {
    if (!this.selectedElement) return
    
    switch (action) {
      case 'edit-text':
        this.startTextEditing()
        break
      case 'bg-color':
        this.showColorPicker('background')
        break
      case 'text-color':
        this.showColorPicker('text')
        break
      case 'size':
        this.showSizeEditor()
        break
      case 'move-up':
        this.moveElement('up')
        break
      case 'move-down':
        this.moveElement('down')
        break
      case 'drag-drop':
        this.startDragDrop()
        break
      case 'copy':
        this.copyElement()
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
  
  private showColorPicker(type: 'background' | 'text') {
    if (!this.selectedElement) return
    
    const picker = document.createElement('div')
    picker.className = 'absmartly-color-picker'
    
    // Common colors
    const colors = [
      '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
      '#808080', '#C0C0C0', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080',
      '#FFA500', '#A52A2A', '#8A2BE2', '#5F9EA0', '#D2691E', '#FF7F50', '#6495ED', '#DC143C',
      '#00CED1', '#9400D3', '#FF1493', '#00BFFF', '#1E90FF', '#B22222', '#228B22', '#FFD700'
    ]
    
    const grid = document.createElement('div')
    grid.className = 'absmartly-color-grid'
    
    colors.forEach(color => {
      const swatch = document.createElement('div')
      swatch.className = 'absmartly-color-swatch'
      swatch.style.backgroundColor = color
      swatch.addEventListener('click', () => {
        this.applyColorChange(type, color)
        picker.remove()
      })
      grid.appendChild(swatch)
    })
    
    // Custom color input
    const input = document.createElement('input')
    input.className = 'absmartly-color-input'
    input.type = 'text'
    input.placeholder = '#000000 or rgb(0,0,0)'
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.applyColorChange(type, input.value)
        picker.remove()
      }
    })
    
    picker.appendChild(grid)
    picker.appendChild(input)
    
    // Position near the element
    const rect = this.selectedElement.getBoundingClientRect()
    picker.style.left = `${rect.left}px`
    picker.style.top = `${rect.bottom + 10}px`
    
    document.body.appendChild(picker)
    
    // Close on outside click
    setTimeout(() => {
      const handleOutsideClick = (e: MouseEvent) => {
        if (!picker.contains(e.target as Node)) {
          picker.remove()
          document.removeEventListener('click', handleOutsideClick)
        }
      }
      document.addEventListener('click', handleOutsideClick)
    }, 100)
  }
  
  private applyColorChange(type: 'background' | 'text', color: string) {
    if (!this.selectedElement) return
    
    // Store original value
    if (!this.originalValues.has(this.selectedElement)) {
      const computed = window.getComputedStyle(this.selectedElement)
      this.originalValues.set(this.selectedElement, {
        backgroundColor: computed.backgroundColor,
        color: computed.color
      })
    }
    
    // Apply the change
    if (type === 'background') {
      this.selectedElement.style.backgroundColor = color
      this.addChange({
        selector: this.getSelector(this.selectedElement),
        type: 'style',
        value: { 'background-color': color },
        enabled: true
      })
    } else {
      this.selectedElement.style.color = color
      this.addChange({
        selector: this.getSelector(this.selectedElement),
        type: 'style',
        value: { color: color },
        enabled: true
      })
    }
  }
  
  private showSizeEditor() {
    // TODO: Implement size editor with width/height inputs
    this.showNotification('Size Editor', 'Coming soon...')
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
  
  private startDragDrop() {
    // TODO: Integrate with existing drag-drop picker
    this.showNotification('Drag & Drop', 'Drag the element to its new position')
  }
  
  private copyElement() {
    if (!this.selectedElement) return
    
    const clone = this.selectedElement.cloneNode(true) as HTMLElement
    this.selectedElement.parentElement?.insertBefore(clone, this.selectedElement.nextSibling)
    
    // TODO: Track this change
    this.showNotification('Element Copied', 'Element has been duplicated')
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
    const className = typeof element.className === 'string' 
      ? element.className 
      : element.className?.baseVal || ''
    
    return element.id?.includes('absmartly') || 
           className.includes('absmartly') ||
           element.closest('.absmartly-toolbar') !== null ||
           element.closest('.absmartly-context-menu') !== null ||
           element.closest('.absmartly-notification') !== null ||
           element.closest('.absmartly-color-picker') !== null
  }
}