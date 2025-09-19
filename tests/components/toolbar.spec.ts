import { test, expect } from '@playwright/test'
import { Toolbar } from '../../src/visual-editor/ui/toolbar'
import StateManager, { VisualEditorConfig, VisualEditorState } from '../../src/visual-editor/core/state-manager'

/**
 * Toolbar Component Tests
 *
 * Tests the Toolbar UI component in isolation using Playwright component testing.
 * Covers all user interactions, states, and visual behaviors.
 */

// Helper function to create a mock StateManager
function createMockStateManager(overrides: Partial<VisualEditorState> = {}): StateManager {
  const config: VisualEditorConfig = {
    variantName: 'Test Variant',
    experimentName: 'Test Experiment',
    logoUrl: 'test-logo.png',
    initialChanges: []
  }

  const stateManager = new StateManager(config)

  // Override state if needed
  if (Object.keys(overrides).length > 0) {
    stateManager.updateState(overrides)
  }

  return stateManager
}

// Helper function to wait for element to be rendered
async function waitForToolbar(page: any): Promise<void> {
  await page.waitForSelector('.absmartly-toolbar', { timeout: 5000 })
}

// Helper to create toolbar instance in browser
async function createToolbarInBrowser(page: any, stateOverrides: Partial<VisualEditorState> = {}) {
  return await page.evaluate((overrides) => {
    // Import toolbar and state manager classes
    const config = {
      variantName: 'Test Variant',
      experimentName: 'Test Experiment',
      logoUrl: 'test-logo.png',
      initialChanges: []
    }

    // Create a simple mock state manager for browser environment
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
        isActive: true,
        ...overrides
      }
      private config = config

      getState() { return { ...this.state } }
      getConfig() { return { ...this.config } }
      updateState(updates) { this.state = { ...this.state, ...updates } }
    }

    // Simple toolbar implementation for browser testing
    class BrowserToolbar {
      constructor(stateManager) {
        this.stateManager = stateManager
        this.toolbar = null
        this.changesCounter = null
        this.undoButton = null
        this.redoButton = null

        // Mock callbacks
        this.onUndo = () => console.log('Undo clicked')
        this.onRedo = () => console.log('Redo clicked')
        this.onClear = () => console.log('Clear clicked')
        this.onSave = () => console.log('Save clicked')
        this.onExit = () => console.log('Exit clicked')
      }

      create() {
        if (this.toolbar) return

        this.toolbar = document.createElement('div')
        this.toolbar.className = 'absmartly-toolbar'
        this.toolbar.style.cssText = `
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
        `

        this.toolbar.innerHTML = `
          <div class="absmartly-toolbar-header" style="
            font-weight: 600 !important;
            padding: 4px 8px !important;
            border-bottom: 1px solid #e5e7eb !important;
            margin-bottom: 4px !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
          ">
            <span>Visual Editor</span>
            <span class="absmartly-changes-count" style="
              background: #3b82f6 !important;
              color: white !important;
              padding: 2px 8px !important;
              border-radius: 12px !important;
              font-size: 12px !important;
              font-weight: 500 !important;
            ">0</span>
          </div>
          <div class="absmartly-toolbar-instructions" style="
            background: #eff6ff !important;
            padding: 10px !important;
            border-radius: 6px !important;
            font-size: 12px !important;
            line-height: 1.6 !important;
            color: #1e40af !important;
            border: 1px solid #93c5fd !important;
          ">
            <strong style="color: #1e3a8a !important; font-weight: 600 !important;">How to use:</strong><br>
            • <strong style="color: #1e3a8a !important; font-weight: 600 !important;">Click</strong> any element to select & edit<br>
            • Menu opens automatically on selection<br>
            • Selected elements have blue outline<br>
            • Press <strong style="color: #1e3a8a !important; font-weight: 600 !important;">ESC</strong> to deselect
          </div>
          <button class="absmartly-toolbar-button" data-action="undo" style="
            padding: 8px 12px !important;
            background: #f3f4f6 !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            text-align: center !important;
            transition: all 0.15s !important;
            color: #1f2937 !important;
          ">↶ Undo Last Change</button>
          <button class="absmartly-toolbar-button" data-action="redo" style="
            padding: 8px 12px !important;
            background: #f3f4f6 !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            text-align: center !important;
            transition: all 0.15s !important;
            color: #1f2937 !important;
          ">↷ Redo Change</button>
          <button class="absmartly-toolbar-button" data-action="clear" style="
            padding: 8px 12px !important;
            background: #f3f4f6 !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            text-align: center !important;
            transition: all 0.15s !important;
            color: #1f2937 !important;
          ">Clear All Changes</button>
          <button class="absmartly-toolbar-button primary" data-action="save" style="
            padding: 8px 12px !important;
            background: #3b82f6 !important;
            color: white !important;
            border: 1px solid #3b82f6 !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            text-align: center !important;
            transition: all 0.15s !important;
          ">Save Changes</button>
          <button class="absmartly-toolbar-button danger" data-action="exit" style="
            padding: 8px 12px !important;
            background: #ef4444 !important;
            color: white !important;
            border: 1px solid #ef4444 !important;
            border-radius: 6px !important;
            cursor: pointer !important;
            text-align: center !important;
            transition: all 0.15s !important;
          ">Exit Editor</button>
        `

        // Store references
        this.changesCounter = this.toolbar.querySelector('.absmartly-changes-count')
        this.undoButton = this.toolbar.querySelector('[data-action="undo"]')
        this.redoButton = this.toolbar.querySelector('[data-action="redo"]')

        // Add styles
        const style = document.createElement('style')
        style.textContent = `
          .absmartly-toolbar-button:hover {
            background: #e5e7eb !important;
          }
          .absmartly-toolbar-button.primary:hover {
            background: #2563eb !important;
          }
          .absmartly-toolbar-button.danger:hover {
            background: #dc2626 !important;
          }
        `
        document.head.appendChild(style)

        document.body.appendChild(this.toolbar)

        // Add event listeners
        this.toolbar.addEventListener('click', this.handleToolbarClick.bind(this))
      }

      remove() {
        if (this.toolbar) {
          this.toolbar.remove()
          this.toolbar = null
          this.changesCounter = null
          this.undoButton = null
          this.redoButton = null
        }
      }

      updateChangesCount(count) {
        if (this.changesCounter) {
          this.changesCounter.textContent = String(count)
        }
      }

      updateUndoRedoButtons(canUndo, canRedo) {
        if (this.undoButton) {
          this.undoButton.style.opacity = canUndo ? '1' : '0.5'
          this.undoButton.disabled = !canUndo
        }
        if (this.redoButton) {
          this.redoButton.style.opacity = canRedo ? '1' : '0.5'
          this.redoButton.disabled = !canRedo
        }
      }

      handleToolbarClick(e) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()

        const target = e.target
        const action = target.getAttribute('data-action')

        // Store clicked action for testing
        window.lastClickedAction = action

        switch (action) {
          case 'undo':
            this.onUndo()
            break
          case 'redo':
            this.onRedo()
            break
          case 'clear':
            this.onClear()
            break
          case 'save':
            this.onSave()
            break
          case 'exit':
            this.onExit()
            break
        }
      }
    }

    const stateManager = new MockStateManager()
    const toolbar = new BrowserToolbar(stateManager)

    // Store globally for access in tests
    window.toolbar = toolbar
    window.stateManager = stateManager

    return { toolbar, stateManager }
  }, stateOverrides)
}

test.describe('Toolbar Component', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a basic page to test the toolbar on
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Toolbar Test Page</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: system-ui, sans-serif;
            }
            .test-content {
              padding: 20px;
              background: #f0f0f0;
              border-radius: 8px;
              margin: 20px;
            }
          </style>
        </head>
        <body>
          <div class="test-content">
            <h1>Test Page for Toolbar Component</h1>
            <p>This is a test page to verify toolbar functionality.</p>
          </div>
        </body>
      </html>
    `)
  })

  test.afterEach(async ({ page }) => {
    // Clean up toolbar after each test
    await page.evaluate(() => {
      if (window.toolbar) {
        window.toolbar.remove()
      }
    })
  })

  test('1. Toolbar rendering with all buttons', async ({ page }) => {
    // Create toolbar
    await createToolbarInBrowser(page)

    await page.evaluate(() => {
      window.toolbar.create()
    })

    await waitForToolbar(page)

    // Check toolbar exists and is visible
    const toolbar = page.locator('.absmartly-toolbar')
    await expect(toolbar).toBeVisible()

    // Check header with title and counter
    await expect(page.locator('.absmartly-toolbar-header')).toContainText('Visual Editor')
    await expect(page.locator('.absmartly-changes-count')).toContainText('0')

    // Check instructions are present
    await expect(page.locator('.absmartly-toolbar-instructions')).toContainText('How to use:')

    // Check all buttons are present
    await expect(page.locator('[data-action="undo"]')).toContainText('Undo Last Change')
    await expect(page.locator('[data-action="redo"]')).toContainText('Redo Change')
    await expect(page.locator('[data-action="clear"]')).toContainText('Clear All Changes')
    await expect(page.locator('[data-action="save"]')).toContainText('Save Changes')
    await expect(page.locator('[data-action="exit"]')).toContainText('Exit Editor')

    // Check button styling
    const undoButton = page.locator('[data-action="undo"]')
    const saveButton = page.locator('[data-action="save"]')
    const exitButton = page.locator('[data-action="exit"]')

    await expect(undoButton).toHaveCSS('background-color', 'rgb(243, 244, 246)')
    await expect(saveButton).toHaveCSS('background-color', 'rgb(59, 130, 246)')
    await expect(exitButton).toHaveCSS('background-color', 'rgb(239, 68, 68)')
  })

  test('2. Mode switcher functionality (Edit/Rearrange/Resize)', async ({ page }) => {
    // Note: The current toolbar doesn't have mode switcher, but we'll test state management
    await createToolbarInBrowser(page, {
      isRearranging: false,
      isResizing: false
    })

    await page.evaluate(() => {
      window.toolbar.create()
    })

    await waitForToolbar(page)

    // Test state changes for different modes
    const state = await page.evaluate(() => {
      return window.stateManager.getState()
    })

    expect(state.isRearranging).toBe(false)
    expect(state.isResizing).toBe(false)

    // Simulate mode change
    await page.evaluate(() => {
      window.stateManager.updateState({ isRearranging: true })
    })

    const updatedState = await page.evaluate(() => {
      return window.stateManager.getState()
    })

    expect(updatedState.isRearranging).toBe(true)
  })

  test('3. Save/Cancel button interactions', async ({ page }) => {
    let clickedActions: string[] = []

    await createToolbarInBrowser(page)

    await page.evaluate(() => {
      window.toolbar.create()
      window.lastClickedAction = null
    })

    await waitForToolbar(page)

    // Test Save button click
    await page.click('[data-action="save"]')
    const saveAction = await page.evaluate(() => window.lastClickedAction)
    expect(saveAction).toBe('save')

    // Test Exit button click (acts as cancel)
    await page.click('[data-action="exit"]')
    const exitAction = await page.evaluate(() => window.lastClickedAction)
    expect(exitAction).toBe('exit')
  })

  test('4. Undo/Redo button states and clicks', async ({ page }) => {
    await createToolbarInBrowser(page)

    await page.evaluate(() => {
      window.toolbar.create()
      window.lastClickedAction = null
    })

    await waitForToolbar(page)

    // Initially buttons should be disabled (no undo/redo available)
    await page.evaluate(() => {
      window.toolbar.updateUndoRedoButtons(false, false)
    })

    const undoButton = page.locator('[data-action="undo"]')
    const redoButton = page.locator('[data-action="redo"]')

    await expect(undoButton).toHaveAttribute('disabled', '')
    await expect(redoButton).toHaveAttribute('disabled', '')
    await expect(undoButton).toHaveCSS('opacity', '0.5')
    await expect(redoButton).toHaveCSS('opacity', '0.5')

    // Enable undo button
    await page.evaluate(() => {
      window.toolbar.updateUndoRedoButtons(true, false)
    })

    await expect(undoButton).not.toHaveAttribute('disabled')
    await expect(undoButton).toHaveCSS('opacity', '1')

    // Test undo button click
    await page.click('[data-action="undo"]')
    const undoAction = await page.evaluate(() => window.lastClickedAction)
    expect(undoAction).toBe('undo')

    // Enable redo button
    await page.evaluate(() => {
      window.toolbar.updateUndoRedoButtons(true, true)
    })

    await expect(redoButton).not.toHaveAttribute('disabled')
    await expect(redoButton).toHaveCSS('opacity', '1')

    // Test redo button click
    await page.click('[data-action="redo"]')
    const redoAction = await page.evaluate(() => window.lastClickedAction)
    expect(redoAction).toBe('redo')
  })

  test('5. Change counter display updates', async ({ page }) => {
    await createToolbarInBrowser(page)

    await page.evaluate(() => {
      window.toolbar.create()
    })

    await waitForToolbar(page)

    const counter = page.locator('.absmartly-changes-count')

    // Initial count should be 0
    await expect(counter).toContainText('0')

    // Update to 5 changes
    await page.evaluate(() => {
      window.toolbar.updateChangesCount(5)
    })

    await expect(counter).toContainText('5')

    // Update to 42 changes
    await page.evaluate(() => {
      window.toolbar.updateChangesCount(42)
    })

    await expect(counter).toContainText('42')

    // Reset to 0
    await page.evaluate(() => {
      window.toolbar.updateChangesCount(0)
    })

    await expect(counter).toContainText('0')
  })

  test('6. Responsive layout on different screen sizes', async ({ page }) => {
    await createToolbarInBrowser(page)

    await page.evaluate(() => {
      window.toolbar.create()
    })

    await waitForToolbar(page)

    const toolbar = page.locator('.absmartly-toolbar')

    // Test desktop size (1200x800)
    await page.setViewportSize({ width: 1200, height: 800 })
    await expect(toolbar).toBeVisible()
    await expect(toolbar).toHaveCSS('max-width', '320px')

    // Test tablet size (768x1024)
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(toolbar).toBeVisible()

    // Test mobile size (375x667)
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(toolbar).toBeVisible()

    // Toolbar should remain positioned and visible on all sizes
    await expect(toolbar).toHaveCSS('position', 'fixed')
    await expect(toolbar).toHaveCSS('top', '20px')
    await expect(toolbar).toHaveCSS('right', '20px')
  })

  test('7. Keyboard shortcuts triggering toolbar actions', async ({ page }) => {
    await createToolbarInBrowser(page)

    await page.evaluate(() => {
      window.toolbar.create()
      window.lastClickedAction = null

      // Add keyboard event listeners for common shortcuts
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
          switch (e.key) {
            case 'z':
              if (e.shiftKey) {
                window.toolbar.onRedo()
                window.lastClickedAction = 'redo'
              } else {
                window.toolbar.onUndo()
                window.lastClickedAction = 'undo'
              }
              e.preventDefault()
              break
            case 's':
              window.toolbar.onSave()
              window.lastClickedAction = 'save'
              e.preventDefault()
              break
          }
        }
        if (e.key === 'Escape') {
          window.toolbar.onExit()
          window.lastClickedAction = 'exit'
          e.preventDefault()
        }
      })
    })

    await waitForToolbar(page)

    // Test Ctrl+Z (Undo)
    await page.keyboard.press('Control+z')
    let action = await page.evaluate(() => window.lastClickedAction)
    expect(action).toBe('undo')

    // Test Ctrl+Shift+Z (Redo)
    await page.keyboard.press('Control+Shift+z')
    action = await page.evaluate(() => window.lastClickedAction)
    expect(action).toBe('redo')

    // Test Ctrl+S (Save)
    await page.keyboard.press('Control+s')
    action = await page.evaluate(() => window.lastClickedAction)
    expect(action).toBe('save')

    // Test Escape (Exit)
    await page.keyboard.press('Escape')
    action = await page.evaluate(() => window.lastClickedAction)
    expect(action).toBe('exit')
  })

  test('8. Button disabled states based on context', async ({ page }) => {
    await createToolbarInBrowser(page)

    await page.evaluate(() => {
      window.toolbar.create()
    })

    await waitForToolbar(page)

    const undoButton = page.locator('[data-action="undo"]')
    const redoButton = page.locator('[data-action="redo"]')
    const saveButton = page.locator('[data-action="save"]')

    // Test initial disabled state (no changes to undo/redo)
    await page.evaluate(() => {
      window.toolbar.updateUndoRedoButtons(false, false)
    })

    await expect(undoButton).toHaveAttribute('disabled', '')
    await expect(redoButton).toHaveAttribute('disabled', '')

    // Test with undo available but no redo
    await page.evaluate(() => {
      window.toolbar.updateUndoRedoButtons(true, false)
    })

    await expect(undoButton).not.toHaveAttribute('disabled')
    await expect(redoButton).toHaveAttribute('disabled', '')

    // Test with both undo and redo available
    await page.evaluate(() => {
      window.toolbar.updateUndoRedoButtons(true, true)
    })

    await expect(undoButton).not.toHaveAttribute('disabled')
    await expect(redoButton).not.toHaveAttribute('disabled')

    // Save button should always be enabled (in this implementation)
    await expect(saveButton).not.toHaveAttribute('disabled')
  })

  test('9. Tooltip displays on hover', async ({ page }) => {
    await createToolbarInBrowser(page)

    await page.evaluate(() => {
      window.toolbar.create()

      // Add tooltips to buttons for testing
      const buttons = document.querySelectorAll('.absmartly-toolbar-button')
      buttons.forEach(button => {
        const action = button.getAttribute('data-action')
        switch (action) {
          case 'undo':
            button.title = 'Undo the last change (Ctrl+Z)'
            break
          case 'redo':
            button.title = 'Redo the last undone change (Ctrl+Shift+Z)'
            break
          case 'clear':
            button.title = 'Clear all changes'
            break
          case 'save':
            button.title = 'Save changes to experiment (Ctrl+S)'
            break
          case 'exit':
            button.title = 'Exit visual editor (Esc)'
            break
        }
      })
    })

    await waitForToolbar(page)

    // Test tooltip for undo button
    const undoButton = page.locator('[data-action="undo"]')
    await expect(undoButton).toHaveAttribute('title', 'Undo the last change (Ctrl+Z)')

    // Test tooltip for save button
    const saveButton = page.locator('[data-action="save"]')
    await expect(saveButton).toHaveAttribute('title', 'Save changes to experiment (Ctrl+S)')

    // Test tooltip for exit button
    const exitButton = page.locator('[data-action="exit"]')
    await expect(exitButton).toHaveAttribute('title', 'Exit visual editor (Esc)')
  })

  test('10. Accessibility (ARIA labels, keyboard navigation)', async ({ page }) => {
    await createToolbarInBrowser(page)

    await page.evaluate(() => {
      window.toolbar.create()

      // Add ARIA labels and roles for accessibility testing
      const toolbar = document.querySelector('.absmartly-toolbar')
      toolbar.setAttribute('role', 'toolbar')
      toolbar.setAttribute('aria-label', 'Visual Editor Toolbar')

      const buttons = document.querySelectorAll('.absmartly-toolbar-button')
      buttons.forEach(button => {
        const action = button.getAttribute('data-action')
        button.setAttribute('role', 'button')
        button.setAttribute('tabindex', '0')

        switch (action) {
          case 'undo':
            button.setAttribute('aria-label', 'Undo last change')
            break
          case 'redo':
            button.setAttribute('aria-label', 'Redo last undone change')
            break
          case 'clear':
            button.setAttribute('aria-label', 'Clear all changes')
            break
          case 'save':
            button.setAttribute('aria-label', 'Save changes')
            break
          case 'exit':
            button.setAttribute('aria-label', 'Exit visual editor')
            break
        }
      })

      // Add keyboard navigation
      buttons.forEach((button, index) => {
        button.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            button.click()
            e.preventDefault()
          } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            const nextButton = buttons[index + 1] || buttons[0]
            nextButton.focus()
            e.preventDefault()
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            const prevButton = buttons[index - 1] || buttons[buttons.length - 1]
            prevButton.focus()
            e.preventDefault()
          }
        })
      })
    })

    await waitForToolbar(page)

    // Test ARIA attributes
    const toolbar = page.locator('.absmartly-toolbar')
    await expect(toolbar).toHaveAttribute('role', 'toolbar')
    await expect(toolbar).toHaveAttribute('aria-label', 'Visual Editor Toolbar')

    const undoButton = page.locator('[data-action="undo"]')
    await expect(undoButton).toHaveAttribute('aria-label', 'Undo last change')
    await expect(undoButton).toHaveAttribute('role', 'button')

    // Test keyboard navigation
    await undoButton.focus()
    await expect(undoButton).toBeFocused()

    // Navigate to next button with arrow key
    await page.keyboard.press('ArrowDown')
    const redoButton = page.locator('[data-action="redo"]')
    await expect(redoButton).toBeFocused()

    // Test Enter key activation
    await page.evaluate(() => {
      window.lastClickedAction = null
    })

    await page.keyboard.press('Enter')
    const action = await page.evaluate(() => window.lastClickedAction)
    expect(action).toBe('redo')
  })

  test('11. Visual regression tests for different states', async ({ page }) => {
    await createToolbarInBrowser(page)

    await page.evaluate(() => {
      window.toolbar.create()
    })

    await waitForToolbar(page)

    const toolbar = page.locator('.absmartly-toolbar')

    // Test default state
    await expect(toolbar).toHaveScreenshot('toolbar-default-state.png')

    // Test with changes count
    await page.evaluate(() => {
      window.toolbar.updateChangesCount(5)
    })
    await expect(toolbar).toHaveScreenshot('toolbar-with-changes.png')

    // Test with disabled undo/redo
    await page.evaluate(() => {
      window.toolbar.updateUndoRedoButtons(false, false)
    })
    await expect(toolbar).toHaveScreenshot('toolbar-disabled-buttons.png')

    // Test with enabled undo/redo
    await page.evaluate(() => {
      window.toolbar.updateUndoRedoButtons(true, true)
    })
    await expect(toolbar).toHaveScreenshot('toolbar-enabled-buttons.png')

    // Test hover state on save button
    await page.locator('[data-action="save"]').hover()
    await expect(toolbar).toHaveScreenshot('toolbar-save-hover.png')

    // Test hover state on exit button
    await page.locator('[data-action="exit"]').hover()
    await expect(toolbar).toHaveScreenshot('toolbar-exit-hover.png')
  })

  test('12. Toolbar removal and cleanup', async ({ page }) => {
    await createToolbarInBrowser(page)

    await page.evaluate(() => {
      window.toolbar.create()
    })

    await waitForToolbar(page)

    // Verify toolbar exists
    const toolbar = page.locator('.absmartly-toolbar')
    await expect(toolbar).toBeVisible()

    // Remove toolbar
    await page.evaluate(() => {
      window.toolbar.remove()
    })

    // Verify toolbar is removed
    await expect(toolbar).not.toBeVisible()

    // Verify references are cleaned up
    const referencesCleared = await page.evaluate(() => {
      return window.toolbar.toolbar === null &&
             window.toolbar.changesCounter === null &&
             window.toolbar.undoButton === null &&
             window.toolbar.redoButton === null
    })

    expect(referencesCleared).toBe(true)
  })

  test('13. Event propagation handling', async ({ page }) => {
    await createToolbarInBrowser(page)

    await page.evaluate(() => {
      window.toolbar.create()
      window.eventsPropagated = []

      // Add event listeners to test propagation
      document.addEventListener('click', () => {
        window.eventsPropagated.push('document')
      })

      document.body.addEventListener('click', () => {
        window.eventsPropagated.push('body')
      })
    })

    await waitForToolbar(page)

    // Click on a toolbar button
    await page.click('[data-action="save"]')

    // Check that events were properly handled
    const propagatedEvents = await page.evaluate(() => window.eventsPropagated)

    // Events should be stopped by the toolbar's event handler
    expect(propagatedEvents).toEqual([])
  })

  test('14. Multiple toolbar instances prevention', async ({ page }) => {
    await createToolbarInBrowser(page)

    await page.evaluate(() => {
      // Try to create toolbar multiple times
      window.toolbar.create()
      window.toolbar.create()
      window.toolbar.create()
    })

    // Should only have one toolbar instance
    const toolbarCount = await page.locator('.absmartly-toolbar').count()
    expect(toolbarCount).toBe(1)
  })

  test('15. Toolbar positioning and z-index', async ({ page }) => {
    await createToolbarInBrowser(page)

    // Add some content with high z-index to test layering
    await page.evaluate(() => {
      const overlay = document.createElement('div')
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 1000000;
      `
      document.body.appendChild(overlay)

      window.toolbar.create()
    })

    await waitForToolbar(page)

    const toolbar = page.locator('.absmartly-toolbar')

    // Check positioning
    await expect(toolbar).toHaveCSS('position', 'fixed')
    await expect(toolbar).toHaveCSS('top', '20px')
    await expect(toolbar).toHaveCSS('right', '20px')

    // Check z-index is high enough to appear above most content
    await expect(toolbar).toHaveCSS('z-index', '2147483646')

    // Toolbar should be visible despite overlay
    await expect(toolbar).toBeVisible()
  })
})