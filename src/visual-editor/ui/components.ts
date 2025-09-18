/**
 * UI Components for Visual Editor
 * Handles notifications, dialogs, and banner UI
 */

import StateManager from '../core/state-manager'

export class UIComponents {
  private stateManager: StateManager

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager
  }

  createBanner(): void {
    const config = this.stateManager.getConfig()

    // Create visual editor banner with Shadow DOM
    const existingBanner = document.getElementById('absmartly-visual-editor-banner-host')
    if (existingBanner) existingBanner.remove()

    const bannerHost = document.createElement('div')
    bannerHost.id = 'absmartly-visual-editor-banner-host'
    bannerHost.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: auto;
      z-index: 2147483647;
      pointer-events: none;
    `

    const bannerShadow = bannerHost.attachShadow({ mode: 'closed' })

    const bannerStyle = document.createElement('style')
    bannerStyle.textContent = `
      .banner {
        background: linear-gradient(90deg, #3b82f6, #10b981);
        color: white;
        padding: 10px;
        font-family: system-ui, -apple-system, sans-serif;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        pointer-events: auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
      }
      .banner-content {
        flex: 1;
        text-align: center;
      }
      .banner-title {
        font-size: 14px;
        font-weight: 500;
      }
      .banner-subtitle {
        font-size: 12px;
        margin-top: 5px;
        opacity: 0.9;
      }
      .banner-actions {
        display: flex;
        gap: 10px;
        align-items: center;
      }
      .banner-button {
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .banner-button:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.3);
        transform: translateY(-1px);
      }
      .banner-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .banner-button-icon {
        font-size: 14px;
      }
      .changes-counter {
        background: rgba(255, 255, 255, 0.2);
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
      }
    `

    const banner = document.createElement('div')
    banner.className = 'banner'

    // Logo section (left)
    const logoSection = document.createElement('div')
    logoSection.style.cssText = 'display: flex; align-items: center; gap: 10px;'

    const logo = document.createElement('img')
    logo.src = config.logoUrl
    logo.style.cssText = 'width: 24px; height: 24px;'
    logo.alt = 'ABsmartly'

    logoSection.appendChild(logo)

    // Content section (center)
    const content = document.createElement('div')
    content.className = 'banner-content'

    const title = document.createElement('div')
    title.className = 'banner-title'
    title.textContent = `Visual Editor - ${config.experimentName}`

    const subtitle = document.createElement('div')
    subtitle.className = 'banner-subtitle'
    subtitle.textContent = `Variant: ${config.variantName} • Click elements to edit`

    content.appendChild(title)
    content.appendChild(subtitle)

    // Actions section (right)
    const actions = document.createElement('div')
    actions.className = 'banner-actions'

    // Changes counter
    const changesCounter = document.createElement('span')
    changesCounter.className = 'changes-counter'
    changesCounter.textContent = '0 changes'

    // Undo button
    const undoBtn = document.createElement('button')
    undoBtn.className = 'banner-button'
    undoBtn.dataset.action = 'undo'
    undoBtn.title = 'Undo (Ctrl+Z)'
    undoBtn.disabled = true
    undoBtn.innerHTML = '<span class="banner-button-icon">↶</span>Undo'

    // Redo button
    const redoBtn = document.createElement('button')
    redoBtn.className = 'banner-button'
    redoBtn.dataset.action = 'redo'
    redoBtn.title = 'Redo (Ctrl+Y)'
    redoBtn.disabled = true
    redoBtn.innerHTML = '<span class="banner-button-icon">↷</span>Redo'

    // Save button
    const saveBtn = document.createElement('button')
    saveBtn.className = 'banner-button'
    saveBtn.dataset.action = 'save'
    saveBtn.title = 'Save changes'
    saveBtn.innerHTML = '<span class="banner-button-icon">💾</span>Save'

    // Exit button
    const exitBtn = document.createElement('button')
    exitBtn.className = 'banner-button'
    exitBtn.dataset.action = 'exit'
    exitBtn.title = 'Exit visual editor'
    exitBtn.innerHTML = '<span class="banner-button-icon">✕</span>Exit'

    actions.appendChild(changesCounter)
    actions.appendChild(undoBtn)
    actions.appendChild(redoBtn)
    actions.appendChild(saveBtn)
    actions.appendChild(exitBtn)

    // Assemble banner
    banner.appendChild(logoSection)
    banner.appendChild(content)
    banner.appendChild(actions)

    bannerShadow.appendChild(bannerStyle)
    bannerShadow.appendChild(banner)

    document.body.appendChild(bannerHost)

    // Add event listeners for banner actions
    actions.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      const button = target.closest('[data-action]') as HTMLElement
      if (button) {
        const action = button.dataset.action
        this.handleBannerAction(action!)
      }
    })
  }

  showNotification(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    // Remove existing notification
    const existing = document.getElementById('absmartly-notification')
    if (existing) existing.remove()

    const notification = document.createElement('div')
    notification.id = 'absmartly-notification'
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 2147483647;
      max-width: 300px;
      word-wrap: break-word;
      animation: slideIn 0.3s ease-out;
    `

    // Add slide-in animation
    const style = document.createElement('style')
    style.textContent = `
      @keyframes slideIn {
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

    notification.textContent = message
    document.body.appendChild(notification)

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideIn 0.3s ease-out reverse'
        setTimeout(() => {
          notification.remove()
          style.remove()
        }, 300)
      }
    }, 3000)
  }

  createHtmlEditor(element: Element, currentHtml: string): Promise<string | null> {
    return new Promise((resolve) => {
      // Create editor host with Shadow DOM
      const editorHost = document.createElement('div')
      editorHost.id = 'absmartly-html-editor-host'
      editorHost.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        z-index: 2147483648;
        pointer-events: none;
      `

      const editorShadow = editorHost.attachShadow({ mode: 'closed' })

      const editorStyle = document.createElement('style')
      editorStyle.textContent = `
        * {
          box-sizing: border-box;
        }

        .editor-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: auto;
        }

        .editor-container {
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
          padding: 20px;
          width: 80%;
          max-width: 600px;
          pointer-events: auto;
        }

        .editor-title {
          margin: 0 0 15px 0;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        }

        .editor-textarea {
          width: 100%;
          height: 300px;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 12px;
          resize: vertical;
          outline: none;
        }

        .editor-textarea:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .editor-buttons {
          margin-top: 15px;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .editor-button {
          padding: 8px 16px;
          border-radius: 4px;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }

        .editor-button-cancel {
          border: 1px solid #ddd;
          background: white;
          color: #374151;
        }

        .editor-button-cancel:hover {
          background: #f9fafb;
        }

        .editor-button-save {
          border: none;
          background: #3b82f6;
          color: white;
        }

        .editor-button-save:hover {
          background: #2563eb;
        }
      `

      // Create editor elements
      const backdrop = document.createElement('div')
      backdrop.className = 'editor-backdrop'

      const container = document.createElement('div')
      container.className = 'editor-container'

      const title = document.createElement('h3')
      title.className = 'editor-title'
      title.textContent = 'Edit HTML'

      const textarea = document.createElement('textarea')
      textarea.className = 'editor-textarea'
      textarea.value = currentHtml

      const buttons = document.createElement('div')
      buttons.className = 'editor-buttons'

      const cancelBtn = document.createElement('button')
      cancelBtn.className = 'editor-button editor-button-cancel'
      cancelBtn.textContent = 'Cancel'

      const saveBtn = document.createElement('button')
      saveBtn.className = 'editor-button editor-button-save'
      saveBtn.textContent = 'Save'

      buttons.appendChild(cancelBtn)
      buttons.appendChild(saveBtn)
      container.appendChild(title)
      container.appendChild(textarea)
      container.appendChild(buttons)
      backdrop.appendChild(container)

      editorShadow.appendChild(editorStyle)
      editorShadow.appendChild(backdrop)

      document.body.appendChild(editorHost)

      // Handle button clicks
      cancelBtn.addEventListener('click', () => {
        editorHost.remove()
        resolve(null)
      })

      saveBtn.addEventListener('click', () => {
        const newHtml = textarea.value
        editorHost.remove()
        resolve(newHtml)
      })

      // Prevent backdrop clicks from closing (only click outside container)
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          editorHost.remove()
          resolve(null)
        }
      })

      // Focus and select textarea content
      setTimeout(() => {
        textarea.focus()
        textarea.select()
      }, 10)
    })
  }

  // These will be set by the main visual editor
  onUndo: () => void = () => console.log('[ABSmartly] Undo callback not set')
  onRedo: () => void = () => console.log('[ABSmartly] Redo callback not set')

  private handleBannerAction(action: string): void {
    switch (action) {
      case 'undo':
        this.onUndo()
        break

      case 'redo':
        this.onRedo()
        break

      case 'save':
        // This will save all changes
        this.saveChanges()
        break

      case 'exit':
        // This will exit the visual editor
        this.exitVisualEditor()
        break
    }
  }

  private saveChanges(): void {
    const changes = this.stateManager.getState().changes
    // Send changes to extension background
    window.postMessage({
      type: 'ABSMARTLY_VISUAL_EDITOR_SAVE',
      changes,
      experimentName: this.stateManager.getConfig().experimentName,
      variantName: this.stateManager.getConfig().variantName
    }, '*')

    this.showNotification('Changes saved successfully!', 'success')
  }

  private exitVisualEditor(): void {
    // Send exit message to extension background
    window.postMessage({
      type: 'ABSMARTLY_VISUAL_EDITOR_EXIT'
    }, '*')

    // Clean up will be handled by cleanup module
  }

  removeBanner(): void {
    const banner = document.getElementById('absmartly-visual-editor-banner-host')
    if (banner) banner.remove()
  }
}

export default UIComponents