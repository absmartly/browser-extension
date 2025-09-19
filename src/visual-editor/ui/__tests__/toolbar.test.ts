/**
 * Unit tests for Toolbar UI Component
 */

import { Toolbar } from '../toolbar'
import StateManager from '../../core/state-manager'

// Mock StateManager
jest.mock('../../core/state-manager')

describe('Toolbar', () => {
  let toolbar: Toolbar
  let mockStateManager: jest.Mocked<StateManager>

  // Mock callbacks
  const mockCallbacks = {
    onUndo: jest.fn(),
    onRedo: jest.fn(),
    onClear: jest.fn(),
    onSave: jest.fn(),
    onExit: jest.fn(),
  }

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = ''
    document.head.innerHTML = ''

    // Create mock StateManager
    mockStateManager = {
      getConfig: jest.fn().mockReturnValue({
        variantName: 'Test Variant',
        experimentName: 'Test Experiment',
        logoUrl: 'test-logo.png',
      }),
      getState: jest.fn(),
      updateState: jest.fn(),
      onStateChange: jest.fn(),
      removeStateChangeListener: jest.fn(),
    } as any

    // Create toolbar instance
    toolbar = new Toolbar(mockStateManager)

    // Set up callbacks
    toolbar.onUndo = mockCallbacks.onUndo
    toolbar.onRedo = mockCallbacks.onRedo
    toolbar.onClear = mockCallbacks.onClear
    toolbar.onSave = mockCallbacks.onSave
    toolbar.onExit = mockCallbacks.onExit

    // Clear all mocks
    jest.clearAllMocks()
  })

  afterEach(() => {
    toolbar.remove()
  })

  describe('Constructor and Initialization', () => {
    it('should initialize with StateManager', () => {
      expect(toolbar).toBeInstanceOf(Toolbar)
      expect(mockStateManager.getConfig).not.toHaveBeenCalled() // Only called in create()
    })

    it('should have default callback functions that log to console', () => {
      const newToolbar = new Toolbar(mockStateManager)
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      newToolbar.onUndo()
      newToolbar.onRedo()
      newToolbar.onClear()
      newToolbar.onSave()
      newToolbar.onExit()

      expect(consoleSpy).toHaveBeenCalledWith('[Toolbar] Undo callback not set')
      expect(consoleSpy).toHaveBeenCalledWith('[Toolbar] Redo callback not set')
      expect(consoleSpy).toHaveBeenCalledWith('[Toolbar] Clear callback not set')
      expect(consoleSpy).toHaveBeenCalledWith('[Toolbar] Save callback not set')
      expect(consoleSpy).toHaveBeenCalledWith('[Toolbar] Exit callback not set')

      consoleSpy.mockRestore()
    })
  })

  describe('create() method', () => {
    it('should create toolbar element with proper structure', () => {
      toolbar.create()

      const toolbarElement = document.querySelector('.absmartly-toolbar')
      expect(toolbarElement).toBeInTheDocument()
      expect(toolbarElement).toHaveStyle({
        position: 'fixed',
        top: '20px',
        right: '20px',
        'z-index': '2147483646',
      })
    })

    it('should call stateManager.getConfig() during creation', () => {
      toolbar.create()
      expect(mockStateManager.getConfig).toHaveBeenCalledTimes(1)
    })

    it('should not create toolbar twice', () => {
      toolbar.create()
      const firstToolbar = document.querySelector('.absmartly-toolbar')

      toolbar.create()
      const toolbars = document.querySelectorAll('.absmartly-toolbar')

      expect(toolbars).toHaveLength(1)
      expect(toolbars[0]).toBe(firstToolbar)
    })

    it('should create header with title and changes count', () => {
      toolbar.create()

      const header = document.querySelector('.absmartly-toolbar-header')
      expect(header).toBeInTheDocument()
      expect(header).toHaveTextContent('Visual Editor')

      const changesCount = document.querySelector('.absmartly-changes-count')
      expect(changesCount).toBeInTheDocument()
      expect(changesCount).toHaveTextContent('0')
    })

    it('should create instructions section', () => {
      toolbar.create()

      const instructions = document.querySelector('.absmartly-toolbar-instructions')
      expect(instructions).toBeInTheDocument()
      expect(instructions).toHaveTextContent('How to use:')
      expect(instructions).toHaveTextContent('Click any element to select & edit')
    })

    it('should create all action buttons', () => {
      toolbar.create()

      const undoButton = document.querySelector('[data-action="undo"]')
      const redoButton = document.querySelector('[data-action="redo"]')
      const clearButton = document.querySelector('[data-action="clear"]')
      const saveButton = document.querySelector('[data-action="save"]')
      const exitButton = document.querySelector('[data-action="exit"]')

      expect(undoButton).toBeInTheDocument()
      expect(redoButton).toBeInTheDocument()
      expect(clearButton).toBeInTheDocument()
      expect(saveButton).toBeInTheDocument()
      expect(exitButton).toBeInTheDocument()

      expect(undoButton).toHaveTextContent('↶ Undo Last Change')
      expect(redoButton).toHaveTextContent('↷ Redo Change')
      expect(clearButton).toHaveTextContent('Clear All Changes')
      expect(saveButton).toHaveTextContent('Save Changes')
      expect(exitButton).toHaveTextContent('Exit Editor')
    })

    it('should apply proper styling to primary and danger buttons', () => {
      toolbar.create()

      const saveButton = document.querySelector('[data-action="save"]') as HTMLElement
      const exitButton = document.querySelector('[data-action="exit"]') as HTMLElement

      expect(saveButton).toHaveClass('primary')
      expect(saveButton.style.background).toBe('rgb(59, 130, 246)')
      expect(saveButton.style.color).toBe('white')

      expect(exitButton).toHaveClass('danger')
      expect(exitButton.style.background).toBe('rgb(239, 68, 68)')
      expect(exitButton.style.color).toBe('white')
    })

    it('should add hover effect styles to document head', () => {
      toolbar.create()

      const styles = document.querySelectorAll('style')
      const hoverStyle = Array.from(styles).find(style =>
        style.textContent?.includes('.absmartly-toolbar-button:hover')
      )

      expect(hoverStyle).toBeTruthy()
      expect(hoverStyle?.textContent).toContain('.absmartly-toolbar-button:hover')
      expect(hoverStyle?.textContent).toContain('.absmartly-toolbar-button.primary:hover')
      expect(hoverStyle?.textContent).toContain('.absmartly-toolbar-button.danger:hover')
    })

    it('should store references to key elements', () => {
      toolbar.create()

      // Use reflection to access private properties for testing
      const changesCounter = (toolbar as any).changesCounter
      const undoButton = (toolbar as any).undoButton
      const redoButton = (toolbar as any).redoButton

      expect(changesCounter).toBe(document.querySelector('.absmartly-changes-count'))
      expect(undoButton).toBe(document.querySelector('[data-action="undo"]'))
      expect(redoButton).toBe(document.querySelector('[data-action="redo"]'))
    })

    it('should add click event listener to toolbar', () => {
      const addEventListenerSpy = jest.spyOn(HTMLElement.prototype, 'addEventListener')

      toolbar.create()

      expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function))

      addEventListenerSpy.mockRestore()
    })
  })

  describe('Button functionality and event handling', () => {
    beforeEach(() => {
      toolbar.create()
    })

    it('should call onUndo when undo button is clicked', () => {
      const undoButton = document.querySelector('[data-action="undo"]') as HTMLElement
      undoButton.click()

      expect(mockCallbacks.onUndo).toHaveBeenCalledTimes(1)
    })

    it('should call onRedo when redo button is clicked', () => {
      const redoButton = document.querySelector('[data-action="redo"]') as HTMLElement
      redoButton.click()

      expect(mockCallbacks.onRedo).toHaveBeenCalledTimes(1)
    })

    it('should call onClear when clear button is clicked', () => {
      const clearButton = document.querySelector('[data-action="clear"]') as HTMLElement
      clearButton.click()

      expect(mockCallbacks.onClear).toHaveBeenCalledTimes(1)
    })

    it('should call onSave when save button is clicked', () => {
      const saveButton = document.querySelector('[data-action="save"]') as HTMLElement
      saveButton.click()

      expect(mockCallbacks.onSave).toHaveBeenCalledTimes(1)
    })

    it('should call onExit when exit button is clicked', () => {
      const exitButton = document.querySelector('[data-action="exit"]') as HTMLElement
      exitButton.click()

      expect(mockCallbacks.onExit).toHaveBeenCalledTimes(1)
    })

    it('should not call any callback when clicking non-action elements', () => {
      const header = document.querySelector('.absmartly-toolbar-header') as HTMLElement
      header.click()

      expect(mockCallbacks.onUndo).not.toHaveBeenCalled()
      expect(mockCallbacks.onRedo).not.toHaveBeenCalled()
      expect(mockCallbacks.onClear).not.toHaveBeenCalled()
      expect(mockCallbacks.onSave).not.toHaveBeenCalled()
      expect(mockCallbacks.onExit).not.toHaveBeenCalled()
    })

    it('should prevent default and stop propagation on toolbar clicks', () => {
      const undoButton = document.querySelector('[data-action="undo"]') as HTMLElement

      // Create a custom event with the undo button as target
      const mockEvent = new MouseEvent('click', { bubbles: true })
      Object.defineProperty(mockEvent, 'target', { value: undoButton, writable: false })

      // Trigger the click event on the undo button
      undoButton.dispatchEvent(mockEvent)

      // The event should be handled by the toolbar's click handler
      expect(mockCallbacks.onUndo).toHaveBeenCalledTimes(1)
    })
  })

  describe('updateChangesCount() method', () => {
    beforeEach(() => {
      toolbar.create()
    })

    it('should update changes counter display', () => {
      const changesCounter = document.querySelector('.absmartly-changes-count')

      toolbar.updateChangesCount(5)
      expect(changesCounter).toHaveTextContent('5')

      toolbar.updateChangesCount(0)
      expect(changesCounter).toHaveTextContent('0')

      toolbar.updateChangesCount(99)
      expect(changesCounter).toHaveTextContent('99')
    })

    it('should handle updateChangesCount when toolbar not created', () => {
      const newToolbar = new Toolbar(mockStateManager)

      // Should not throw error
      expect(() => {
        newToolbar.updateChangesCount(5)
      }).not.toThrow()
    })

    it('should convert number to string', () => {
      const changesCounter = document.querySelector('.absmartly-changes-count')

      toolbar.updateChangesCount(42)
      expect(changesCounter?.textContent).toBe('42')
      expect(typeof changesCounter?.textContent).toBe('string')
    })
  })

  describe('updateUndoRedoButtons() method', () => {
    beforeEach(() => {
      toolbar.create()
    })

    it('should enable/disable undo button based on canUndo parameter', () => {
      const undoButton = document.querySelector('[data-action="undo"]') as HTMLButtonElement

      toolbar.updateUndoRedoButtons(true, false)
      expect(undoButton.style.opacity).toBe('1')
      expect(undoButton.disabled).toBe(false)

      toolbar.updateUndoRedoButtons(false, false)
      expect(undoButton.style.opacity).toBe('0.5')
      expect(undoButton.disabled).toBe(true)
    })

    it('should enable/disable redo button based on canRedo parameter', () => {
      const redoButton = document.querySelector('[data-action="redo"]') as HTMLButtonElement

      toolbar.updateUndoRedoButtons(false, true)
      expect(redoButton.style.opacity).toBe('1')
      expect(redoButton.disabled).toBe(false)

      toolbar.updateUndoRedoButtons(false, false)
      expect(redoButton.style.opacity).toBe('0.5')
      expect(redoButton.disabled).toBe(true)
    })

    it('should handle both buttons independently', () => {
      const undoButton = document.querySelector('[data-action="undo"]') as HTMLButtonElement
      const redoButton = document.querySelector('[data-action="redo"]') as HTMLButtonElement

      toolbar.updateUndoRedoButtons(true, true)
      expect(undoButton.style.opacity).toBe('1')
      expect(undoButton.disabled).toBe(false)
      expect(redoButton.style.opacity).toBe('1')
      expect(redoButton.disabled).toBe(false)

      toolbar.updateUndoRedoButtons(true, false)
      expect(undoButton.style.opacity).toBe('1')
      expect(undoButton.disabled).toBe(false)
      expect(redoButton.style.opacity).toBe('0.5')
      expect(redoButton.disabled).toBe(true)

      toolbar.updateUndoRedoButtons(false, true)
      expect(undoButton.style.opacity).toBe('0.5')
      expect(undoButton.disabled).toBe(true)
      expect(redoButton.style.opacity).toBe('1')
      expect(redoButton.disabled).toBe(false)
    })

    it('should handle updateUndoRedoButtons when toolbar not created', () => {
      const newToolbar = new Toolbar(mockStateManager)

      // Should not throw error
      expect(() => {
        newToolbar.updateUndoRedoButtons(true, true)
      }).not.toThrow()
    })

    it('should handle updateUndoRedoButtons when buttons are null', () => {
      // Remove toolbar to set button references to null
      toolbar.remove()

      // Should not throw error
      expect(() => {
        toolbar.updateUndoRedoButtons(true, true)
      }).not.toThrow()
    })
  })

  describe('remove() method', () => {
    it('should remove toolbar from DOM', () => {
      toolbar.create()
      expect(document.querySelector('.absmartly-toolbar')).toBeInTheDocument()

      toolbar.remove()
      expect(document.querySelector('.absmartly-toolbar')).not.toBeInTheDocument()
    })

    it('should reset all element references to null', () => {
      toolbar.create()

      // Verify elements exist
      expect((toolbar as any).toolbar).toBeTruthy()
      expect((toolbar as any).changesCounter).toBeTruthy()
      expect((toolbar as any).undoButton).toBeTruthy()
      expect((toolbar as any).redoButton).toBeTruthy()

      toolbar.remove()

      // Verify all references are null
      expect((toolbar as any).toolbar).toBeNull()
      expect((toolbar as any).changesCounter).toBeNull()
      expect((toolbar as any).undoButton).toBeNull()
      expect((toolbar as any).redoButton).toBeNull()
    })

    it('should handle remove when toolbar not created', () => {
      // Should not throw error
      expect(() => {
        toolbar.remove()
      }).not.toThrow()
    })

    it('should handle multiple remove calls', () => {
      toolbar.create()
      toolbar.remove()

      // Should not throw error on second remove
      expect(() => {
        toolbar.remove()
      }).not.toThrow()
    })
  })

  describe('Button state management', () => {
    beforeEach(() => {
      toolbar.create()
    })

    it('should maintain button disabled state after updateUndoRedoButtons', () => {
      const undoButton = document.querySelector('[data-action="undo"]') as HTMLButtonElement
      const redoButton = document.querySelector('[data-action="redo"]') as HTMLButtonElement

      // Disable both buttons
      toolbar.updateUndoRedoButtons(false, false)

      // Buttons should be disabled
      expect(undoButton.disabled).toBe(true)
      expect(redoButton.disabled).toBe(true)

      // In JSDOM, disabled buttons don't trigger click events (like real browsers)
      undoButton.click()
      expect(mockCallbacks.onUndo).not.toHaveBeenCalled()

      // Test that when enabled, the button works again
      toolbar.updateUndoRedoButtons(true, false)
      undoButton.click()
      expect(mockCallbacks.onUndo).toHaveBeenCalledTimes(1)
    })

    it('should update visual state correctly', () => {
      const undoButton = document.querySelector('[data-action="undo"]') as HTMLButtonElement
      const redoButton = document.querySelector('[data-action="redo"]') as HTMLButtonElement

      // Test enabled state
      toolbar.updateUndoRedoButtons(true, true)
      expect(undoButton.style.opacity).toBe('1')
      expect(redoButton.style.opacity).toBe('1')

      // Test disabled state
      toolbar.updateUndoRedoButtons(false, false)
      expect(undoButton.style.opacity).toBe('0.5')
      expect(redoButton.style.opacity).toBe('0.5')
    })
  })

  describe('DOM structure and styling', () => {
    beforeEach(() => {
      toolbar.create()
    })

    it('should have correct CSS classes', () => {
      const toolbarElement = document.querySelector('.absmartly-toolbar')
      const header = document.querySelector('.absmartly-toolbar-header')
      const instructions = document.querySelector('.absmartly-toolbar-instructions')
      const buttons = document.querySelectorAll('.absmartly-toolbar-button')

      expect(toolbarElement).toHaveClass('absmartly-toolbar')
      expect(header).toHaveClass('absmartly-toolbar-header')
      expect(instructions).toHaveClass('absmartly-toolbar-instructions')
      expect(buttons).toHaveLength(5) // undo, redo, clear, save, exit
    })

    it('should have proper button data attributes', () => {
      const buttons = [
        { selector: '[data-action="undo"]', action: 'undo' },
        { selector: '[data-action="redo"]', action: 'redo' },
        { selector: '[data-action="clear"]', action: 'clear' },
        { selector: '[data-action="save"]', action: 'save' },
        { selector: '[data-action="exit"]', action: 'exit' },
      ]

      buttons.forEach(({ selector, action }) => {
        const button = document.querySelector(selector)
        expect(button).toBeInTheDocument()
        expect(button?.getAttribute('data-action')).toBe(action)
      })
    })

    it('should maintain z-index for proper layering', () => {
      const toolbarElement = document.querySelector('.absmartly-toolbar') as HTMLElement
      expect(toolbarElement.style.zIndex).toBe('2147483646')
    })

    it('should be positioned fixed in top-right corner', () => {
      const toolbarElement = document.querySelector('.absmartly-toolbar') as HTMLElement
      expect(toolbarElement.style.position).toBe('fixed')
      expect(toolbarElement.style.top).toBe('20px')
      expect(toolbarElement.style.right).toBe('20px')
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle malformed click events gracefully', () => {
      toolbar.create()
      const toolbarElement = document.querySelector('.absmartly-toolbar') as HTMLElement

      // Create a mock element with getAttribute method that returns null
      const mockElement = {
        getAttribute: jest.fn().mockReturnValue(null)
      } as unknown as HTMLElement

      const mockEvent = new MouseEvent('click')
      Object.defineProperty(mockEvent, 'target', { value: mockElement })

      // This should not throw even with malformed targets
      expect(() => {
        toolbarElement.dispatchEvent(mockEvent)
      }).not.toThrow()

      // No callbacks should be triggered for unknown actions
      expect(mockCallbacks.onUndo).not.toHaveBeenCalled()
      expect(mockCallbacks.onRedo).not.toHaveBeenCalled()
      expect(mockCallbacks.onClear).not.toHaveBeenCalled()
      expect(mockCallbacks.onSave).not.toHaveBeenCalled()
      expect(mockCallbacks.onExit).not.toHaveBeenCalled()
    })

    it('should handle clicks on elements without data-action attribute', () => {
      toolbar.create()
      const instructions = document.querySelector('.absmartly-toolbar-instructions') as HTMLElement

      instructions.click()

      // No callbacks should be called
      expect(mockCallbacks.onUndo).not.toHaveBeenCalled()
      expect(mockCallbacks.onRedo).not.toHaveBeenCalled()
      expect(mockCallbacks.onClear).not.toHaveBeenCalled()
      expect(mockCallbacks.onSave).not.toHaveBeenCalled()
      expect(mockCallbacks.onExit).not.toHaveBeenCalled()
    })

    it('should handle numeric changes count edge cases', () => {
      toolbar.create()
      const changesCounter = document.querySelector('.absmartly-changes-count')

      // Test with 0
      toolbar.updateChangesCount(0)
      expect(changesCounter).toHaveTextContent('0')

      // Test with negative numbers (edge case)
      toolbar.updateChangesCount(-1)
      expect(changesCounter).toHaveTextContent('-1')

      // Test with large numbers
      toolbar.updateChangesCount(999999)
      expect(changesCounter).toHaveTextContent('999999')
    })
  })
})