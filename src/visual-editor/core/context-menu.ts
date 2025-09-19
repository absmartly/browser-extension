/**
 * Context Menu for Visual Editor
 * Handles the right-click context menu and its actions
 */

import { generateRobustSelector } from '../utils/selector-generator'
import StateManager from './state-manager'

export interface MenuAction {
  icon: string
  label: string
  action: string
  shortcut?: string
}

export interface MenuDivider {
  divider: true
}

export type MenuItem = MenuAction | MenuDivider

export class ContextMenu {
  private stateManager: StateManager

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager
  }

  show(x: number, y: number, element: Element): void {
    console.log('[ContextMenu] Showing context menu at', x, y, 'for element:', element)
    // Remove any existing menu first
    const existingHost = document.getElementById('absmartly-menu-host')
    if (existingHost) existingHost.remove()

    // Calculate menu dimensions (approximate based on number of items)
    const menuItemCount = 20
    const itemHeight = 32
    const dividerHeight = 9
    const dividerCount = 6
    const menuPadding = 8
    const estimatedMenuHeight = (menuItemCount * itemHeight) + (dividerCount * dividerHeight) + menuPadding
    const estimatedMenuWidth = 220

    // Determine if menu fits in viewport
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth
    const scrollY = window.scrollY
    const scrollX = window.scrollX

    // Calculate optimal position
    let menuLeft = x + 5
    let menuTop = y + 5
    let useAbsolutePositioning = false

    // Check if menu fits in viewport
    if (estimatedMenuHeight > viewportHeight - 40) {
      useAbsolutePositioning = true
      menuLeft = x + scrollX + 5
      menuTop = y + scrollY + 5
    } else {
      if (menuLeft + estimatedMenuWidth > viewportWidth) {
        menuLeft = Math.max(10, x - estimatedMenuWidth - 5)
      }
      if (menuTop + estimatedMenuHeight > viewportHeight) {
        menuTop = Math.max(10, y - estimatedMenuHeight - 5)
      }
    }

    // Create host element for shadow DOM
    const menuHost = document.createElement('div')
    menuHost.id = 'absmartly-menu-host'
    menuHost.style.cssText = `
      position: ${useAbsolutePositioning ? 'absolute' : 'fixed'};
      top: 0;
      left: 0;
      width: 0;
      height: 0;
      z-index: 2147483647;
      pointer-events: none;
    `

    // Attach shadow root with closed mode for complete isolation
    const shadow = menuHost.attachShadow({ mode: 'closed' })

    // Create styles for shadow DOM
    const style = document.createElement('style')
    style.textContent = this.getMenuStyles(useAbsolutePositioning, scrollX, scrollY, menuLeft, menuTop)
    shadow.appendChild(style)

    // Create backdrop
    const backdrop = document.createElement('div')
    backdrop.className = 'menu-backdrop'

    // Create menu container
    const menuContainer = document.createElement('div')
    menuContainer.className = 'menu-container'

    // Create menu items
    this.createMenuItems().forEach(item => {
      if ('divider' in item && item.divider) {
        const divider = document.createElement('div')
        divider.className = 'menu-divider'
        menuContainer.appendChild(divider)
      } else {
        const menuItem = this.createMenuItem(item as MenuAction)
        menuContainer.appendChild(menuItem)
      }
    })

    // Add elements to shadow DOM
    shadow.appendChild(backdrop)
    shadow.appendChild(menuContainer)

    // Add menu host to document
    document.body.appendChild(menuHost)

    // Handle clicks in shadow DOM
    backdrop.addEventListener('click', (e) => {
      e.stopPropagation()
      menuHost.remove()
    })

    menuContainer.addEventListener('click', (e) => {
      e.stopPropagation()
      const menuItem = (e.target as Element).closest('.menu-item') as HTMLElement
      if (menuItem) {
        const action = menuItem.dataset.action
        if (action) {
          this.handleAction(action, element)
          menuHost.remove()
        }
      }
    })
  }

  private getMenuStyles(useAbsolutePositioning: boolean, scrollX: number, scrollY: number, menuLeft: number, menuTop: number): string {
    return `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      .menu-backdrop {
        position: fixed;
        top: ${useAbsolutePositioning ? -scrollY : 0}px;
        left: ${useAbsolutePositioning ? -scrollX : 0}px;
        width: 100vw;
        height: 100vh;
        background: transparent;
        pointer-events: auto;
        z-index: 1;
      }

      .menu-container {
        position: ${useAbsolutePositioning ? 'absolute' : 'fixed'};
        left: ${menuLeft}px;
        top: ${menuTop}px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1), 0 0 1px rgba(0,0,0,0.1);
        padding: 4px 0;
        min-width: 200px;
        max-width: 280px;
        ${useAbsolutePositioning ? '' : 'max-height: calc(100vh - 20px);'}
        ${useAbsolutePositioning ? '' : 'overflow-y: auto;'}
        z-index: 2;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 13px;
        color: #333;
        pointer-events: auto;
      }

      .menu-container::-webkit-scrollbar {
        width: 6px;
      }

      .menu-container::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
      }

      .menu-container::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 3px;
      }

      .menu-container::-webkit-scrollbar-thumb:hover {
        background: #555;
      }

      .menu-item {
        padding: 8px 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: background-color 0.15s;
        user-select: none;
      }

      .menu-item:hover {
        background-color: #f0f0f0;
      }

      .menu-divider {
        height: 1px;
        background: #e5e5e5;
        margin: 4px 0;
      }

      .menu-icon {
        width: 16px;
        text-align: center;
        opacity: 0.7;
        font-size: 12px;
      }

      .menu-label {
        flex: 1;
      }

      .menu-shortcut {
        color: #9ca3af;
        font-size: 11px;
        margin-left: auto;
      }
    `
  }

  private createMenuItems(): MenuItem[] {
    return [
      { icon: '✏️', label: 'Edit Element', action: 'edit' },
      { icon: '</>', label: 'Edit HTML', action: 'editHtml' },
      { icon: '🔄', label: 'Rearrange', action: 'rearrange' },
      { icon: '✂️', label: 'Inline Edit', action: 'inlineEdit' },
      { divider: true },
      { icon: '⬆', label: 'Move up', action: 'moveUp' },
      { icon: '⬇', label: 'Move down', action: 'moveDown' },
      { icon: '↔️', label: 'Resize', action: 'resize' },
      { divider: true },
      { icon: '📋', label: 'Copy', action: 'copy' },
      { icon: '🔗', label: 'Copy Selector Path', action: 'copySelector', shortcut: '⌘+Shift+C' },
      { divider: true },
      { icon: '🎯', label: 'Select Relative Element', action: 'selectRelative' },
      { icon: '➕', label: 'Insert new block', action: 'insertBlock' },
      { divider: true },
      { icon: '💡', label: 'Suggest Variations', action: 'suggestVariations' },
      { icon: '💾', label: 'Save to library', action: 'saveToLibrary' },
      { icon: '✅', label: 'Apply saved modification', action: 'applySaved' },
      { divider: true },
      { icon: '🎯', label: 'Track Clicks', action: 'trackClicks' },
      { divider: true },
      { icon: '👁', label: 'Hide', action: 'hide' },
      { icon: '🗑', label: 'Remove', action: 'delete', shortcut: 'Delete' }
    ]
  }

  private createMenuItem(item: MenuAction): HTMLElement {
    const menuItem = document.createElement('div')
    menuItem.className = 'menu-item'
    menuItem.dataset.action = item.action

    const icon = document.createElement('span')
    icon.className = 'menu-icon'
    icon.textContent = item.icon

    const label = document.createElement('span')
    label.className = 'menu-label'
    label.textContent = item.label

    menuItem.appendChild(icon)
    menuItem.appendChild(label)

    if (item.shortcut) {
      const shortcut = document.createElement('span')
      shortcut.className = 'menu-shortcut'
      shortcut.textContent = item.shortcut
      menuItem.appendChild(shortcut)
    }

    return menuItem
  }

  // This will be set by the main visual editor to handle actions
  handleAction: (action: string, element: Element) => void = (action, element) => {
    console.log('[ABSmartly] Menu action:', action, 'for element:', element)
  }

  private showNotification(message: string): void {
    // This will be implemented by ui-components module
    console.log('[ABSmartly] Notification:', message)
  }
}

export default ContextMenu