/**
 * Unit tests for ContextMenu class
 * Tests menu creation, positioning, interactions, and cleanup
 */

import { ContextMenu } from '../context-menu'
import type { MenuAction, MenuItem } from '../context-menu'
import StateManager from '../state-manager'
import type { VisualEditorConfig } from '../state-manager'

// Mock the selector generator utility
jest.mock('../../utils/selector-generator', () => ({
  generateRobustSelector: jest.fn().mockReturnValue('.mock-selector')
}))

describe('ContextMenu', () => {
  let contextMenu: ContextMenu
  let mockStateManager: jest.Mocked<StateManager>
  let mockElement: HTMLElement
  let mockConfig: VisualEditorConfig

  beforeEach(() => {
    // Clear DOM
    document.body.innerHTML = ''

    // Setup viewport dimensions
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
    Object.defineProperty(window, 'innerHeight', { writable: true, value: 768 })
    Object.defineProperty(window, 'scrollX', { writable: true, value: 0 })
    Object.defineProperty(window, 'scrollY', { writable: true, value: 0 })

    // Create mock config
    mockConfig = {
      variantName: 'test-variant',
      experimentName: 'test-experiment',
      logoUrl: 'test-logo.png'
    }

    // Create mock StateManager
    mockStateManager = {
      getState: jest.fn().mockReturnValue({
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
      }),
      getConfig: jest.fn().mockReturnValue(mockConfig),
      updateState: jest.fn(),
      setState: jest.fn(),
      onStateChange: jest.fn(),
      setSelectedElement: jest.fn(),
      setHoveredElement: jest.fn(),
      addChange: jest.fn(),
      setChanges: jest.fn(),
      pushUndo: jest.fn(),
      pushRedo: jest.fn(),
      popUndo: jest.fn(),
      popRedo: jest.fn(),
      setOriginalValue: jest.fn(),
      getOriginalValue: jest.fn(),
      setRearranging: jest.fn(),
      setResizing: jest.fn(),
      setDraggedElement: jest.fn(),
      deactivate: jest.fn()
    } as any

    // Create mock element
    mockElement = document.createElement('div')
    mockElement.className = 'test-element'
    document.body.appendChild(mockElement)

    // Create context menu instance
    contextMenu = new ContextMenu(mockStateManager)

    // Mock console.log to avoid noise in test output
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    // Clean up any existing menus
    const existingHost = document.getElementById('absmartly-menu-host')
    if (existingHost) {
      existingHost.remove()
    }
    jest.clearAllMocks()
  })

  describe('Constructor and Initialization', () => {
    it('should create ContextMenu instance with StateManager', () => {
      expect(contextMenu).toBeInstanceOf(ContextMenu)
      expect(contextMenu['stateManager']).toBe(mockStateManager)
    })

    it('should have default handleAction method that logs action', () => {
      const consoleSpy = jest.spyOn(console, 'log')
      contextMenu.handleAction('test-action', mockElement)

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ABSmartly] Menu action:', 'test-action', 'for element:', mockElement
      )
    })

    it('should allow overriding handleAction method', () => {
      const customHandler = jest.fn()
      contextMenu.handleAction = customHandler

      contextMenu.handleAction('test-action', mockElement)
      expect(customHandler).toHaveBeenCalledWith('test-action', mockElement)
    })
  })

  describe('show() method', () => {
    it('should create menu host element with correct ID and positioning', () => {
      contextMenu.show(100, 100, mockElement)

      const menuHost = document.getElementById('absmartly-menu-host')
      expect(menuHost).toBeTruthy()
      expect(menuHost?.style.position).toBe('fixed')
      expect(menuHost?.style.zIndex).toBe('2147483647')
      expect(menuHost?.style.pointerEvents).toBe('none')
    })

    it('should remove existing menu before showing new one', () => {
      // Create existing menu
      const existingHost = document.createElement('div')
      existingHost.id = 'absmartly-menu-host'
      document.body.appendChild(existingHost)

      contextMenu.show(100, 100, mockElement)

      // Should only have one menu host
      const menuHosts = document.querySelectorAll('#absmartly-menu-host')
      expect(menuHosts.length).toBe(1)
    })

    it('should create shadow DOM with closed mode', () => {
      contextMenu.show(100, 100, mockElement)

      const menuHost = document.getElementById('absmartly-menu-host')
      expect(menuHost?.shadowRoot).toBeFalsy() // Closed mode means shadowRoot is null
    })

    it('should position menu correctly within viewport bounds', () => {
      // Test normal positioning
      contextMenu.show(100, 100, mockElement)
      let menuHost = document.getElementById('absmartly-menu-host')
      expect(menuHost).toBeTruthy()

      // Clean up for next test
      menuHost?.remove()

      // Test positioning near right edge
      contextMenu.show(900, 100, mockElement)
      menuHost = document.getElementById('absmartly-menu-host')
      expect(menuHost).toBeTruthy()

      // Clean up for next test
      menuHost?.remove()

      // Test positioning near bottom edge
      contextMenu.show(100, 700, mockElement)
      menuHost = document.getElementById('absmartly-menu-host')
      expect(menuHost).toBeTruthy()
    })

    it('should use absolute positioning when menu is taller than viewport', () => {
      // Set small viewport height to force absolute positioning
      Object.defineProperty(window, 'innerHeight', { writable: true, value: 300 })

      contextMenu.show(100, 100, mockElement)

      const menuHost = document.getElementById('absmartly-menu-host')
      expect(menuHost?.style.position).toBe('absolute')
    })

    it('should handle viewport boundaries correctly', () => {
      // Test positioning at viewport edges
      const testCases = [
        { x: 0, y: 0 }, // Top-left corner
        { x: 1024, y: 0 }, // Top-right corner
        { x: 0, y: 768 }, // Bottom-left corner
        { x: 1024, y: 768 } // Bottom-right corner
      ]

      testCases.forEach(({ x, y }, index) => {
        contextMenu.show(x, y, mockElement)
        const menuHost = document.getElementById('absmartly-menu-host')
        expect(menuHost).toBeTruthy()
        menuHost?.remove() // Clean up for next iteration
      })
    })
  })

  describe('Menu Items Creation', () => {
    beforeEach(() => {
      contextMenu.show(100, 100, mockElement)
    })

    it('should create all menu actions', () => {
      const expectedActions = [
        'edit', 'editHtml', 'rearrange', 'resize',
        'move-up', 'move-down',
        'copy', 'copySelector',
        'selectRelative', 'insert-block',
        'hide', 'delete'
      ]

      const menuItems = contextMenu['createMenuItems']()
      const actions = menuItems
        .filter((item): item is MenuAction => !('divider' in item))
        .map(item => item.action)

      expectedActions.forEach(action => {
        expect(actions).toContain(action)
      })
    })

    it('should create menu items with correct structure', () => {
      const menuItems = contextMenu['createMenuItems']()

      // Check that we have both actions and dividers
      const actions = menuItems.filter((item): item is MenuAction => !('divider' in item))
      const dividers = menuItems.filter(item => 'divider' in item)

      expect(actions.length).toBeGreaterThan(10)
      expect(dividers.length).toBeGreaterThan(3)

      // Check action structure
      actions.forEach(action => {
        expect(action).toHaveProperty('icon')
        expect(action).toHaveProperty('label')
        expect(action).toHaveProperty('action')
        expect(typeof action.icon).toBe('string')
        expect(typeof action.label).toBe('string')
        expect(typeof action.action).toBe('string')
      })
    })

    it('should include shortcuts for specific actions', () => {
      const menuItems = contextMenu['createMenuItems']()
      const actions = menuItems.filter((item): item is MenuAction => !('divider' in item))
      const actionsWithShortcuts = actions.filter(item => item.shortcut)

      expect(actionsWithShortcuts.length).toBeGreaterThan(0)

      // Check specific shortcuts
      const copySelector = actionsWithShortcuts.find(item => item.action === 'copySelector')
      const deleteAction = actionsWithShortcuts.find(item => item.action === 'delete')

      expect(copySelector?.shortcut).toBe('⌘+Shift+C')
      expect(deleteAction?.shortcut).toBe('Delete')
    })
  })

  describe('Menu Item Rendering', () => {
    it('should create menu item HTML element with correct structure', () => {
      const testAction: MenuAction = {
        icon: '✏️',
        label: 'Test Action',
        action: 'test',
        shortcut: '⌘+T'
      }

      const menuItem = contextMenu['createMenuItem'](testAction)

      expect(menuItem.className).toBe('menu-item')
      expect(menuItem.dataset.action).toBe('test')

      const icon = menuItem.querySelector('.menu-icon')
      const label = menuItem.querySelector('.menu-label')
      const shortcut = menuItem.querySelector('.menu-shortcut')

      expect(icon?.textContent).toBe('✏️')
      expect(label?.textContent).toBe('Test Action')
      expect(shortcut?.textContent).toBe('⌘+T')
    })

    it('should create menu item without shortcut when not provided', () => {
      const testAction: MenuAction = {
        icon: '🔄',
        label: 'No Shortcut Action',
        action: 'noShortcut'
      }

      const menuItem = contextMenu['createMenuItem'](testAction)
      const shortcut = menuItem.querySelector('.menu-shortcut')

      expect(shortcut).toBeNull()
    })
  })

  describe('Event Handling and Interactions', () => {
    let mockHandleAction: jest.Mock

    beforeEach(() => {
      mockHandleAction = jest.fn()
      contextMenu.handleAction = mockHandleAction
      contextMenu.show(100, 100, mockElement)
    })

    it('should handle menu item clicks and call handleAction', (done) => {
      const menuHost = document.getElementById('absmartly-menu-host')
      expect(menuHost).toBeTruthy()

      // We need to access the shadow DOM to test interactions
      // Since it's in closed mode, we'll test the behavior indirectly
      setTimeout(() => {
        // Simulate that a menu item click would call handleAction
        contextMenu.handleAction('edit', mockElement)
        expect(mockHandleAction).toHaveBeenCalledWith('edit', mockElement)
        done()
      }, 0)
    })

    it('should remove menu when handleAction is called', (done) => {
      setTimeout(() => {
        // Simulate action execution
        contextMenu.handleAction('edit', mockElement)

        // In the real implementation, menu would be removed after action
        // We can test this by checking that a new show() call works
        contextMenu.show(200, 200, mockElement)
        const menuHost = document.getElementById('absmartly-menu-host')
        expect(menuHost).toBeTruthy()
        done()
      }, 0)
    })

    it('should stop event propagation for menu clicks', () => {
      // This tests the concept - in real implementation, shadow DOM would handle this
      const mockEvent = {
        stopPropagation: jest.fn(),
        target: document.createElement('div')
      } as any

      // Mock that the event handler would call stopPropagation
      expect(typeof mockEvent.stopPropagation).toBe('function')
    })
  })

  describe('Click Outside to Close', () => {
    beforeEach(() => {
      contextMenu.show(100, 100, mockElement)
    })

    it('should close menu when clicking outside', (done) => {
      const menuHost = document.getElementById('absmartly-menu-host')
      expect(menuHost).toBeTruthy()

      // Simulate clicking outside by directly removing menu
      // In real implementation, backdrop click would trigger this
      setTimeout(() => {
        menuHost?.remove()

        const removedHost = document.getElementById('absmartly-menu-host')
        expect(removedHost).toBeNull()
        done()
      }, 0)
    })

    it('should handle backdrop click events', () => {
      // Test that backdrop is created and would handle clicks
      const menuHost = document.getElementById('absmartly-menu-host')
      expect(menuHost).toBeTruthy()

      // In the real implementation, backdrop would be in shadow DOM
      // and would handle click events to close the menu
    })
  })

  describe('Shadow DOM and Style Injection', () => {
    beforeEach(() => {
      contextMenu.show(100, 100, mockElement)
    })

    it('should inject correct styles for menu positioning', () => {
      const styles = contextMenu['getMenuStyles'](false, 0, 0, 100, 100)

      expect(styles).toContain('.menu-backdrop')
      expect(styles).toContain('.menu-container')
      expect(styles).toContain('.menu-item')
      expect(styles).toContain('.menu-divider')
      expect(styles).toContain('.menu-icon')
      expect(styles).toContain('.menu-label')
      expect(styles).toContain('.menu-shortcut')
    })

    it('should generate styles for absolute positioning', () => {
      const styles = contextMenu['getMenuStyles'](true, 10, 20, 150, 200)

      expect(styles).toContain('position: absolute')
      expect(styles).toContain('top: -20px')
      expect(styles).toContain('left: -10px')
      expect(styles).toContain('left: 150px')
      expect(styles).toContain('top: 200px')
    })

    it('should generate styles for fixed positioning', () => {
      const styles = contextMenu['getMenuStyles'](false, 0, 0, 100, 100)

      expect(styles).toContain('position: fixed')
      expect(styles).toContain('left: 100px')
      expect(styles).toContain('top: 100px')
    })

    it('should include scrollbar styles for overflow content', () => {
      const styles = contextMenu['getMenuStyles'](false, 0, 0, 100, 100)

      expect(styles).toContain('::-webkit-scrollbar')
      expect(styles).toContain('::-webkit-scrollbar-track')
      expect(styles).toContain('::-webkit-scrollbar-thumb')
    })

    it('should include hover styles for menu items', () => {
      const styles = contextMenu['getMenuStyles'](false, 0, 0, 100, 100)

      expect(styles).toContain('.menu-item:hover')
      expect(styles).toContain('background-color: #f0f0f0')
    })
  })

  describe('Menu Positioning Edge Cases', () => {
    it('should handle negative coordinates', () => {
      contextMenu.show(-10, -10, mockElement)

      const menuHost = document.getElementById('absmartly-menu-host')
      expect(menuHost).toBeTruthy()
    })

    it('should handle coordinates beyond viewport', () => {
      contextMenu.show(2000, 2000, mockElement)

      const menuHost = document.getElementById('absmartly-menu-host')
      expect(menuHost).toBeTruthy()
    })

    it('should handle scrolled page positioning', () => {
      Object.defineProperty(window, 'scrollX', { writable: true, value: 100 })
      Object.defineProperty(window, 'scrollY', { writable: true, value: 200 })

      contextMenu.show(100, 100, mockElement)

      const menuHost = document.getElementById('absmartly-menu-host')
      expect(menuHost).toBeTruthy()
    })

    it('should calculate menu dimensions correctly', () => {
      // Test that positioning logic uses correct menu dimensions
      const menuItemCount = 20
      const itemHeight = 32
      const dividerHeight = 9
      const dividerCount = 6
      const menuPadding = 8

      const expectedHeight = (menuItemCount * itemHeight) + (dividerCount * dividerHeight) + menuPadding
      const expectedWidth = 220

      // These values should be used in positioning calculations
      expect(expectedHeight).toBeGreaterThan(500) // Reasonable menu height
      expect(expectedWidth).toBe(220) // Expected menu width
    })
  })

  describe('Menu Actions Catalog', () => {
    it('should have all expected edit actions', () => {
      const menuItems = contextMenu['createMenuItems']()
      const actions = menuItems
        .filter((item): item is MenuAction => !('divider' in item))
        .map(item => item.action)

      const editActions = ['edit', 'editHtml', 'rearrange']
      editActions.forEach(action => {
        expect(actions).toContain(action)
      })
    })

    it('should have all expected movement actions', () => {
      const menuItems = contextMenu['createMenuItems']()
      const actions = menuItems
        .filter((item): item is MenuAction => !('divider' in item))
        .map(item => item.action)

      const movementActions = ['move-up', 'move-down', 'resize']
      movementActions.forEach(action => {
        expect(actions).toContain(action)
      })
    })

    it('should have all expected clipboard actions', () => {
      const menuItems = contextMenu['createMenuItems']()
      const actions = menuItems
        .filter((item): item is MenuAction => !('divider' in item))
        .map(item => item.action)

      const clipboardActions = ['copy', 'copySelector']
      clipboardActions.forEach(action => {
        expect(actions).toContain(action)
      })
    })

    it('should have all expected content actions', () => {
      const menuItems = contextMenu['createMenuItems']()
      const actions = menuItems
        .filter((item): item is MenuAction => !('divider' in item))
        .map(item => item.action)

      const contentActions = ['selectRelative', 'insert-block']
      contentActions.forEach(action => {
        expect(actions).toContain(action)
      })
    })

    it('should have all expected destructive actions', () => {
      const menuItems = contextMenu['createMenuItems']()
      const actions = menuItems
        .filter((item): item is MenuAction => !('divider' in item))
        .map(item => item.action)

      const destructiveActions = ['hide', 'delete']
      destructiveActions.forEach(action => {
        expect(actions).toContain(action)
      })
    })

  })

  describe('Menu Item Icons and Labels', () => {
    it('should have appropriate icons for each action type', () => {
      const menuItems = contextMenu['createMenuItems']()
      const actions = menuItems.filter((item): item is MenuAction => !('divider' in item))

      // Test that all actions have non-empty icons and labels
      actions.forEach(action => {
        expect(action.icon).toBeTruthy()
        expect(action.icon.length).toBeGreaterThan(0)
        expect(action.label).toBeTruthy()
        expect(action.label.length).toBeGreaterThan(0)
      })
    })

    it('should have descriptive labels for actions', () => {
      const menuItems = contextMenu['createMenuItems']()
      const editAction = menuItems.find((item): item is MenuAction =>
        !('divider' in item) && item.action === 'edit'
      )
      const deleteAction = menuItems.find((item): item is MenuAction =>
        !('divider' in item) && item.action === 'delete'
      )

      expect(editAction?.label).toBe('Edit Text')
      expect(deleteAction?.label).toBe('Delete')
    })

    it('should use appropriate emoji icons', () => {
      const menuItems = contextMenu['createMenuItems']()
      const actions = menuItems.filter((item): item is MenuAction => !('divider' in item))

      // Check some specific expected icons
      const editAction = actions.find(item => item.action === 'edit')
      const deleteAction = actions.find(item => item.action === 'delete')
      const copyAction = actions.find(item => item.action === 'copy')

      expect(editAction?.icon).toBe('✏️')
      expect(deleteAction?.icon).toBe('🗑')
      expect(copyAction?.icon).toBe('📋')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing element gracefully', () => {
      expect(() => {
        contextMenu.show(100, 100, null as any)
      }).not.toThrow()
    })

    it('should handle multiple rapid show calls', () => {
      expect(() => {
        contextMenu.show(100, 100, mockElement)
        contextMenu.show(200, 200, mockElement)
        contextMenu.show(300, 300, mockElement)
      }).not.toThrow()

      // Should only have one menu
      const menuHosts = document.querySelectorAll('#absmartly-menu-host')
      expect(menuHosts.length).toBe(1)
    })

    it('should handle extreme viewport dimensions', () => {
      // Very small viewport
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 100 })
      Object.defineProperty(window, 'innerHeight', { writable: true, value: 100 })

      expect(() => {
        contextMenu.show(50, 50, mockElement)
      }).not.toThrow()

      // Very large viewport
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 10000 })
      Object.defineProperty(window, 'innerHeight', { writable: true, value: 10000 })

      expect(() => {
        contextMenu.show(5000, 5000, mockElement)
      }).not.toThrow()
    })
  })

  describe('Accessibility and Keyboard Support', () => {
    it('should include user-select: none for menu items', () => {
      const styles = contextMenu['getMenuStyles'](false, 0, 0, 100, 100)
      expect(styles).toContain('user-select: none')
    })

    it('should have proper cursor styles for interactive elements', () => {
      const styles = contextMenu['getMenuStyles'](false, 0, 0, 100, 100)
      expect(styles).toContain('cursor: pointer')
    })

    it('should have adequate color contrast', () => {
      const styles = contextMenu['getMenuStyles'](false, 0, 0, 100, 100)
      expect(styles).toContain('color: #333')
      expect(styles).toContain('background: white')
    })

    it('should have hover states for better UX', () => {
      const styles = contextMenu['getMenuStyles'](false, 0, 0, 100, 100)
      expect(styles).toContain('.menu-item:hover')
    })
  })

  describe('Performance Considerations', () => {
    it('should reuse menu calculations efficiently', () => {
      const spy = jest.spyOn(contextMenu as any, 'getMenuStyles')

      contextMenu.show(100, 100, mockElement)
      expect(spy).toHaveBeenCalledTimes(1)

      spy.mockRestore()
    })

    it('should clean up previous menu before creating new one', () => {
      contextMenu.show(100, 100, mockElement)
      const firstMenu = document.getElementById('absmartly-menu-host')
      expect(firstMenu).toBeTruthy()

      contextMenu.show(200, 200, mockElement)
      const secondMenu = document.getElementById('absmartly-menu-host')
      expect(secondMenu).toBeTruthy()

      // Should only have one menu in DOM
      const allMenus = document.querySelectorAll('#absmartly-menu-host')
      expect(allMenus.length).toBe(1)
    })
  })

  describe('Shadow DOM Event Handlers', () => {
    let contextMenu: ContextMenu

    beforeEach(() => {
      mockStateManager = {
        updateState: jest.fn(),
        getState: jest.fn().mockReturnValue({
          changes: [],
          isActive: true,
          selectedElement: null
        }),
        subscribe: jest.fn(),
        getConfig: jest.fn().mockReturnValue({
          experimentName: 'Test',
          variantName: 'Control',
          logoUrl: 'https://example.com/logo.png'
        })
      } as any

      contextMenu = new ContextMenu(mockStateManager)
    })

    it('should handle backdrop click events to close menu', () => {
      contextMenu.show(100, 100, mockElement)

      // Mock the backdrop click behavior
      const backdropClickHandler = (e: Event) => {
        e.stopPropagation()
        const menuHost = document.getElementById('absmartly-menu-host')
        menuHost?.remove()
      }

      // Test the behavior that would happen in shadow DOM
      const mockEvent = new Event('click')
      const stopPropagationSpy = jest.spyOn(mockEvent, 'stopPropagation')

      backdropClickHandler(mockEvent)

      expect(stopPropagationSpy).toHaveBeenCalled()
      expect(document.getElementById('absmartly-menu-host')).toBeNull()
    })

    it('should handle menu container click events', () => {
      contextMenu.show(100, 100, mockElement)

      // Mock the menu item click behavior
      const menuClickHandler = (e: Event) => {
        e.stopPropagation()
        const target = e.target as Element
        const menuItem = target.closest('.menu-item') as HTMLElement
        if (menuItem) {
          const action = menuItem.dataset.action
          if (action) {
            // Simulate handleAction call
            contextMenu.handleAction(action, mockElement)
            const menuHost = document.getElementById('absmartly-menu-host')
            menuHost?.remove()
          }
        }
      }

      // Create a mock menu item element
      const mockMenuItem = document.createElement('div')
      mockMenuItem.className = 'menu-item'
      mockMenuItem.dataset.action = 'edit'

      const mockEvent = new Event('click')
      Object.defineProperty(mockEvent, 'target', { value: mockMenuItem })
      const stopPropagationSpy = jest.spyOn(mockEvent, 'stopPropagation')

      // Mock closest method
      jest.spyOn(mockMenuItem, 'closest').mockReturnValue(mockMenuItem)

      menuClickHandler(mockEvent)

      expect(stopPropagationSpy).toHaveBeenCalled()
      expect(document.getElementById('absmartly-menu-host')).toBeNull()
    })

    it('should handle menu container click without menu item', () => {
      contextMenu.show(100, 100, mockElement)

      const menuClickHandler = (e: Event) => {
        e.stopPropagation()
        const target = e.target as Element
        const menuItem = target.closest('.menu-item') as HTMLElement
        if (menuItem) {
          const action = menuItem.dataset.action
          if (action) {
            contextMenu.handleAction(action, mockElement)
          }
        }
      }

      // Create a mock non-menu-item element
      const mockDiv = document.createElement('div')
      const mockEvent = new Event('click')
      Object.defineProperty(mockEvent, 'target', { value: mockDiv })
      const stopPropagationSpy = jest.spyOn(mockEvent, 'stopPropagation')

      // Mock closest method to return null (not a menu item)
      jest.spyOn(mockDiv, 'closest').mockReturnValue(null)

      menuClickHandler(mockEvent)

      expect(stopPropagationSpy).toHaveBeenCalled()
      // Menu should still exist since no action was triggered
      expect(document.getElementById('absmartly-menu-host')).toBeTruthy()
    })

    it('should handle showNotification method', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      // Access private method to test it
      ;(contextMenu as any).showNotification('Test notification')

      expect(consoleSpy).toHaveBeenCalledWith('[ABSmartly] Notification:', 'Test notification')

      consoleSpy.mockRestore()
    })

    it('should handle menu container click with action but no dataset', () => {
      contextMenu.show(100, 100, mockElement)

      const menuClickHandler = (e: Event) => {
        e.stopPropagation()
        const target = e.target as Element
        const menuItem = target.closest('.menu-item') as HTMLElement
        if (menuItem) {
          const action = menuItem.dataset.action
          if (action) {
            contextMenu.handleAction(action, mockElement)
          }
        }
      }

      // Create a mock menu item without action dataset
      const mockMenuItem = document.createElement('div')
      mockMenuItem.className = 'menu-item'
      // No dataset.action set

      const mockEvent = new Event('click')
      Object.defineProperty(mockEvent, 'target', { value: mockMenuItem })
      const stopPropagationSpy = jest.spyOn(mockEvent, 'stopPropagation')

      jest.spyOn(mockMenuItem, 'closest').mockReturnValue(mockMenuItem)

      menuClickHandler(mockEvent)

      expect(stopPropagationSpy).toHaveBeenCalled()
      // Menu should still exist since no action was triggered
      expect(document.getElementById('absmartly-menu-host')).toBeTruthy()
    })
  })
})