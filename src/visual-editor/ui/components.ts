/**
 * UI Components for Visual Editor
 * Handles notifications, dialogs, and banner UI
 */

import StateManager from '../core/state-manager'
import HtmlEditor from './html-editor'

export class UIComponents {
  private stateManager: StateManager
  private htmlEditor: HtmlEditor
  private bannerShadowRoot: ShadowRoot | null = null

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager
    this.htmlEditor = new HtmlEditor(stateManager)
  }

  createBanner(): void {
    const config = this.stateManager.getConfig()
    const state = this.stateManager.getState()
    // Changes counter shows session changes (undo stack), not total changes
    const sessionChangesCount = state.undoStack?.length || 0
    const canUndo = sessionChangesCount > 0
    const canRedo = state.redoStack?.length > 0

    console.log('[UIComponents] Creating banner with initial state:', {
      sessionChangesCount,
      canUndo,
      canRedo
    })

    // Create visual editor banner with Shadow DOM
    const existingBanner = document.getElementById('absmartly-visual-editor-banner-host')
    if (existingBanner) existingBanner.remove()

    const bannerHost = document.createElement('div')
    bannerHost.id = 'absmartly-visual-editor-banner-host'
    bannerHost.style.cssText = `
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      pointer-events: none;
    `

    // Check query string for shadow DOM override (for testing)
    const urlParams = new URLSearchParams(window.location.search)
    const shadowDOMParam = urlParams.get('use_shadow_dom_for_visual_editor_context_menu')
    const useShadowDOM = shadowDOMParam !== '0'

    let bannerContainer: HTMLElement | ShadowRoot
    if (useShadowDOM) {
      const bannerShadow = bannerHost.attachShadow({ mode: 'closed' })
      // Store reference to shadow root for updates
      this.bannerShadowRoot = bannerShadow
      bannerContainer = bannerShadow
      console.log('🔍 Banner - Using Shadow DOM')
    } else {
      // For testing, append directly without shadow DOM
      // Store reference to banner host for updates
      this.bannerShadowRoot = bannerHost as any
      bannerContainer = bannerHost
      console.log('🔍 Banner - NOT using Shadow DOM (test mode)')
    }

    const bannerStyle = document.createElement('style')
    bannerStyle.textContent = `
      .banner {
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(10px);
        color: white;
        padding: 12px 20px;
        font-family: system-ui, -apple-system, sans-serif;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
        pointer-events: auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        border-radius: 24px;
        min-width: 600px;
        max-width: 90vw;
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
        background: rgba(255, 255, 255, 0.15);
        border: none;
        color: white;
        padding: 8px 16px;
        border-radius: 16px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .banner-button:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.25);
      }
      .banner-button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
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
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
      }
    `

    const banner = document.createElement('div')
    banner.className = 'banner'

    // Left section - Undo/Redo buttons and changes counter
    const leftSection = document.createElement('div')
    leftSection.className = 'banner-actions'
    leftSection.style.cssText = 'display: flex; gap: 10px; align-items: center;'

    // Undo button
    const undoBtn = document.createElement('button')
    undoBtn.className = 'banner-button'
    undoBtn.dataset.action = 'undo'
    undoBtn.title = 'Undo'
    undoBtn.disabled = !canUndo
    undoBtn.innerHTML = '<span class="banner-button-icon">↶</span>Undo'

    // Redo button
    const redoBtn = document.createElement('button')
    redoBtn.className = 'banner-button'
    redoBtn.dataset.action = 'redo'
    redoBtn.title = 'Redo'
    redoBtn.disabled = !canRedo
    redoBtn.innerHTML = '<span class="banner-button-icon">↷</span>Redo'

    // Changes counter (shows session changes that can be undone)
    const changesCounter = document.createElement('span')
    changesCounter.className = 'changes-counter'
    changesCounter.textContent = `${sessionChangesCount} changes`

    leftSection.appendChild(undoBtn)
    leftSection.appendChild(redoBtn)
    leftSection.appendChild(changesCounter)

    // Center section - Logo and title
    const centerSection = document.createElement('div')
    centerSection.className = 'banner-content'
    centerSection.style.cssText = 'display: flex; flex-direction: column; align-items: center;'

    const logoAndTitle = document.createElement('div')
    logoAndTitle.style.cssText = 'display: flex; align-items: center; gap: 10px;'

    const logo = document.createElement('img')
    logo.src = config.logoUrl
    logo.style.cssText = 'width: 24px; height: 24px;'
    logo.alt = 'ABsmartly'

    const title = document.createElement('div')
    title.className = 'banner-title'
    title.textContent = `Visual Editor - ${config.experimentName}`

    logoAndTitle.appendChild(logo)
    logoAndTitle.appendChild(title)

    const subtitle = document.createElement('div')
    subtitle.className = 'banner-subtitle'
    subtitle.textContent = `Variant: ${config.variantName} • Click elements to edit`

    centerSection.appendChild(logoAndTitle)
    centerSection.appendChild(subtitle)

    // Right section - Save and Exit buttons
    const rightSection = document.createElement('div')
    rightSection.className = 'banner-actions'
    rightSection.style.cssText = 'display: flex; gap: 10px; align-items: center;'

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

    rightSection.appendChild(saveBtn)
    rightSection.appendChild(exitBtn)

    // Assemble banner
    banner.appendChild(leftSection)
    banner.appendChild(centerSection)
    banner.appendChild(rightSection)

    bannerContainer.appendChild(bannerStyle)
    bannerContainer.appendChild(banner)

    document.body.appendChild(bannerHost)

    // Add drag functionality
    let isDragging = false
    let currentX = 0
    let currentY = 16 // Initial top position
    let initialX = 0
    let initialY = 0

    banner.style.cursor = 'grab'

    banner.addEventListener('mousedown', (e) => {
      // Don't start drag if clicking on a button
      if ((e.target as HTMLElement).closest('.banner-button')) {
        return
      }

      isDragging = true
      banner.style.cursor = 'grabbing'
      
      initialX = e.clientX - currentX
      initialY = e.clientY - currentY
    })

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return

      e.preventDefault()
      
      currentX = e.clientX - initialX
      currentY = e.clientY - initialY

      // Update position
      bannerHost.style.left = '0'
      bannerHost.style.transform = 'none'
      banner.style.transform = `translate(${currentX}px, ${currentY}px)`
    })

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false
        banner.style.cursor = 'grab'
      }
    })

    // Add event listeners for banner actions
    banner.addEventListener('click', (e) => {
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
    // Delegate to the new Monaco-based HTML editor
    return this.htmlEditor.show(element, currentHtml)
  }

  // These will be set by the main visual editor
  onUndo: () => void = () => console.log('[ABSmartly] Undo callback not set')
  onRedo: () => void = () => console.log('[ABSmartly] Redo callback not set')
  onClear: () => void = () => console.log('[ABSmartly] Clear callback not set')
  onSave: () => void = () => console.log('[ABSmartly] Save callback not set')
  onExit: () => void = () => console.log('[ABSmartly] Exit callback not set')

  private handleBannerAction(action: string): void {
    switch (action) {
      case 'undo':
        this.onUndo()
        break

      case 'redo':
        this.onRedo()
        break

      case 'save':
        this.onSave()
        break

      case 'exit':
        this.onExit()
        break
    }
  }

  updateBanner(options: { changesCount?: number; canUndo?: boolean; canRedo?: boolean }): void {
    console.log('[UIComponents] updateBanner called with:', options)

    // Use stored shadow root reference
    if (!this.bannerShadowRoot) {
      console.log('[UIComponents] Banner shadow root reference not found')
      return
    }

    const shadowRoot = this.bannerShadowRoot

    if (options.changesCount !== undefined) {
      const counter = shadowRoot.querySelector('.changes-counter')
      if (counter) {
        counter.textContent = `${options.changesCount} changes`
        console.log('[UIComponents] Updated changes counter to:', options.changesCount)
      } else {
        console.log('[UIComponents] Changes counter element not found')
      }
    }

    if (options.canUndo !== undefined) {
      const undoBtn = shadowRoot.querySelector('[data-action="undo"]') as HTMLButtonElement
      if (undoBtn) {
        undoBtn.disabled = !options.canUndo
        console.log('[UIComponents] Updated undo button disabled to:', !options.canUndo)
      } else {
        console.log('[UIComponents] Undo button not found')
      }
    }

    if (options.canRedo !== undefined) {
      const redoBtn = shadowRoot.querySelector('[data-action="redo"]') as HTMLButtonElement
      if (redoBtn) {
        redoBtn.disabled = !options.canRedo
        console.log('[UIComponents] Updated redo button disabled to:', !options.canRedo)
      } else {
        console.log('[UIComponents] Redo button not found')
      }
    }
  }

  removeBanner(): void {
    const banner = document.getElementById('absmartly-visual-editor-banner-host')
    if (banner) banner.remove()
    this.bannerShadowRoot = null
  }
}

export default UIComponents