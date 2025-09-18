/**
 * Styles Manager
 * Handles injection and management of CSS styles for the visual editor
 */

export class Styles {
  private injectedStyles = new Set<string>()

  /**
   * Inject core visual editor styles
   */
  injectCoreStyles(): void {
    if (this.injectedStyles.has('core')) return

    const style = document.createElement('style')
    style.id = 'absmartly-visual-editor-core-styles'
    style.dataset.absmartly = 'true'
    style.textContent = `
      /* Core element states */
      .absmartly-hover {
        outline: 2px solid #3b82f6 !important;
        outline-offset: 2px !important;
      }

      .absmartly-selected {
        outline: 3px solid #10b981 !important;
        outline-offset: 2px !important;
      }

      .absmartly-editing {
        outline: 3px solid #f59e0b !important;
        outline-offset: 2px !important;
        background: rgba(245, 158, 11, 0.1) !important;
      }

      /* Editable elements */
      .absmartly-editable {
        outline: 2px dashed transparent !important;
        transition: outline 0.2s !important;
        cursor: pointer !important;
      }

      .absmartly-editable:hover {
        outline-color: #3b82f6 !important;
      }

      /* Drag and drop states */
      .absmartly-draggable {
        cursor: move !important;
        opacity: 0.8 !important;
      }

      .absmartly-dragging {
        opacity: 0.5 !important;
      }

      .absmartly-drop-target {
        outline: 2px dashed #10b981 !important;
        outline-offset: 4px !important;
        background: rgba(16, 185, 129, 0.1) !important;
      }

      /* Resize mode */
      .absmartly-resize-active {
        outline: 3px solid #8b5cf6 !important;
        outline-offset: 2px !important;
      }

      /* Hover tooltip */
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
    `
    document.head.appendChild(style)
    this.injectedStyles.add('core')
  }

  /**
   * Inject context menu styles
   */
  injectContextMenuStyles(): void {
    if (this.injectedStyles.has('context-menu')) return

    const style = document.createElement('style')
    style.id = 'absmartly-visual-editor-context-menu-styles'
    style.dataset.absmartly = 'true'
    style.textContent = `
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
    `
    document.head.appendChild(style)
    this.injectedStyles.add('context-menu')
  }

  /**
   * Inject toolbar styles
   */
  injectToolbarStyles(): void {
    if (this.injectedStyles.has('toolbar')) return

    const style = document.createElement('style')
    style.id = 'absmartly-visual-editor-toolbar-styles'
    style.dataset.absmartly = 'true'
    style.textContent = `
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

      .absmartly-toolbar-button:disabled {
        opacity: 0.5 !important;
        cursor: not-allowed !important;
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

      .absmartly-toolbar-button.danger:hover {
        background: #dc2626 !important;
      }
    `
    document.head.appendChild(style)
    this.injectedStyles.add('toolbar')
  }

  /**
   * Inject notification styles
   */
  injectNotificationStyles(): void {
    if (this.injectedStyles.has('notifications')) return

    const style = document.createElement('style')
    style.id = 'absmartly-visual-editor-notification-styles'
    style.dataset.absmartly = 'true'
    style.textContent = `
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
        z-index: 2147483647 !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        font-size: 14px !important;
        animation: absmartly-slideUp 0.3s ease-out !important;
        max-width: 400px !important;
        text-align: center !important;
      }

      @keyframes absmartly-slideUp {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }

      @keyframes absmartly-slideDown {
        from {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
        to {
          opacity: 0;
          transform: translateX(-50%) translateY(20px);
        }
      }
    `
    document.head.appendChild(style)
    this.injectedStyles.add('notifications')
  }

  /**
   * Inject dialog styles
   */
  injectDialogStyles(): void {
    if (this.injectedStyles.has('dialogs')) return

    const style = document.createElement('style')
    style.id = 'absmartly-visual-editor-dialog-styles'
    style.dataset.absmartly = 'true'
    style.textContent = `
      .absmartly-dialog-backdrop {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background: rgba(0, 0, 0, 0.5) !important;
        z-index: 2147483646 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        pointer-events: auto !important;
      }

      .absmartly-dialog {
        background: white !important;
        border-radius: 8px !important;
        box-shadow: 0 20px 50px rgba(0,0,0,0.2) !important;
        padding: 20px !important;
        max-width: 90vw !important;
        max-height: 90vh !important;
        overflow: auto !important;
        font-family: system-ui, -apple-system, sans-serif !important;
      }

      .absmartly-dialog h3 {
        margin: 0 0 15px 0 !important;
        font-size: 18px !important;
        font-weight: 600 !important;
        color: #111827 !important;
      }

      .absmartly-dialog-buttons {
        margin-top: 15px !important;
        display: flex !important;
        justify-content: flex-end !important;
        gap: 10px !important;
      }

      .absmartly-dialog-button {
        padding: 8px 16px !important;
        border-radius: 4px !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        cursor: pointer !important;
        transition: all 0.15s !important;
      }

      .absmartly-dialog-button-cancel {
        border: 1px solid #ddd !important;
        background: white !important;
        color: #374151 !important;
      }

      .absmartly-dialog-button-cancel:hover {
        background: #f9fafb !important;
      }

      .absmartly-dialog-button-primary {
        border: none !important;
        background: #3b82f6 !important;
        color: white !important;
      }

      .absmartly-dialog-button-primary:hover {
        background: #2563eb !important;
      }
    `
    document.head.appendChild(style)
    this.injectedStyles.add('dialogs')
  }

  /**
   * Inject all styles at once
   */
  injectAllStyles(): void {
    this.injectCoreStyles()
    this.injectContextMenuStyles()
    this.injectToolbarStyles()
    this.injectNotificationStyles()
    this.injectDialogStyles()
  }

  /**
   * Remove all injected styles
   */
  removeAllStyles(): void {
    document.querySelectorAll('style[data-absmartly="true"]').forEach(style => {
      style.remove()
    })
    this.injectedStyles.clear()
  }

  /**
   * Remove specific style set
   */
  removeStyles(type: string): void {
    const style = document.getElementById(`absmartly-visual-editor-${type}-styles`)
    if (style) {
      style.remove()
      this.injectedStyles.delete(type)
    }
  }
}