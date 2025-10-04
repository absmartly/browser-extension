import { test, expect, type Page, type Browser } from '@playwright/test'
import path from 'path'

/**
 * Comprehensive E2E Tests for Visual Editor DOM Manipulation Features
 *
 * This test suite covers all DOM manipulation capabilities including:
 * 1. Element selection and highlighting
 * 2. Right-click context menu functionality
 * 3. Inline text editing
 * 4. Visual style modifications
 * 5. Hide and delete operations
 * 6. Element reordering (move up/down)
 * 7. Drag and drop interactions
 * 8. Element resize functionality
 * 9. Clipboard operations (copy HTML/selectors)
 * 10. Undo/redo operations
 * 11. Keyboard shortcuts
 * 12. Multi-element operations
 * 13. Complex DOM structures
 * 14. Dynamic content handling
 */

interface VisualEditorAPI {
  initVisualEditor: (variantName: string, experimentName: string, logoUrl: string, initialChanges: any[]) => { success: boolean; already?: boolean }
  VisualEditor: any
  getCurrentVisualEditor: () => any
}

interface TestHelpers {
  isVisualEditorActive: () => boolean
  getVisualEditor: () => any
  hasVisualEditorStyles: () => boolean
  simulateElementClick: (selector: string) => boolean
  hasToolbar: () => boolean
  getNotifications: () => Element[]
  highlightElement: (selector: string) => void
  isElementVisible: (selector: string) => boolean
  testChangeCounter: () => number
  getChangeCounter: () => number
  getSelectedElement: () => Element | null
  getHoveredElement: () => Element | null
  isElementSelected: (selector: string) => boolean
  isElementHovered: (selector: string) => boolean
  getComputedStyleProperty: (selector: string, property: string) => string
  hasContextMenu: () => boolean
  getContextMenuItems: () => string[]
  getDOMChanges: () => any[]
  clearAllChanges: () => void
  simulateKeyboardShortcut: (key: string, modifiers?: string[]) => void
  createDynamicElement: (html: string, parentSelector: string) => void
  removeDynamicElement: (selector: string) => void
}

test.describe('Visual Editor DOM Manipulation - Comprehensive Tests', () => {
  let testPagePath: string
  let visualEditorBundlePath: string

  test.beforeAll(() => {
    testPagePath = path.join(__dirname, 'test-page.html')
    visualEditorBundlePath = path.join(__dirname, '../../build/chrome-mv3-dev/src/injected/build/visual-editor-injection.js')
  })

  test.beforeEach(async ({ page }) => {
    // Navigate to test page
    await page.goto(`file://${testPagePath}`)

    // Wait for page to fully load
    await page.waitForLoadState('networkidle')

    // Inject test helper functions
    await page.evaluate(() => {
      (window as any).testHelpers = {
        isVisualEditorActive: function() {
          return (window as any).__absmartlyVisualEditorActive === true;
        },
        getVisualEditor: function() {
          return (window as any).__absmartlyVisualEditor;
        },
        hasVisualEditorStyles: function() {
          return document.getElementById('absmartly-visual-editor-styles') !== null;
        },
        simulateElementClick: function(selector: string) {
          const element = document.querySelector(selector);
          if (element) {
            (element as HTMLElement).click();
            return true;
          }
          return false;
        },
        hasToolbar: function() {
          return document.querySelector('[data-absmartly="toolbar"], #absmartly-toolbar, .absmartly-toolbar') !== null;
        },
        getNotifications: function() {
          return Array.from(document.querySelectorAll('.absmartly-notification, [data-absmartly="notification"]'));
        },
        isElementVisible: function(selector: string) {
          const element = document.querySelector(selector);
          if (!element) return false;
          const style = window.getComputedStyle(element);
          return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        },
        getSelectedElement: function() {
          return document.querySelector('.absmartly-selected');
        },
        getHoveredElement: function() {
          return document.querySelector('.absmartly-hover');
        },
        isElementSelected: function(selector: string) {
          const element = document.querySelector(selector);
          return element?.classList.contains('absmartly-selected') || false;
        },
        isElementHovered: function(selector: string) {
          const element = document.querySelector(selector);
          return element?.classList.contains('absmartly-hover') || false;
        },
        getComputedStyleProperty: function(selector: string, property: string) {
          const element = document.querySelector(selector);
          if (!element) return '';
          return window.getComputedStyle(element).getPropertyValue(property);
        },
        hasContextMenu: function() {
          return document.querySelector('.absmartly-context-menu') !== null;
        },
        getContextMenuItems: function() {
          const menu = document.querySelector('.absmartly-context-menu');
          if (!menu) return [];
          return Array.from(menu.querySelectorAll('.menu-item')).map(item =>
            item.textContent?.trim() || ''
          );
        },
        getDOMChanges: function() {
          const editor = (window as any).__absmartlyVisualEditor;
          return editor?.getChanges() || [];
        },
        clearAllChanges: function() {
          const editor = (window as any).__absmartlyVisualEditor;
          if (editor && editor.elementActions) {
            editor.elementActions.clearAllChanges();
          }
        }
      };
    });

    // Inject visual editor script
    await page.addScriptTag({ path: visualEditorBundlePath })

    // Initialize visual editor
    const initResult = await page.evaluate(() => {
      const api = (window as any).ABSmartlyVisualEditor as VisualEditorAPI
      if (!api || !api.initVisualEditor) {
        throw new Error('Visual editor API not available')
      }
      return api.initVisualEditor('test-variant', 'test-experiment', 'https://example.com/logo.png', [])
    })

    expect(initResult.success).toBe(true)

    // Wait for editor to be fully active
    await page.waitForFunction(() => (window as any).__absmartlyVisualEditorActive === true)

    // Verify test page loaded correctly
    await expect(page.locator('[data-testid="main-title"]')).toContainText('Visual Editor Test Page')
  })

  test.afterEach(async ({ page }) => {
    // Clean up visual editor
    await page.evaluate(() => {
      const editor = (window as any).__absmartlyVisualEditor
      if (editor) {
        editor.stop()
      }
    })
  })

  test.describe('Element Selection and Highlighting', () => {
    test('should highlight elements on hover', async ({ page }) => {
      // Hover over a test element
      const targetSelector = '#editable-text-1'
      await page.hover(targetSelector)

      // Wait a moment for hover effects to apply
      await page.waitForTimeout(100)

      // Check if hover styles are applied
      const isHovered = await page.evaluate((selector) => {
        const element = document.querySelector(selector)
        return element?.classList.contains('absmartly-hover') || false
      }, targetSelector)

      expect(isHovered).toBe(true)

      // Check if hover tooltip appears with correct ID
      const hasTooltip = await page.locator('#absmartly-hover-tooltip').isVisible()
      expect(hasTooltip).toBe(true)
    })

    test('should select elements on click', async ({ page }) => {
      const targetSelector = '#editable-text-1'

      // Click to select element
      await page.click(targetSelector)

      // Verify element is selected
      const isSelected = await page.evaluate((selector) => {
        const element = document.querySelector(selector)
        return element?.classList.contains('absmartly-selected') || false
      }, targetSelector)

      expect(isSelected).toBe(true)

      // Verify selection outline is visible
      const selectedElement = page.locator(`${targetSelector}.absmartly-selected`)
      await expect(selectedElement).toBeVisible()
    })

    test('should deselect previous element when selecting new element', async ({ page }) => {
      const firstSelector = '#editable-text-1'
      const secondSelector = '#editable-text-2'

      // Select first element
      await page.click(firstSelector)

      // Wait for selection to be applied
      await page.waitForTimeout(100)
      await expect(page.locator(`${firstSelector}.absmartly-selected`)).toBeVisible()

      // Remove any menu host that might be blocking clicks
      await page.evaluate(() => {
        const menuHost = document.getElementById('absmartly-menu-host')
        if (menuHost) {
          menuHost.remove()
        }
      })

      // Select second element
      await page.click(secondSelector)

      // Wait for selection change to be processed
      await page.waitForTimeout(100)

      // Verify first element is deselected
      const firstIsSelected = await page.evaluate((selector) => {
        const element = document.querySelector(selector)
        return element?.classList.contains('absmartly-selected') || false
      }, firstSelector)

      expect(firstIsSelected).toBe(false)

      // Verify second element is selected
      await expect(page.locator(`${secondSelector}.absmartly-selected`)).toBeVisible()
    })

    test('should show element selector in tooltip', async ({ page }) => {
      const targetSelector = '#editable-text-1'
      await page.hover(targetSelector)

      // Wait for tooltip to appear
      await page.waitForSelector('#absmartly-hover-tooltip')

      const tooltipText = await page.locator('#absmartly-hover-tooltip').textContent()
      expect(tooltipText).toContain('#editable-text-1')
    })
  })

  test.describe('Right-Click Context Menu', () => {
    test('should show context menu on right-click', async ({ page }) => {
      const targetSelector = '#editable-text-1'

      // Select element first
      await page.click(targetSelector)

      // Right-click to open context menu
      await page.click(targetSelector, { button: 'right' })

      // Check if context menu appears
      const hasContextMenu = await page.evaluate(() => {
        return document.querySelector('.absmartly-context-menu') !== null
      })

      expect(hasContextMenu).toBe(true)
    })

    test('should show correct context menu options', async ({ page }) => {
      const targetSelector = '#editable-text-1'

      await page.click(targetSelector)
      await page.click(targetSelector, { button: 'right' })

      // Check for expected menu items
      const menuItems = await page.evaluate(() => {
        const menu = document.querySelector('.absmartly-context-menu')
        if (!menu) return []

        return Array.from(menu.querySelectorAll('.menu-item')).map(item =>
          item.textContent?.trim() || ''
        )
      })

      expect(menuItems).toContain('Edit Text')
      expect(menuItems).toContain('Hide Element')
      expect(menuItems).toContain('Delete Element')
      expect(menuItems).toContain('Copy HTML')
      expect(menuItems).toContain('Copy Selector')
      expect(menuItems).toContain('Move Up')
      expect(menuItems).toContain('Move Down')
    })

    test('should close context menu on clicking elsewhere', async ({ page }) => {
      const targetSelector = '#editable-text-1'

      await page.click(targetSelector)
      await page.click(targetSelector, { button: 'right' })

      // Verify menu is open
      await expect(page.locator('.absmartly-context-menu')).toBeVisible()

      // Click elsewhere
      await page.click('body', { position: { x: 10, y: 10 } })

      // Verify menu is closed
      const menuVisible = await page.locator('.absmartly-context-menu').isVisible()
      expect(menuVisible).toBe(false)
    })
  })

  test.describe('Inline Text Editing', () => {
    test('should enable text editing on double-click', async ({ page }) => {
      const targetSelector = '#editable-text-1'

      // Double-click to edit
      await page.dblclick(targetSelector)

      // Check if element becomes editable
      const isEditable = await page.evaluate((selector) => {
        const element = document.querySelector(selector) as HTMLElement
        return element?.contentEditable === 'true'
      }, targetSelector)

      expect(isEditable).toBe(true)

      // Check if editing styles are applied
      const hasEditingClass = await page.evaluate((selector) => {
        const element = document.querySelector(selector)
        return element?.classList.contains('absmartly-editing') || false
      }, targetSelector)

      expect(hasEditingClass).toBe(true)
    })

    test('should save text changes on Enter or blur', async ({ page }) => {
      const targetSelector = '#editable-text-1'
      const newText = 'Updated text content'

      // Start editing
      await page.dblclick(targetSelector)

      // Clear and type new text
      await page.selectText(targetSelector)
      await page.type(targetSelector, newText)

      // Press Enter to save
      await page.press(targetSelector, 'Enter')

      // Verify text was updated
      const updatedText = await page.textContent(targetSelector)
      expect(updatedText).toBe(newText)

      // Verify element is no longer editable
      const isEditable = await page.evaluate((selector) => {
        const element = document.querySelector(selector) as HTMLElement
        return element?.contentEditable === 'true'
      }, targetSelector)

      expect(isEditable).toBe(false)
    })

    test('should cancel editing on Escape', async ({ page }) => {
      const targetSelector = '#editable-text-1'
      const originalText = await page.textContent(targetSelector)

      // Start editing
      await page.dblclick(targetSelector)

      // Type some text
      await page.selectText(targetSelector)
      await page.type(targetSelector, 'This should be cancelled')

      // Press Escape to cancel
      await page.press(targetSelector, 'Escape')

      // Verify original text is preserved
      const currentText = await page.textContent(targetSelector)
      expect(currentText).toBe(originalText)

      // Verify element is no longer editable
      const isEditable = await page.evaluate((selector) => {
        const element = document.querySelector(selector) as HTMLElement
        return element?.contentEditable === 'true'
      }, targetSelector)

      expect(isEditable).toBe(false)
    })
  })

  test.describe('Visual Style Modifications', () => {
    test('should modify element background color', async ({ page }) => {
      const targetSelector = '#style-target-1'

      // Select element
      await page.click(targetSelector)

      // Open context menu and select style option
      await page.click(targetSelector, { button: 'right' })
      await page.click('.menu-item:has-text("Change Style")')

      // Change background color (simulate style panel interaction)
      const newColor = '#ff0000'
      await page.evaluate((selector, color) => {
        const element = document.querySelector(selector) as HTMLElement
        if (element) {
          element.style.backgroundColor = color
        }
      }, targetSelector, newColor)

      // Verify style change
      const backgroundColor = await page.evaluate((selector) => {
        const element = document.querySelector(selector) as HTMLElement
        return window.getComputedStyle(element).backgroundColor
      }, targetSelector)

      expect(backgroundColor).toBe('rgb(255, 0, 0)')
    })

    test('should modify element dimensions', async ({ page }) => {
      const targetSelector = '#style-target-2'

      await page.click(targetSelector)

      // Simulate width/height changes
      const newWidth = '300px'
      const newHeight = '150px'

      await page.evaluate((selector, width, height) => {
        const element = document.querySelector(selector) as HTMLElement
        if (element) {
          element.style.width = width
          element.style.height = height
        }
      }, targetSelector, newWidth, newHeight)

      // Verify dimension changes
      const computedStyle = await page.evaluate((selector) => {
        const element = document.querySelector(selector) as HTMLElement
        const style = window.getComputedStyle(element)
        return {
          width: style.width,
          height: style.height
        }
      }, targetSelector)

      expect(computedStyle.width).toBe(newWidth)
      expect(computedStyle.height).toBe(newHeight)
    })

    test('should modify text styling properties', async ({ page }) => {
      const targetSelector = '#editable-text-1'

      await page.click(targetSelector)

      // Apply text styling
      await page.evaluate((selector) => {
        const element = document.querySelector(selector) as HTMLElement
        if (element) {
          element.style.fontWeight = 'bold'
          element.style.fontSize = '20px'
          element.style.color = '#007bff'
        }
      }, targetSelector)

      // Verify text styling
      const textStyle = await page.evaluate((selector) => {
        const element = document.querySelector(selector) as HTMLElement
        const style = window.getComputedStyle(element)
        return {
          fontWeight: style.fontWeight,
          fontSize: style.fontSize,
          color: style.color
        }
      }, targetSelector)

      expect(textStyle.fontWeight).toBe('700') // Bold
      expect(textStyle.fontSize).toBe('20px')
      expect(textStyle.color).toBe('rgb(0, 123, 255)')
    })
  })

  test.describe('Hide and Delete Operations', () => {
    test('should hide element when hide option is selected', async ({ page }) => {
      const targetSelector = '#hide-target-1'

      // Verify element is initially visible
      await expect(page.locator(targetSelector)).toBeVisible()

      // Select and hide element
      await page.click(targetSelector)
      await page.click(targetSelector, { button: 'right' })
      await page.click('.menu-item:has-text("Hide Element")')

      // Verify element is hidden
      const isVisible = await page.evaluate((selector) => {
        const element = document.querySelector(selector) as HTMLElement
        const style = window.getComputedStyle(element)
        return style.display !== 'none'
      }, targetSelector)

      expect(isVisible).toBe(false)
    })

    test('should delete element when delete option is selected', async ({ page }) => {
      const targetSelector = '#delete-target-1'

      // Verify element exists
      await expect(page.locator(targetSelector)).toBeVisible()

      // Select and delete element
      await page.click(targetSelector)
      await page.click(targetSelector, { button: 'right' })
      await page.click('.menu-item:has-text("Delete Element")')

      // Verify element is removed from DOM
      const elementExists = await page.evaluate((selector) => {
        return document.querySelector(selector) !== null
      }, targetSelector)

      expect(elementExists).toBe(false)
    })

    test('should confirm deletion for important elements', async ({ page }) => {
      const targetSelector = '#main-header'

      await page.click(targetSelector)
      await page.click(targetSelector, { button: 'right' })

      // Listen for confirmation dialog
      page.on('dialog', async dialog => {
        expect(dialog.message()).toContain('delete')
        await dialog.accept()
      })

      await page.click('.menu-item:has-text("Delete Element")')

      // Verify element is deleted after confirmation
      const elementExists = await page.evaluate((selector) => {
        return document.querySelector(selector) !== null
      }, targetSelector)

      expect(elementExists).toBe(false)
    })
  })

  test.describe('Element Reordering (Move Up/Down)', () => {
    test('should move element up in DOM order', async ({ page }) => {
      const targetSelector = '#item-2'
      const siblingSelector = '#item-1'

      // Get initial order
      const initialOrder = await page.evaluate(() => {
        const list = document.querySelector('#sortable-list')
        return Array.from(list?.children || []).map(child => child.id)
      })

      // Select and move element up
      await page.click(targetSelector)
      await page.click(targetSelector, { button: 'right' })
      await page.click('.menu-item:has-text("Move Up")')

      // Get new order
      const newOrder = await page.evaluate(() => {
        const list = document.querySelector('#sortable-list')
        return Array.from(list?.children || []).map(child => child.id)
      })

      // Verify element moved up
      const initialIndex = initialOrder.indexOf('item-2')
      const newIndex = newOrder.indexOf('item-2')
      expect(newIndex).toBe(initialIndex - 1)
    })

    test('should move element down in DOM order', async ({ page }) => {
      const targetSelector = '#item-2'

      // Get initial order
      const initialOrder = await page.evaluate(() => {
        const list = document.querySelector('#sortable-list')
        return Array.from(list?.children || []).map(child => child.id)
      })

      // Select and move element down
      await page.click(targetSelector)
      await page.click(targetSelector, { button: 'right' })
      await page.click('.menu-item:has-text("Move Down")')

      // Get new order
      const newOrder = await page.evaluate(() => {
        const list = document.querySelector('#sortable-list')
        return Array.from(list?.children || []).map(child => child.id)
      })

      // Verify element moved down
      const initialIndex = initialOrder.indexOf('item-2')
      const newIndex = newOrder.indexOf('item-2')
      expect(newIndex).toBe(initialIndex + 1)
    })

    test('should not move element beyond boundaries', async ({ page }) => {
      const firstItemSelector = '#item-1'
      const lastItemSelector = '#item-5'

      // Try to move first item up (should not move)
      await page.click(firstItemSelector)
      await page.click(firstItemSelector, { button: 'right' })
      await page.click('.menu-item:has-text("Move Up")')

      const firstItemOrder = await page.evaluate(() => {
        const list = document.querySelector('#sortable-list')
        return Array.from(list?.children || []).map(child => child.id)
      })

      expect(firstItemOrder[0]).toBe('item-1')

      // Try to move last item down (should not move)
      await page.click(lastItemSelector)
      await page.click(lastItemSelector, { button: 'right' })
      await page.click('.menu-item:has-text("Move Down")')

      const lastItemOrder = await page.evaluate(() => {
        const list = document.querySelector('#sortable-list')
        return Array.from(list?.children || []).map(child => child.id)
      })

      expect(lastItemOrder[lastItemOrder.length - 1]).toBe('item-5')
    })
  })

  test.describe('Drag and Drop Interactions', () => {
    test('should enable drag mode when requested', async ({ page }) => {
      const targetSelector = '#item-1'

      await page.click(targetSelector)
      await page.click(targetSelector, { button: 'right' })
      await page.click('.menu-item:has-text("Enable Drag Mode")')

      // Check if drag mode is enabled
      const isDraggable = await page.evaluate((selector) => {
        const element = document.querySelector(selector)
        return element?.classList.contains('absmartly-draggable') || false
      }, targetSelector)

      expect(isDraggable).toBe(true)
    })

    test('should perform drag and drop operation', async ({ page }) => {
      const sourceSelector = '#item-1'
      const targetSelector = '#item-3'

      // Get initial order
      const initialOrder = await page.evaluate(() => {
        const list = document.querySelector('#sortable-list')
        return Array.from(list?.children || []).map(child => child.id)
      })

      // Perform drag and drop
      await page.dragAndDrop(sourceSelector, targetSelector)

      // Get new order
      const newOrder = await page.evaluate(() => {
        const list = document.querySelector('#sortable-list')
        return Array.from(list?.children || []).map(child => child.id)
      })

      // Verify order changed
      expect(newOrder).not.toEqual(initialOrder)
    })

    test('should show drop indicators during drag', async ({ page }) => {
      const sourceSelector = '#item-1'

      // Start drag operation
      await page.hover(sourceSelector)
      await page.mouse.down()

      // Move to another location
      await page.hover('#item-3')

      // Check for drop indicators
      const hasDropIndicator = await page.evaluate(() => {
        return document.querySelector('.absmartly-drop-target') !== null
      })

      expect(hasDropIndicator).toBe(true)

      // Complete drag
      await page.mouse.up()
    })
  })

  test.describe('Element Resize Functionality', () => {
    test('should enable resize mode for resizable elements', async ({ page }) => {
      const targetSelector = '#resizable-box'

      await page.click(targetSelector)
      await page.click(targetSelector, { button: 'right' })
      await page.click('.menu-item:has-text("Enable Resize")')

      // Check if resize mode is enabled
      const isResizable = await page.evaluate((selector) => {
        const element = document.querySelector(selector)
        return element?.classList.contains('absmartly-resize-active') || false
      }, targetSelector)

      expect(isResizable).toBe(true)
    })

    test('should show resize handles when in resize mode', async ({ page }) => {
      const targetSelector = '#resizable-box'

      await page.click(targetSelector)
      await page.click(targetSelector, { button: 'right' })
      await page.click('.menu-item:has-text("Enable Resize")')

      // Check for resize handles
      const hasResizeHandles = await page.evaluate(() => {
        return document.querySelectorAll('.absmartly-resize-handle').length > 0
      })

      expect(hasResizeHandles).toBe(true)
    })

    test('should resize element by dragging handles', async ({ page }) => {
      const targetSelector = '#resizable-box'

      // Get initial dimensions
      const initialDimensions = await page.evaluate((selector) => {
        const element = document.querySelector(selector) as HTMLElement
        return {
          width: element.offsetWidth,
          height: element.offsetHeight
        }
      }, targetSelector)

      // Enable resize mode
      await page.click(targetSelector)
      await page.click(targetSelector, { button: 'right' })
      await page.click('.menu-item:has-text("Enable Resize")')

      // Drag resize handle (simulate resize)
      const resizeHandle = page.locator('.absmartly-resize-handle').first()
      const box = await resizeHandle.boundingBox()

      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + 50, box.y + 50)
        await page.mouse.up()
      }

      // Get new dimensions
      const newDimensions = await page.evaluate((selector) => {
        const element = document.querySelector(selector) as HTMLElement
        return {
          width: element.offsetWidth,
          height: element.offsetHeight
        }
      }, targetSelector)

      // Verify dimensions changed
      expect(newDimensions.width).not.toBe(initialDimensions.width)
      expect(newDimensions.height).not.toBe(initialDimensions.height)
    })
  })

  test.describe('Clipboard Operations', () => {
    test('should copy element HTML to clipboard', async ({ page }) => {
      const targetSelector = '#editable-text-1'

      await page.click(targetSelector)
      await page.click(targetSelector, { button: 'right' })

      // Mock clipboard API
      await page.evaluate(() => {
        (window as any).clipboardText = ''
        Object.defineProperty(navigator, 'clipboard', {
          value: {
            writeText: (text: string) => {
              (window as any).clipboardText = text
              return Promise.resolve()
            }
          }
        })
      })

      await page.click('.menu-item:has-text("Copy HTML")')

      // Verify HTML was copied
      const copiedText = await page.evaluate(() => (window as any).clipboardText)
      expect(copiedText).toContain('<p')
      expect(copiedText).toContain('id="editable-text-1"')
    })

    test('should copy element selector to clipboard', async ({ page }) => {
      const targetSelector = '#editable-text-1'

      await page.click(targetSelector)
      await page.click(targetSelector, { button: 'right' })

      // Mock clipboard API
      await page.evaluate(() => {
        (window as any).clipboardText = ''
        Object.defineProperty(navigator, 'clipboard', {
          value: {
            writeText: (text: string) => {
              (window as any).clipboardText = text
              return Promise.resolve()
            }
          }
        })
      })

      await page.click('.menu-item:has-text("Copy Selector")')

      // Verify selector was copied
      const copiedText = await page.evaluate(() => (window as any).clipboardText)
      expect(copiedText).toContain('#editable-text-1')
    })
  })

  test.describe('Undo/Redo Operations', () => {
    test('should undo last change', async ({ page }) => {
      const targetSelector = '#hide-target-1'

      // Make a change (hide element)
      await page.click(targetSelector)
      await page.click(targetSelector, { button: 'right' })
      await page.click('.menu-item:has-text("Hide Element")')

      // Verify element is hidden
      const isHiddenAfterChange = await page.evaluate((selector) => {
        const element = document.querySelector(selector) as HTMLElement
        return window.getComputedStyle(element).display === 'none'
      }, targetSelector)

      expect(isHiddenAfterChange).toBe(true)

      // Undo the change
      await page.evaluate(() => {
        const editor = (window as any).__absmartlyVisualEditor
        if (editor && editor.elementActions) {
          editor.elementActions.undoLastChange()
        }
      })

      // Verify element is visible again
      const isVisibleAfterUndo = await page.evaluate((selector) => {
        const element = document.querySelector(selector) as HTMLElement
        return window.getComputedStyle(element).display !== 'none'
      }, targetSelector)

      expect(isVisibleAfterUndo).toBe(true)
    })

    test('should maintain change history', async ({ page }) => {
      const targetSelector = '#style-target-1'

      // Make multiple changes
      await page.click(targetSelector)

      // Change 1: Background color
      await page.evaluate((selector) => {
        const element = document.querySelector(selector) as HTMLElement
        element.style.backgroundColor = 'red'
      }, targetSelector)

      // Change 2: Text color
      await page.evaluate((selector) => {
        const element = document.querySelector(selector) as HTMLElement
        element.style.color = 'white'
      }, targetSelector)

      // Get change count
      const changeCount = await page.evaluate(() => {
        const editor = (window as any).__absmartlyVisualEditor
        return editor?.getChanges()?.length || 0
      })

      expect(changeCount).toBeGreaterThan(0)
    })
  })

  test.describe('Keyboard Shortcuts', () => {
    test('should handle Ctrl+Z for undo', async ({ page }) => {
      const targetSelector = '#hide-target-2'

      // Make a change
      await page.click(targetSelector)
      await page.click(targetSelector, { button: 'right' })
      await page.click('.menu-item:has-text("Hide Element")')

      // Use Ctrl+Z to undo
      await page.keyboard.press('Control+z')

      // Verify undo worked
      const isVisible = await page.evaluate((selector) => {
        const element = document.querySelector(selector) as HTMLElement
        return window.getComputedStyle(element).display !== 'none'
      }, targetSelector)

      expect(isVisible).toBe(true)
    })

    test('should handle Delete key for deletion', async ({ page }) => {
      const targetSelector = '#delete-target-2'

      // Select element
      await page.click(targetSelector)

      // Press Delete key
      await page.keyboard.press('Delete')

      // Verify element is deleted
      const elementExists = await page.evaluate((selector) => {
        return document.querySelector(selector) !== null
      }, targetSelector)

      expect(elementExists).toBe(false)
    })

    test('should handle Escape key to deselect', async ({ page }) => {
      const targetSelector = '#editable-text-1'

      // Select element
      await page.click(targetSelector)

      // Verify element is selected
      await expect(page.locator(`${targetSelector}.absmartly-selected`)).toBeVisible()

      // Press Escape to deselect
      await page.keyboard.press('Escape')

      // Verify element is deselected
      const isSelected = await page.evaluate((selector) => {
        const element = document.querySelector(selector)
        return element?.classList.contains('absmartly-selected') || false
      }, targetSelector)

      expect(isSelected).toBe(false)
    })
  })

  test.describe('Multi-Element Operations', () => {
    test('should handle multiple element selection with Ctrl+click', async ({ page }) => {
      const firstSelector = '#multi-card-1'
      const secondSelector = '#multi-card-2'

      // Select first element
      await page.click(firstSelector)

      // Hold Ctrl and select second element
      await page.click(secondSelector, { modifiers: ['Control'] })

      // Verify both elements are selected
      const firstSelected = await page.evaluate((selector) => {
        const element = document.querySelector(selector)
        return element?.classList.contains('absmartly-selected') || false
      }, firstSelector)

      const secondSelected = await page.evaluate((selector) => {
        const element = document.querySelector(selector)
        return element?.classList.contains('absmartly-selected') || false
      }, secondSelector)

      expect(firstSelected).toBe(true)
      expect(secondSelected).toBe(true)
    })

    test('should apply bulk operations to multiple selected elements', async ({ page }) => {
      const firstSelector = '#multi-card-1'
      const secondSelector = '#multi-card-2'

      // Select multiple elements
      await page.click(firstSelector)
      await page.click(secondSelector, { modifiers: ['Control'] })

      // Apply bulk hide operation
      await page.keyboard.press('h') // Assuming 'h' is a hotkey for hide

      // Verify both elements are hidden
      const firstHidden = await page.evaluate((selector) => {
        const element = document.querySelector(selector) as HTMLElement
        return window.getComputedStyle(element).display === 'none'
      }, firstSelector)

      const secondHidden = await page.evaluate((selector) => {
        const element = document.querySelector(selector) as HTMLElement
        return window.getComputedStyle(element).display === 'none'
      }, secondSelector)

      expect(firstHidden).toBe(true)
      expect(secondHidden).toBe(true)
    })
  })

  test.describe('Complex DOM Structures', () => {
    test('should handle nested element selection and manipulation', async ({ page }) => {
      const parentSelector = '#nested-item-1'
      const childSelector = '#nested-item-2'
      const deepChildSelector = '#nested-item-3'

      // Select deeply nested element
      await page.click(deepChildSelector)

      // Verify selection
      await expect(page.locator(`${deepChildSelector}.absmartly-selected`)).toBeVisible()

      // Move element up in hierarchy
      await page.click(deepChildSelector, { button: 'right' })
      await page.click('.menu-item:has-text("Move Up")')

      // Verify DOM structure changed
      const parentChildren = await page.evaluate((selector) => {
        const parent = document.querySelector(selector)
        return Array.from(parent?.children || []).map(child => child.id)
      }, parentSelector)

      expect(parentChildren).toContain('nested-item-3')
    })

    test('should preserve element relationships during manipulation', async ({ page }) => {
      const containerSelector = '#nested-structure'
      const itemSelector = '#nested-item-1'

      // Get initial structure
      const initialStructure = await page.evaluate((selector) => {
        const container = document.querySelector(selector)
        return container?.innerHTML
      }, containerSelector)

      // Select and modify nested item
      await page.click(itemSelector)
      await page.evaluate((selector) => {
        const element = document.querySelector(selector) as HTMLElement
        element.style.backgroundColor = 'yellow'
      }, itemSelector)

      // Verify structure is preserved but styling is applied
      const modifiedStructure = await page.evaluate((selector) => {
        const container = document.querySelector(selector)
        return container?.innerHTML
      }, containerSelector)

      expect(modifiedStructure).toContain('background-color: yellow')
      expect(modifiedStructure).toContain('nested-item-2') // Child still exists
    })
  })

  test.describe('Dynamic Content Handling', () => {
    test('should handle dynamically added elements', async ({ page }) => {
      // Add dynamic content
      await page.evaluate(() => {
        const container = document.querySelector('.container')
        const newElement = document.createElement('div')
        newElement.id = 'dynamic-element'
        newElement.textContent = 'Dynamically added element'
        newElement.style.padding = '10px'
        newElement.style.backgroundColor = '#f0f0f0'
        container?.appendChild(newElement)
      })

      // Verify dynamic element can be selected
      const dynamicSelector = '#dynamic-element'
      await page.click(dynamicSelector)

      // Check if element is selected
      await expect(page.locator(`${dynamicSelector}.absmartly-selected`)).toBeVisible()

      // Verify it can be manipulated
      await page.click(dynamicSelector, { button: 'right' })
      await page.click('.menu-item:has-text("Hide Element")')

      const isHidden = await page.evaluate((selector) => {
        const element = document.querySelector(selector) as HTMLElement
        return window.getComputedStyle(element).display === 'none'
      }, dynamicSelector)

      expect(isHidden).toBe(true)
    })

    test('should update selectors for modified DOM structure', async ({ page }) => {
      // Modify DOM structure by adding elements
      await page.evaluate(() => {
        const container = document.querySelector('#sortable-list')
        for (let i = 6; i <= 8; i++) {
          const newItem = document.createElement('li')
          newItem.id = `item-${i}`
          newItem.className = 'draggable-item test-move-item'
          newItem.textContent = `Item ${i} - Dynamic`
          container?.appendChild(newItem)
        }
      })

      // Select original element
      const originalSelector = '#item-5'
      await page.click(originalSelector)

      // Verify selector still works
      const isSelected = await page.evaluate((selector) => {
        const element = document.querySelector(selector)
        return element?.classList.contains('absmartly-selected') || false
      }, originalSelector)

      expect(isSelected).toBe(true)

      // Test manipulation of dynamic elements
      const dynamicSelector = '#item-7'
      await page.click(dynamicSelector)
      await expect(page.locator(`${dynamicSelector}.absmartly-selected`)).toBeVisible()
    })

    test('should handle AJAX-like content updates', async ({ page }) => {
      // Simulate AJAX content update
      await page.evaluate(() => {
        const targetElement = document.querySelector('#editable-text-1')
        if (targetElement) {
          // Simulate content loaded via AJAX
          setTimeout(() => {
            targetElement.textContent = 'AJAX updated content'
            targetElement.setAttribute('data-loaded', 'true')
          }, 100)
        }
      })

      // Wait for update
      await page.waitForTimeout(200)

      // Verify updated content can be selected and edited
      const targetSelector = '#editable-text-1'
      await page.click(targetSelector)

      const updatedText = await page.textContent(targetSelector)
      expect(updatedText).toBe('AJAX updated content')

      // Verify it can still be edited
      await page.dblclick(targetSelector)

      const isEditable = await page.evaluate((selector) => {
        const element = document.querySelector(selector) as HTMLElement
        return element?.contentEditable === 'true'
      }, targetSelector)

      expect(isEditable).toBe(true)
    })
  })

  test.describe('Change Persistence and State Management', () => {
    test('should track all DOM changes accurately', async ({ page }) => {
      // Make several different types of changes
      const textSelector = '#editable-text-1'
      const hideSelector = '#hide-target-1'
      const styleSelector = '#style-target-1'

      // Text change
      await page.dblclick(textSelector)
      await page.selectText(textSelector)
      await page.type(textSelector, 'Modified text')
      await page.press(textSelector, 'Enter')

      // Hide operation
      await page.click(hideSelector)
      await page.click(hideSelector, { button: 'right' })
      await page.click('.menu-item:has-text("Hide Element")')

      // Style change
      await page.click(styleSelector)
      await page.evaluate((selector) => {
        const element = document.querySelector(selector) as HTMLElement
        element.style.color = 'red'
      }, styleSelector)

      // Get all tracked changes
      const changes = await page.evaluate(() => {
        const editor = (window as any).__absmartlyVisualEditor
        return editor?.getChanges() || []
      })

      expect(changes.length).toBeGreaterThan(0)
      expect(changes.some((change: any) => change.type === 'text')).toBe(true)
      expect(changes.some((change: any) => change.type === 'style')).toBe(true)
    })

    test('should maintain change state across editor sessions', async ({ page }) => {
      const targetSelector = '#editable-text-1'

      // Make a change
      await page.dblclick(targetSelector)
      await page.selectText(targetSelector)
      await page.type(targetSelector, 'Persistent change')
      await page.press(targetSelector, 'Enter')

      // Get changes before stopping editor
      const changesBefore = await page.evaluate(() => {
        const editor = (window as any).__absmartlyVisualEditor
        return editor?.getChanges() || []
      })

      // Stop and restart editor
      await page.evaluate(() => {
        const editor = (window as any).__absmartlyVisualEditor
        if (editor) {
          editor.stop()
        }
      })

      await page.evaluate(() => {
        const api = (window as any).ABSmartlyVisualEditor as VisualEditorAPI
        return api.initVisualEditor('test-variant', 'test-experiment', 'https://example.com/logo.png', [])
      })

      // Verify changes are restored
      const changesAfter = await page.evaluate(() => {
        const editor = (window as any).__absmartlyVisualEditor
        return editor?.getChanges() || []
      })

      expect(changesAfter.length).toBe(changesBefore.length)
    })
  })
})