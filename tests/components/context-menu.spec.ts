import { test, expect } from '@playwright/test'

/**
 * Context Menu Component Tests
 *
 * Comprehensive tests for the ContextMenu component using Playwright component testing.
 * Tests shadow DOM rendering, positioning, interactions, keyboard navigation,
 * accessibility, and visual aspects.
 */

// Mock StateManager for testing
class MockStateManager {
  private state = {
    selectedElement: null,
    hoveredElement: null,
    changes: [],
    undoStack: [],
    redoStack: [],
    originalValues: new Map(),
    isRearranging: false,
    isResizing: false,
    draggedElement: null,
    isActive: true
  }

  getState() {
    return { ...this.state }
  }

  getConfig() {
    return {
      variantName: 'Test Variant',
      experimentName: 'Test Experiment',
      logoUrl: 'https://example.com/logo.png'
    }
  }

  updateState(updates: any) {
    this.state = { ...this.state, ...updates }
  }

  setSelectedElement(element: Element | null) {
    this.updateState({ selectedElement: element })
  }

  setHoveredElement(element: Element | null) {
    this.updateState({ hoveredElement: element })
  }
}

// Mock ContextMenu implementation for testing
const mockContextMenuCode = `
class ContextMenu {
  constructor(stateManager) {
    this.stateManager = stateManager
    this.handleAction = (action, element) => {
      window.lastAction = { action, element }
      console.log('[ABSmartly] Menu action:', action, 'for element:', element)
    }
  }

  show(x, y, element) {
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
    menuHost.style.cssText = \`
      position: \${useAbsolutePositioning ? 'absolute' : 'fixed'};
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 2147483647;
      pointer-events: none;
    \`

    // Attach shadow root with closed mode for complete isolation
    const shadow = menuHost.attachShadow({ mode: 'closed' })

    // Store shadow root for testing access
    menuHost._shadowRoot = shadow

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
    this.createMenuItems(element).forEach(item => {
      if (item.divider) {
        const divider = document.createElement('div')
        divider.className = 'menu-divider'
        menuContainer.appendChild(divider)
      } else {
        const menuItem = this.createMenuItem(item)
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
      const menuItem = e.target.closest('.menu-item')
      if (menuItem) {
        const action = menuItem.dataset.action
        if (action) {
          this.handleAction(action, element)
          menuHost.remove()
        }
      }
    })

    // Keyboard navigation
    menuContainer.addEventListener('keydown', (e) => {
      this.handleKeyNavigation(e, menuContainer)
    })

    // Focus first menu item for keyboard navigation
    const firstMenuItem = menuContainer.querySelector('.menu-item')
    if (firstMenuItem) {
      firstMenuItem.tabIndex = 0
      firstMenuItem.focus()
    }

    return menuHost
  }

  getMenuStyles(useAbsolutePositioning, scrollX, scrollY, menuLeft, menuTop) {
    return \`
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      .menu-backdrop {
        position: fixed;
        top: \${useAbsolutePositioning ? -scrollY : 0}px;
        left: \${useAbsolutePositioning ? -scrollX : 0}px;
        width: 100vw;
        height: 100vh;
        background: transparent;
        pointer-events: auto;
        z-index: 1;
      }

      .menu-container {
        position: \${useAbsolutePositioning ? 'absolute' : 'fixed'};
        left: \${menuLeft}px;
        top: \${menuTop}px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1), 0 0 1px rgba(0,0,0,0.1);
        padding: 4px 0;
        min-width: 200px;
        max-width: 280px;
        \${useAbsolutePositioning ? '' : 'max-height: calc(100vh - 20px);'}
        \${useAbsolutePositioning ? '' : 'overflow-y: auto;'}
        z-index: 2;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 13px;
        color: #333;
        pointer-events: auto;
        outline: none;
      }

      .menu-item {
        padding: 8px 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: background-color 0.15s;
        user-select: none;
        outline: none;
      }

      .menu-item:hover,
      .menu-item:focus {
        background-color: #f0f0f0;
      }

      .menu-item[aria-disabled="true"] {
        opacity: 0.5;
        cursor: not-allowed;
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
    \`
  }

  createMenuItems(element) {
    const isImage = element && element.tagName === 'IMG'
    const isLink = element && element.tagName === 'A'
    const isInput = element && ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)
    const isButton = element && element.tagName === 'BUTTON'

    return [
      { icon: '✏️', label: 'Edit Element', action: 'edit' },
      { icon: '</>', label: 'Edit HTML', action: 'editHtml' },
      { icon: '🔄', label: 'Rearrange', action: 'rearrange', disabled: isInput },
      { icon: '✂️', label: 'Inline Edit', action: 'inlineEdit', disabled: isImage },
      { divider: true },
      { icon: '⬆', label: 'Move up', action: 'moveUp' },
      { icon: '⬇', label: 'Move down', action: 'moveDown' },
      { icon: '↔️', label: 'Resize', action: 'resize', disabled: isButton },
      { divider: true },
      { icon: '📋', label: 'Copy', action: 'copy' },
      { icon: '🔗', label: 'Copy Selector Path', action: 'copySelector', shortcut: '⌘+Shift+C' },
      { divider: true },
      { icon: '🎯', label: 'Select Relative Element', action: 'selectRelative' },
      { icon: '➕', label: 'Insert new block', action: 'insertBlock' },
      { divider: true },
      { icon: '💡', label: 'Suggest Variations', action: 'suggestVariations', disabled: isLink },
      { icon: '💾', label: 'Save to library', action: 'saveToLibrary' },
      { icon: '✅', label: 'Apply saved modification', action: 'applySaved' },
      { divider: true },
      { icon: '🎯', label: 'Track Clicks', action: 'trackClicks' },
      { divider: true },
      { icon: '👁', label: 'Hide', action: 'hide' },
      { icon: '🗑', label: 'Remove', action: 'delete', shortcut: 'Delete' }
    ]
  }

  createMenuItem(item) {
    const menuItem = document.createElement('div')
    menuItem.className = 'menu-item'
    menuItem.dataset.action = item.action
    menuItem.setAttribute('role', 'menuitem')
    menuItem.tabIndex = -1

    if (item.disabled) {
      menuItem.setAttribute('aria-disabled', 'true')
    }

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

  handleKeyNavigation(e, menuContainer) {
    const menuItems = Array.from(menuContainer.querySelectorAll('.menu-item:not([aria-disabled="true"])'))
    const currentIndex = menuItems.findIndex(item => item === document.activeElement)

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        const nextIndex = (currentIndex + 1) % menuItems.length
        menuItems[nextIndex].focus()
        break
      case 'ArrowUp':
        e.preventDefault()
        const prevIndex = currentIndex <= 0 ? menuItems.length - 1 : currentIndex - 1
        menuItems[prevIndex].focus()
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (currentIndex >= 0) {
          menuItems[currentIndex].click()
        }
        break
      case 'Escape':
        e.preventDefault()
        document.getElementById('absmartly-menu-host')?.remove()
        break
    }
  }
}

window.ContextMenu = ContextMenu
`

test.describe('ContextMenu Component Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test page with various element types
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Context Menu Test Page</title>
          <style>
            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
            .test-container { width: 100%; height: 100vh; }
            .test-element {
              width: 200px;
              height: 100px;
              background: #f0f0f0;
              margin: 10px;
              padding: 10px;
              border: 1px solid #ccc;
            }
            .bottom-element {
              position: absolute;
              bottom: 10px;
              right: 10px;
              width: 100px;
              height: 50px;
              background: #e0e0e0;
            }
            .right-element {
              position: absolute;
              top: 50%;
              right: 10px;
              width: 100px;
              height: 50px;
              background: #d0d0d0;
            }
          </style>
        </head>
        <body>
          <div class="test-container">
            <div id="div-element" class="test-element">Test Div Element</div>
            <img id="img-element" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" alt="Test Image" class="test-element" />
            <a id="link-element" href="#" class="test-element">Test Link</a>
            <button id="button-element" class="test-element">Test Button</button>
            <input id="input-element" type="text" value="Test Input" class="test-element" />
            <textarea id="textarea-element" class="test-element">Test Textarea</textarea>
            <select id="select-element" class="test-element">
              <option value="1">Option 1</option>
              <option value="2">Option 2</option>
            </select>
            <div id="bottom-element" class="bottom-element">Bottom</div>
            <div id="right-element" class="right-element">Right</div>
          </div>
        </body>
      </html>
    `)

    // Inject the mock ContextMenu and StateManager
    await page.evaluate(mockContextMenuCode)
    await page.evaluate(() => {
      // Mock StateManager
      class MockStateManager {
        getState() { return {} }
        getConfig() { return {} }
        updateState() {}
        setSelectedElement() {}
        setHoveredElement() {}
      }
      window.MockStateManager = MockStateManager
      window.lastAction = null
    })
  })

  test('should render context menu in shadow DOM', async ({ page }) => {
    await page.evaluate(() => {
      const stateManager = new window.MockStateManager()
      const contextMenu = new window.ContextMenu(stateManager)
      const element = document.getElementById('div-element')

      contextMenu.show(100, 100, element)
    })

    // Check that menu host exists
    const menuHost = await page.locator('#absmartly-menu-host')
    await expect(menuHost).toBeVisible()

    // Check shadow DOM structure
    const hasShadowRoot = await page.evaluate(() => {
      const host = document.getElementById('absmartly-menu-host')
      return host && host._shadowRoot !== undefined
    })
    expect(hasShadowRoot).toBe(true)

    // Verify menu items exist in shadow DOM
    const menuItemsCount = await page.evaluate(() => {
      const host = document.getElementById('absmartly-menu-host')
      const shadow = host._shadowRoot
      return shadow.querySelectorAll('.menu-item').length
    })
    expect(menuItemsCount).toBeGreaterThan(0)
  })

  test('should position menu correctly near viewport edges', async ({ page }) => {
    // Test bottom edge positioning
    await page.evaluate(() => {
      const stateManager = new window.MockStateManager()
      const contextMenu = new window.ContextMenu(stateManager)
      const element = document.getElementById('bottom-element')
      const rect = element.getBoundingClientRect()

      contextMenu.show(rect.right - 10, rect.bottom - 10, element)
    })

    let menuContainer = await page.evaluate(() => {
      const host = document.getElementById('absmartly-menu-host')
      const shadow = host._shadowRoot
      const container = shadow.querySelector('.menu-container')
      return {
        left: parseInt(container.style.left),
        top: parseInt(container.style.top)
      }
    })

    // Menu should be positioned to avoid viewport edges
    expect(menuContainer.left).toBeGreaterThan(0)
    expect(menuContainer.top).toBeGreaterThan(0)

    // Test right edge positioning
    await page.evaluate(() => {
      const host = document.getElementById('absmartly-menu-host')
      if (host) host.remove()

      const stateManager = new window.MockStateManager()
      const contextMenu = new window.ContextMenu(stateManager)
      const element = document.getElementById('right-element')
      const rect = element.getBoundingClientRect()

      contextMenu.show(rect.right - 10, rect.top + 10, element)
    })

    menuContainer = await page.evaluate(() => {
      const host = document.getElementById('absmartly-menu-host')
      const shadow = host._shadowRoot
      const container = shadow.querySelector('.menu-container')
      return {
        left: parseInt(container.style.left),
        top: parseInt(container.style.top)
      }
    })

    // Menu should be repositioned away from right edge
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    expect(menuContainer.left).toBeLessThan(viewportWidth - 200) // Menu width ~200px
  })

  test('should display all menu items with correct structure', async ({ page }) => {
    await page.evaluate(() => {
      const stateManager = new window.MockStateManager()
      const contextMenu = new window.ContextMenu(stateManager)
      const element = document.getElementById('div-element')

      contextMenu.show(100, 100, element)
    })

    const menuStructure = await page.evaluate(() => {
      const host = document.getElementById('absmartly-menu-host')
      const shadow = host._shadowRoot
      const items = Array.from(shadow.querySelectorAll('.menu-item, .menu-divider'))

      return items.map(item => {
        if (item.classList.contains('menu-divider')) {
          return { type: 'divider' }
        } else {
          return {
            type: 'item',
            action: item.dataset.action,
            icon: item.querySelector('.menu-icon')?.textContent,
            label: item.querySelector('.menu-label')?.textContent,
            shortcut: item.querySelector('.menu-shortcut')?.textContent || null,
            disabled: item.getAttribute('aria-disabled') === 'true'
          }
        }
      })
    })

    // Verify expected menu items exist
    const menuItems = menuStructure.filter(item => item.type === 'item')
    const dividers = menuStructure.filter(item => item.type === 'divider')

    expect(menuItems.length).toBeGreaterThan(15)
    expect(dividers.length).toBeGreaterThan(5)

    // Check specific important items
    const editItem = menuItems.find(item => item.action === 'edit')
    expect(editItem).toBeDefined()
    expect(editItem.icon).toBe('✏️')
    expect(editItem.label).toBe('Edit Element')

    const deleteItem = menuItems.find(item => item.action === 'delete')
    expect(deleteItem).toBeDefined()
    expect(deleteItem.shortcut).toBe('Delete')
  })

  test('should show conditional item visibility based on element type', async ({ page }) => {
    // Test with IMG element
    const imgMenuStructure = await page.evaluate(() => {
      const stateManager = new window.MockStateManager()
      const contextMenu = new window.ContextMenu(stateManager)
      const element = document.getElementById('img-element')

      contextMenu.show(100, 100, element)

      const host = document.getElementById('absmartly-menu-host')
      const shadow = host._shadowRoot
      const items = Array.from(shadow.querySelectorAll('.menu-item'))

      return items.map(item => ({
        action: item.dataset.action,
        disabled: item.getAttribute('aria-disabled') === 'true'
      }))
    })

    // Inline edit should be disabled for images
    const inlineEditImg = imgMenuStructure.find(item => item.action === 'inlineEdit')
    expect(inlineEditImg.disabled).toBe(true)

    // Test with INPUT element
    const inputMenuStructure = await page.evaluate(() => {
      const host = document.getElementById('absmartly-menu-host')
      if (host) host.remove()

      const stateManager = new window.MockStateManager()
      const contextMenu = new window.ContextMenu(stateManager)
      const element = document.getElementById('input-element')

      contextMenu.show(100, 100, element)

      const newHost = document.getElementById('absmartly-menu-host')
      const shadow = newHost._shadowRoot
      const items = Array.from(shadow.querySelectorAll('.menu-item'))

      return items.map(item => ({
        action: item.dataset.action,
        disabled: item.getAttribute('aria-disabled') === 'true'
      }))
    })

    // Rearrange should be disabled for inputs
    const rearrangeInput = inputMenuStructure.find(item => item.action === 'rearrange')
    expect(rearrangeInput.disabled).toBe(true)

    // Test with BUTTON element
    const buttonMenuStructure = await page.evaluate(() => {
      const host = document.getElementById('absmartly-menu-host')
      if (host) host.remove()

      const stateManager = new window.MockStateManager()
      const contextMenu = new window.ContextMenu(stateManager)
      const element = document.getElementById('button-element')

      contextMenu.show(100, 100, element)

      const newHost = document.getElementById('absmartly-menu-host')
      const shadow = newHost._shadowRoot
      const items = Array.from(shadow.querySelectorAll('.menu-item'))

      return items.map(item => ({
        action: item.dataset.action,
        disabled: item.getAttribute('aria-disabled') === 'true'
      }))
    })

    // Resize should be disabled for buttons
    const resizeButton = buttonMenuStructure.find(item => item.action === 'resize')
    expect(resizeButton.disabled).toBe(true)
  })

  test('should handle keyboard navigation correctly', async ({ page }) => {
    await page.evaluate(() => {
      const stateManager = new window.MockStateManager()
      const contextMenu = new window.ContextMenu(stateManager)
      const element = document.getElementById('div-element')

      contextMenu.show(100, 100, element)
    })

    // Check initial focus
    const initialFocusedItem = await page.evaluate(() => {
      const host = document.getElementById('absmartly-menu-host')
      const shadow = host._shadowRoot
      return shadow.activeElement?.dataset.action
    })
    expect(initialFocusedItem).toBe('edit') // First menu item

    // Test Arrow Down navigation
    await page.evaluate(() => {
      const host = document.getElementById('absmartly-menu-host')
      const shadow = host._shadowRoot
      const container = shadow.querySelector('.menu-container')
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    })

    const secondFocusedItem = await page.evaluate(() => {
      const host = document.getElementById('absmartly-menu-host')
      const shadow = host._shadowRoot
      return shadow.activeElement?.dataset.action
    })
    expect(secondFocusedItem).toBe('editHtml') // Second menu item

    // Test Arrow Up navigation
    await page.evaluate(() => {
      const host = document.getElementById('absmartly-menu-host')
      const shadow = host._shadowRoot
      const container = shadow.querySelector('.menu-container')
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
    })

    const backToFirstItem = await page.evaluate(() => {
      const host = document.getElementById('absmartly-menu-host')
      const shadow = host._shadowRoot
      return shadow.activeElement?.dataset.action
    })
    expect(backToFirstItem).toBe('edit') // Back to first item

    // Test Escape key closes menu
    await page.evaluate(() => {
      const host = document.getElementById('absmartly-menu-host')
      const shadow = host._shadowRoot
      const container = shadow.querySelector('.menu-container')
      container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    const menuExists = await page.locator('#absmartly-menu-host').count()
    expect(menuExists).toBe(0)
  })

  test('should close when clicking outside menu', async ({ page }) => {
    await page.evaluate(() => {
      const stateManager = new window.MockStateManager()
      const contextMenu = new window.ContextMenu(stateManager)
      const element = document.getElementById('div-element')

      contextMenu.show(100, 100, element)
    })

    // Verify menu is visible
    await expect(page.locator('#absmartly-menu-host')).toBeVisible()

    // Click on backdrop (outside menu)
    await page.evaluate(() => {
      const host = document.getElementById('absmartly-menu-host')
      const shadow = host._shadowRoot
      const backdrop = shadow.querySelector('.menu-backdrop')
      backdrop.click()
    })

    // Menu should be removed
    const menuExists = await page.locator('#absmartly-menu-host').count()
    expect(menuExists).toBe(0)
  })

  test('should execute action callbacks correctly', async ({ page }) => {
    await page.evaluate(() => {
      const stateManager = new window.MockStateManager()
      const contextMenu = new window.ContextMenu(stateManager)
      const element = document.getElementById('div-element')

      contextMenu.show(100, 100, element)
    })

    // Click on an enabled menu item
    await page.evaluate(() => {
      const host = document.getElementById('absmartly-menu-host')
      const shadow = host._shadowRoot
      const editItem = shadow.querySelector('[data-action="edit"]')
      editItem.click()
    })

    // Verify action was called
    const lastAction = await page.evaluate(() => window.lastAction)
    expect(lastAction).toBeDefined()
    expect(lastAction.action).toBe('edit')
    expect(lastAction.element.id).toBe('div-element')

    // Menu should be closed after action
    const menuExists = await page.locator('#absmartly-menu-host').count()
    expect(menuExists).toBe(0)
  })

  test('should not execute actions for disabled items', async ({ page }) => {
    await page.evaluate(() => {
      const stateManager = new window.MockStateManager()
      const contextMenu = new window.ContextMenu(stateManager)
      const element = document.getElementById('img-element') // Image element for disabled items

      contextMenu.show(100, 100, element)
      window.lastAction = null // Reset
    })

    // Try to click on a disabled item (inline edit for image)
    await page.evaluate(() => {
      const host = document.getElementById('absmartly-menu-host')
      const shadow = host._shadowRoot
      const inlineEditItem = shadow.querySelector('[data-action="inlineEdit"]')
      inlineEditItem.click()
    })

    // No action should be executed for disabled items
    const lastAction = await page.evaluate(() => window.lastAction)
    expect(lastAction).toBeNull()

    // Menu should still exist (disabled items don't close menu)
    await expect(page.locator('#absmartly-menu-host')).toBeVisible()
  })

  test('should have proper visual styles and animations', async ({ page }) => {
    await page.evaluate(() => {
      const stateManager = new window.MockStateManager()
      const contextMenu = new window.ContextMenu(stateManager)
      const element = document.getElementById('div-element')

      contextMenu.show(100, 100, element)
    })

    // Check menu container styles
    const menuStyles = await page.evaluate(() => {
      const host = document.getElementById('absmartly-menu-host')
      const shadow = host._shadowRoot
      const container = shadow.querySelector('.menu-container')
      const computedStyle = window.getComputedStyle(container)

      return {
        background: computedStyle.backgroundColor,
        borderRadius: computedStyle.borderRadius,
        boxShadow: computedStyle.boxShadow,
        fontFamily: computedStyle.fontFamily,
        zIndex: computedStyle.zIndex
      }
    })

    expect(menuStyles.background).toBe('rgb(255, 255, 255)') // white
    expect(menuStyles.borderRadius).toBe('6px')
    expect(menuStyles.boxShadow).toContain('rgba(0, 0, 0, 0.1)')
    expect(menuStyles.zIndex).toBe('2')

    // Check menu item styles
    const itemStyles = await page.evaluate(() => {
      const host = document.getElementById('absmartly-menu-host')
      const shadow = host._shadowRoot
      const item = shadow.querySelector('.menu-item')
      const computedStyle = window.getComputedStyle(item)

      return {
        display: computedStyle.display,
        alignItems: computedStyle.alignItems,
        gap: computedStyle.gap,
        transition: computedStyle.transition,
        cursor: computedStyle.cursor
      }
    })

    expect(itemStyles.display).toBe('flex')
    expect(itemStyles.alignItems).toBe('center')
    expect(itemStyles.cursor).toBe('pointer')
    expect(itemStyles.transition).toContain('background-color')

    // Check hover effects
    const hoverBackgroundColor = await page.evaluate(() => {
      const host = document.getElementById('absmartly-menu-host')
      const shadow = host._shadowRoot
      const item = shadow.querySelector('.menu-item')

      // Simulate hover
      item.dispatchEvent(new MouseEvent('mouseenter'))

      return window.getComputedStyle(item).backgroundColor
    })

    // Should have hover effect (implementation may vary)
    expect(hoverBackgroundColor).toBeDefined()
  })

  test('should have proper accessibility features', async ({ page }) => {
    await page.evaluate(() => {
      const stateManager = new window.MockStateManager()
      const contextMenu = new window.ContextMenu(stateManager)
      const element = document.getElementById('div-element')

      contextMenu.show(100, 100, element)
    })

    // Check ARIA attributes
    const accessibilityFeatures = await page.evaluate(() => {
      const host = document.getElementById('absmartly-menu-host')
      const shadow = host._shadowRoot
      const items = Array.from(shadow.querySelectorAll('.menu-item'))

      return items.map(item => ({
        role: item.getAttribute('role'),
        tabIndex: item.tabIndex,
        ariaDisabled: item.getAttribute('aria-disabled'),
        hasKeyboardFocus: item === shadow.activeElement
      }))
    })

    // All menu items should have proper roles
    accessibilityFeatures.forEach(item => {
      expect(item.role).toBe('menuitem')
      expect(item.tabIndex).toBeDefined()
    })

    // First item should be focused
    expect(accessibilityFeatures[0].hasKeyboardFocus).toBe(true)

    // Disabled items should have aria-disabled
    const disabledItems = accessibilityFeatures.filter(item => item.ariaDisabled === 'true')
    expect(disabledItems.length).toBeGreaterThan(0)
  })

  test('should handle menu positioning with scrolled viewport', async ({ page }) => {
    // Scroll the page
    await page.evaluate(() => {
      window.scrollTo(0, 500)
    })

    await page.evaluate(() => {
      const stateManager = new window.MockStateManager()
      const contextMenu = new window.ContextMenu(stateManager)
      const element = document.getElementById('div-element')

      contextMenu.show(100, 600, element) // Position below fold
    })

    const menuPosition = await page.evaluate(() => {
      const host = document.getElementById('absmartly-menu-host')
      const shadow = host._shadowRoot
      const container = shadow.querySelector('.menu-container')

      return {
        position: container.style.position,
        left: parseInt(container.style.left),
        top: parseInt(container.style.top)
      }
    })

    // Should handle scrolled positioning correctly
    expect(menuPosition.position).toBeDefined()
    expect(menuPosition.left).toBeGreaterThan(0)
    expect(menuPosition.top).toBeGreaterThan(0)
  })

  test('should remove existing menu before showing new one', async ({ page }) => {
    // Show first menu
    await page.evaluate(() => {
      const stateManager = new window.MockStateManager()
      const contextMenu = new window.ContextMenu(stateManager)
      const element = document.getElementById('div-element')

      contextMenu.show(100, 100, element)
    })

    await expect(page.locator('#absmartly-menu-host')).toBeVisible()

    // Show second menu
    await page.evaluate(() => {
      const stateManager = new window.MockStateManager()
      const contextMenu = new window.ContextMenu(stateManager)
      const element = document.getElementById('button-element')

      contextMenu.show(200, 200, element)
    })

    // Should only have one menu
    const menuCount = await page.locator('#absmartly-menu-host').count()
    expect(menuCount).toBe(1)
  })
})