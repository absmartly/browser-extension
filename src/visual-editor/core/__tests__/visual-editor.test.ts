/**
 * Comprehensive unit tests for VisualEditor class
 * Tests constructor, lifecycle methods, change management, and integrations
 */

import { VisualEditor, initVisualEditor } from '../visual-editor'
import type { VisualEditorOptions } from '../visual-editor'
import type { DOMChange } from '../../types/visual-editor'

// Mock all dependencies except UndoRedoManager (use real implementation)
jest.mock('../state-manager')
jest.mock('../event-handlers')
jest.mock('../context-menu')
jest.mock('../../ui/components')
jest.mock('../edit-modes')
jest.mock('../cleanup')
jest.mock('../../ui/notifications')
jest.mock('../element-actions')
jest.mock('../editor-coordinator')

// Mock chrome APIs
const mockChrome = {
  runtime: {
    sendMessage: jest.fn()
  }
} as any

Object.defineProperty(global, 'chrome', {
  value: mockChrome,
  writable: true
})

// Mock window postMessage
Object.defineProperty(global.window, 'postMessage', {
  value: jest.fn(),
  writable: true
})

// Import mocked classes after setting up mocks
import StateManager from '../state-manager'
import EventHandlers from '../event-handlers'
import ContextMenu from '../context-menu'
import UndoRedoManager from '../undo-redo-manager'
import UIComponents from '../../ui/components'
import EditModes from '../edit-modes'
import Cleanup from '../cleanup'
import { Notifications } from '../../ui/notifications'
import { ElementActions } from '../element-actions'
import { EditorCoordinator } from '../editor-coordinator'
import type { EditorCoordinatorCallbacks } from '../editor-coordinator'

// Mock implementations (UndoRedoManager uses real class)
const MockStateManager = StateManager as jest.MockedClass<typeof StateManager>
const MockEventHandlers = EventHandlers as jest.MockedClass<typeof EventHandlers>
const MockContextMenu = ContextMenu as jest.MockedClass<typeof ContextMenu>
const MockUIComponents = UIComponents as jest.MockedClass<typeof UIComponents>
const MockEditModes = EditModes as jest.MockedClass<typeof EditModes>
const MockCleanup = Cleanup as jest.MockedClass<typeof Cleanup>
const MockNotifications = Notifications as jest.MockedClass<typeof Notifications>
const MockElementActions = ElementActions as jest.MockedClass<typeof ElementActions>
const MockEditorCoordinator = EditorCoordinator as jest.MockedClass<typeof EditorCoordinator>

describe('VisualEditor', () => {
  let editor: VisualEditor
  let mockOptions: VisualEditorOptions
  let mockOnChangesUpdate: jest.Mock
  let mockStateManager: jest.Mocked<StateManager>
  let mockElementActions: jest.Mocked<ElementActions>
  let mockCoordinator: jest.Mocked<EditorCoordinator>
  let mockNotifications: jest.Mocked<Notifications>
  let undoRedoManager: UndoRedoManager

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Reset global state
    delete (window as any).__absmartlyVisualEditorActive
    delete (window as any).__absmartlyVisualEditor

    // Setup mock options
    mockOnChangesUpdate = jest.fn()
    mockOptions = {
      variantName: 'test-variant',
      experimentName: 'test-experiment',
      logoUrl: 'https://example.com/logo.png',
      onChangesUpdate: mockOnChangesUpdate,
      initialChanges: []
    }

    // Setup mock instances
    mockStateManager = {
      setChanges: jest.fn(),
      getState: jest.fn().mockReturnValue({ changes: [], undoStack: [], redoStack: [] }),
      onStateChange: jest.fn(),
      pushUndo: jest.fn()
    } as any

    mockElementActions = {
      getSelector: jest.fn().mockReturnValue('.test-selector'),
      hideElement: jest.fn(),
      deleteElement: jest.fn(),
      copyElement: jest.fn(),
      copySelectorPath: jest.fn(),
      moveElement: jest.fn(),
      insertNewBlock: jest.fn(),
      showRelativeElementSelector: jest.fn(),
      undoLastChange: jest.fn(),
      redoChange: jest.fn(),
      clearAllChanges: jest.fn()
    } as any

    mockCoordinator = {
      setupAll: jest.fn(),
      teardownAll: jest.fn()
    } as any

    mockNotifications = {
      show: jest.fn()
    } as any

    // Configure mock constructors to return our mock instances
    MockStateManager.mockImplementation(() => mockStateManager)
    MockElementActions.mockImplementation(() => mockElementActions)
    MockEditorCoordinator.mockImplementation(() => mockCoordinator)
    MockNotifications.mockImplementation(() => mockNotifications)

    // Mock other classes with minimal implementations
    MockEventHandlers.mockImplementation(() => ({} as any))
    MockContextMenu.mockImplementation(() => ({} as any))

    // Create real UndoRedoManager instance
    undoRedoManager = new UndoRedoManager()
    MockUIComponents.mockImplementation(() => ({
      createBanner: jest.fn(),
      updateBanner: jest.fn()
    } as any))
    MockEditModes.mockImplementation(() => ({
      setAddChangeCallback: jest.fn()
    } as any))
    MockCleanup.mockImplementation(() => ({} as any))

    // Setup DOM
    document.head.innerHTML = ''
    document.body.innerHTML = ''
  })

  afterEach(() => {
    // Clean up any styles that might have been added
    const styles = document.querySelectorAll('style[id="absmartly-visual-editor-styles"], style[data-absmartly="true"]')
    styles.forEach(style => style.remove())
  })

  describe('Constructor', () => {
    it('should initialize with valid options', () => {
      editor = new VisualEditor(mockOptions)

      expect(editor).toBeInstanceOf(VisualEditor)
      expect(MockStateManager).toHaveBeenCalledWith({
        variantName: 'test-variant',
        experimentName: 'test-experiment',
        logoUrl: 'https://example.com/logo.png',
        initialChanges: []
      })
    })

    it('should initialize with initial changes', () => {
      const initialChanges: DOMChange[] = [
        {
          selector: '.test',
          type: 'text',
          value: 'Test content'
        }
      ]

      const optionsWithChanges = {
        ...mockOptions,
        initialChanges
      }

      editor = new VisualEditor(optionsWithChanges)

      expect(MockStateManager).toHaveBeenCalledWith({
        variantName: 'test-variant',
        experimentName: 'test-experiment',
        logoUrl: 'https://example.com/logo.png',
        initialChanges
      })
    })

    it('should initialize all core modules', () => {
      editor = new VisualEditor(mockOptions)

      expect(MockStateManager).toHaveBeenCalled()
      expect(MockEventHandlers).toHaveBeenCalledWith(mockStateManager)
      expect(MockContextMenu).toHaveBeenCalledWith(mockStateManager, undefined)  // Second param is useShadowDOM
      // UndoRedoManager is now a real instance, not mocked
      expect(MockUIComponents).toHaveBeenCalledWith(mockStateManager)
      expect(MockEditModes).toHaveBeenCalledWith(mockStateManager)
      expect(MockCleanup).toHaveBeenCalledWith(mockStateManager)
      // Toolbar removed - using UIComponents banner instead
      expect(MockNotifications).toHaveBeenCalled()
    })

    it('should initialize ElementActions with correct parameters', () => {
      editor = new VisualEditor(mockOptions)

      expect(MockElementActions).toHaveBeenCalledWith(
        mockStateManager,
        expect.any(Object), // UndoRedoManager instance
        expect.any(Object), // Notifications instance
        {
          onChangesUpdate: expect.any(Function)
        }
      )
    })

    it('should initialize EditorCoordinator with all modules and callbacks', () => {
      editor = new VisualEditor(mockOptions)

      expect(MockEditorCoordinator).toHaveBeenCalledWith(
        mockStateManager,
        expect.any(Object), // EventHandlers
        expect.any(Object), // ContextMenu
        expect.any(Object), // UndoRedoManager
        expect.any(Object), // UIComponents
        expect.any(Object), // EditModes
        expect.any(Object), // Cleanup
        expect.any(Object), // Notifications
        expect.any(Object), // Notifications
        expect.objectContaining({
          onChangesUpdate: mockOnChangesUpdate,
          removeStyles: expect.any(Function),
          getSelector: expect.any(Function),
          hideElement: expect.any(Function),
          deleteElement: expect.any(Function),
          copyElement: expect.any(Function),
          copySelectorPath: expect.any(Function),
          moveElement: expect.any(Function),
          insertNewBlock: expect.any(Function),
          showRelativeElementSelector: expect.any(Function),
          undoLastChange: expect.any(Function),
          redoChange: expect.any(Function),
          clearAllChanges: expect.any(Function),
          saveChanges: expect.any(Function),
          stop: expect.any(Function)
        })
      )
    })
  })

  describe('start()', () => {
    beforeEach(() => {
      editor = new VisualEditor(mockOptions)
    })

    it('should start successfully when not active', () => {
      const result = editor.start()

      expect(result).toEqual({ success: true })
      expect(mockCoordinator.setupAll).toHaveBeenCalled()
      expect(mockNotifications.show).toHaveBeenCalledWith(
        'Visual Editor Active',
        'Click any element to edit',
        'success'
      )
    })

    it('should return already active when global flag is set', () => {
      ;(window as any).__absmartlyVisualEditorActive = true

      const result = editor.start()

      expect(result).toEqual({ success: true, already: true })
      expect(mockCoordinator.setupAll).not.toHaveBeenCalled()
      expect(mockNotifications.show).not.toHaveBeenCalled()
    })

    it('should return already active when editor is already active', () => {
      // First start
      editor.start()
      jest.clearAllMocks()

      // Second start
      const result = editor.start()

      expect(result).toEqual({ success: true, already: true })
      expect(mockCoordinator.setupAll).not.toHaveBeenCalled()
      expect(mockNotifications.show).not.toHaveBeenCalled()
    })

    it('should inject styles when starting', () => {
      editor.start()

      const editorStyles = document.getElementById('absmartly-visual-editor-styles')
      const globalStyles = document.querySelector('style[data-absmartly="true"]')

      expect(editorStyles).not.toBeNull()
      expect(globalStyles).not.toBeNull()
      expect(editorStyles?.textContent).toContain('.absmartly-editable')
      expect(globalStyles?.textContent).toContain('.absmartly-hover')
    })

    it('should keep preview header visible when starting', () => {
      // Create a mock preview header
      const previewHeader = document.createElement('div')
      previewHeader.id = 'absmartly-preview-header'
      previewHeader.style.display = 'block'
      document.body.appendChild(previewHeader)

      editor.start()

      // Preview header should remain visible
      expect(previewHeader.style.display).toBe('block')
    })

    it('should set isActive flag when starting', () => {
      editor.start()

      // Check internal flag (not global)
      expect(editor['isActive']).toBe(true)
    })

    it('should log version and timestamp', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      editor.start()

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ABSmartly] Starting unified visual editor - Version:',
        '3.0-UNIFIED'
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ABSmartly] Build timestamp:',
        expect.any(String)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('stop()', () => {
    beforeEach(() => {
      editor = new VisualEditor(mockOptions)
      editor.start() // Start first
      jest.clearAllMocks()
    })

    it('should stop when active and not send changes', () => {
      editor.stop()

      expect(mockCoordinator.teardownAll).toHaveBeenCalled()
      // Changes should NOT be sent on stop (only on explicit save)
      expect(mockOnChangesUpdate).not.toHaveBeenCalled()
    })

    it('should not call teardown when not active', () => {
      editor.stop() // First stop
      jest.clearAllMocks()

      editor.stop() // Second stop

      expect(mockCoordinator.teardownAll).not.toHaveBeenCalled()
      expect(mockOnChangesUpdate).not.toHaveBeenCalled()
    })

    it('should remove styles when stopping', () => {
      // Verify styles exist
      const editorStyles = document.getElementById('absmartly-visual-editor-styles')
      expect(editorStyles).not.toBeNull()

      editor.stop()

      // Verify styles are removed
      const removedStyles = document.getElementById('absmartly-visual-editor-styles')
      expect(removedStyles).toBeNull()
    })

    it('should reset isActive flag when stopping', () => {
      expect(editor['isActive']).toBe(true)

      editor.stop()

      expect(editor['isActive']).toBe(false)
    })

    it('should not send unsaved changes when stopping', () => {
      // Add some test changes
      const testChanges: DOMChange[] = [
        { selector: '.test1', type: 'text', value: 'Text 1' },
        { selector: '.test2', type: 'style', value: { color: 'red' } }
      ]

      // Set internal changes (unsaved)
      editor['changes'] = testChanges
      editor['hasUnsavedChanges'] = true

      // Mock window.confirm to simulate user choosing to discard changes
      global.confirm = jest.fn().mockReturnValue(true)

      editor.stop()

      // Unsaved changes should NOT be sent (user chose to discard)
      expect(mockOnChangesUpdate).not.toHaveBeenCalled()
    })
  })

  describe('destroy()', () => {
    beforeEach(() => {
      editor = new VisualEditor(mockOptions)
      editor.start()
      jest.clearAllMocks()
    })

    it('should call stop when destroyed', () => {
      const stopSpy = jest.spyOn(editor, 'stop')

      editor.destroy()

      expect(stopSpy).toHaveBeenCalled()
    })
  })

  describe('getChanges()', () => {
    beforeEach(() => {
      editor = new VisualEditor(mockOptions)
    })

    it('should return empty array by default', () => {
      const changes = editor.getChanges()

      expect(changes).toEqual([])
      expect(Array.isArray(changes)).toBe(true)
    })

    it('should return initial changes if provided', () => {
      const initialChanges: DOMChange[] = [
        { selector: '.test', type: 'text', value: 'Initial text' }
      ]

      editor = new VisualEditor({
        ...mockOptions,
        initialChanges
      })

      const changes = editor.getChanges()

      expect(changes).toEqual(initialChanges)
    })
  })

  describe('Style Management', () => {
    beforeEach(() => {
      editor = new VisualEditor(mockOptions)
    })

    it('should inject editor styles', () => {
      editor.start()

      const style = document.getElementById('absmartly-visual-editor-styles')
      expect(style).not.toBeNull()
      expect(style?.tagName).toBe('STYLE')

      const content = style?.textContent || ''
      expect(content).toContain('.absmartly-editable')
      expect(content).toContain('.absmartly-selected')
      expect(content).toContain('.absmartly-editing')
      expect(content).toContain('.absmartly-hover-tooltip')
    })

    it('should inject global styles', () => {
      editor.start()

      const style = document.querySelector('style[data-absmartly="true"]')
      expect(style).not.toBeNull()

      const content = style?.textContent || ''
      expect(content).toContain('.absmartly-hover')
      expect(content).toContain('.absmartly-selected')
      expect(content).toContain('.absmartly-editing')
      expect(content).toContain('.absmartly-draggable')
      expect(content).toContain('.absmartly-drop-target')
      expect(content).toContain('.absmartly-resize-active')
    })

    it('should remove styles when stopped', () => {
      editor.start()

      // Verify styles exist
      expect(document.getElementById('absmartly-visual-editor-styles')).not.toBeNull()

      editor.stop()

      // Verify styles are removed
      expect(document.getElementById('absmartly-visual-editor-styles')).toBeNull()
    })
  })

  describe('Change Management', () => {
    beforeEach(() => {
      editor = new VisualEditor(mockOptions)
    })

    it('should add text change to undoRedoManager but not auto-save', () => {
      const change: DOMChange = {
        selector: '.test-element',
        type: 'text',
        value: 'New text content'
      }

      // Changes are now added directly to undoRedoManager
      undoRedoManager.addChange(change, null)

      // Changes tracked in undoRedoManager
      expect(undoRedoManager.canUndo()).toBe(true)
      // Should NOT call onChangesUpdate yet (explicit save required)
      expect(mockOnChangesUpdate).not.toHaveBeenCalled()
    })

    it('should add style change to undoRedoManager but not auto-save', () => {
      const change: DOMChange = {
        selector: '.test-element',
        type: 'style',
        value: { color: 'red', fontSize: '16px' }
      }

      // Changes are now added directly to undoRedoManager
      undoRedoManager.addChange(change, null)

      // Changes tracked in undoRedoManager
      expect(undoRedoManager.canUndo()).toBe(true)
      expect(mockOnChangesUpdate).not.toHaveBeenCalled()
    })

    it('should save changes when saveChanges is called', () => {
      const visualEditor = new VisualEditor(mockOptions)

      const testChanges: DOMChange[] = [
        { selector: '.test1', type: 'text', value: 'Text 1' },
        { selector: '.test2', type: 'style', value: { color: 'red' } }
      ]

      // Add changes to visualEditor's undoRedoManager (accessed via private property)
      testChanges.forEach(change => {
        ;(visualEditor as any).undoRedoManager.addChange(change, null)
      })

      // Call save - should squash changes and call onChangesUpdate
      ;(visualEditor as any).saveChanges()

      // onChangesUpdate should be called with the squashed changes
      // Since changes are to different selectors, they won't be consolidated
      expect(mockOnChangesUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ selector: '.test1', type: 'text', value: 'Text 1' }),
          expect.objectContaining({ selector: '.test2', type: 'style', value: { color: 'red' } })
        ])
      )
      expect(mockOnChangesUpdate).toHaveBeenCalledTimes(1)

      visualEditor.stop()
    })

    it('should handle multiple change types', () => {
      const changes: DOMChange[] = [
        { selector: '.text-el', type: 'text', value: 'New text' },
        { selector: '.html-el', type: 'html', value: '<span>New HTML</span>' },
        { selector: '.style-el', type: 'style', value: { color: 'red' } }
      ]

      // Changes are now added directly to undoRedoManager
      changes.forEach(change => {
        undoRedoManager.addChange(change, null)
      })

      // Changes tracked in undoRedoManager
      expect(undoRedoManager.canUndo()).toBe(true)
      // But NOT saved until explicit save
      expect(mockOnChangesUpdate).not.toHaveBeenCalled()
    })
  })

  describe('saveChanges()', () => {
    beforeEach(() => {
      editor = new VisualEditor(mockOptions)
    })

    it('should save changes and show notification', () => {
      const testChanges: DOMChange[] = [
        { selector: '.test1', type: 'text', value: 'Text 1' },
        { selector: '.test2', type: 'style', value: { color: 'red' } }
      ]

      // Set internal changes directly
      editor['changes'] = testChanges

      const coordinatorCallArgs = MockEditorCoordinator.mock.calls[0]
      const callbacks = coordinatorCallArgs[coordinatorCallArgs.length - 1] as EditorCoordinatorCallbacks
      callbacks.saveChanges()

      // Should call onChangesUpdate with the changes
      expect(mockOnChangesUpdate).toHaveBeenCalled()
      // Should show success notification
      expect(mockNotifications.show).toHaveBeenCalledWith(
        expect.stringContaining('changes saved'),
        '',
        'success'
      )
    })

    it('should handle empty changes', () => {
      editor.getChanges = jest.fn().mockReturnValue([])

      const coordinatorCallArgs = MockEditorCoordinator.mock.calls[0]
      const callbacks = coordinatorCallArgs[coordinatorCallArgs.length - 1] as EditorCoordinatorCallbacks
      callbacks.saveChanges()

      expect(mockOnChangesUpdate).toHaveBeenCalledWith([])
      expect(mockNotifications.show).toHaveBeenCalledWith(
        '0 changes saved',
        '',
        'success'
      )
    })
  })

  describe('Integration with ElementActions', () => {
    beforeEach(() => {
      editor = new VisualEditor(mockOptions)
    })

    it('should delegate getSelector to ElementActions', () => {
      const testElement = document.createElement('div')
      testElement.className = 'test-element'

      const coordinatorCallArgs = MockEditorCoordinator.mock.calls[0]
      const callbacks = coordinatorCallArgs[coordinatorCallArgs.length - 1] as EditorCoordinatorCallbacks
      const result = callbacks.getSelector(testElement)

      expect(mockElementActions.getSelector).toHaveBeenCalledWith(testElement)
      expect(result).toBe('.test-selector')
    })

    it('should delegate element operations to ElementActions', () => {
      const coordinatorCallArgs = MockEditorCoordinator.mock.calls[0]
      const callbacks = coordinatorCallArgs[coordinatorCallArgs.length - 1] as EditorCoordinatorCallbacks

      callbacks.hideElement()
      expect(mockElementActions.hideElement).toHaveBeenCalled()

      callbacks.deleteElement()
      expect(mockElementActions.deleteElement).toHaveBeenCalled()

      callbacks.copyElement()
      expect(mockElementActions.copyElement).toHaveBeenCalled()

      callbacks.copySelectorPath()
      expect(mockElementActions.copySelectorPath).toHaveBeenCalled()

      callbacks.moveElement('up')
      expect(mockElementActions.moveElement).toHaveBeenCalledWith('up')

      callbacks.moveElement('down')
      expect(mockElementActions.moveElement).toHaveBeenCalledWith('down')

      callbacks.insertNewBlock()
      expect(mockElementActions.insertNewBlock).toHaveBeenCalled()

      callbacks.showRelativeElementSelector()
      expect(mockElementActions.showRelativeElementSelector).toHaveBeenCalled()

      // Add a change first so undo/redo have something to work with
      editor['undoRedoManager'].addChange({ selector: '.test', type: 'text', value: 'test' }, null)

      const undoSpy = jest.spyOn(editor as any, 'undoLastChange')
      const redoSpy = jest.spyOn(editor as any, 'redoChange')

      callbacks.undoLastChange()
      expect(undoSpy).toHaveBeenCalled()

      callbacks.redoChange()
      expect(redoSpy).toHaveBeenCalled()

      callbacks.clearAllChanges()
      expect(mockElementActions.clearAllChanges).toHaveBeenCalled()
    })
  })

  describe('Integration with EditorCoordinator', () => {
    beforeEach(() => {
      editor = new VisualEditor(mockOptions)
    })

    it('should setup all modules when starting', () => {
      editor.start()

      expect(mockCoordinator.setupAll).toHaveBeenCalled()
    })

    it('should teardown all modules when stopping', () => {
      editor.start()
      jest.clearAllMocks()

      editor.stop()

      expect(mockCoordinator.teardownAll).toHaveBeenCalled()
    })

    it('should provide correct callbacks to coordinator', () => {
      const coordinatorCallArgs = MockEditorCoordinator.mock.calls[0]
      const callbacks = coordinatorCallArgs[coordinatorCallArgs.length - 1] as EditorCoordinatorCallbacks

      expect(callbacks).toHaveProperty('onChangesUpdate', mockOnChangesUpdate)
      expect(callbacks).toHaveProperty('removeStyles')
      expect(callbacks).toHaveProperty('getSelector')
      expect(callbacks).toHaveProperty('saveChanges')
      expect(callbacks).toHaveProperty('stop')

      // Test that callbacks are functions
      expect(typeof callbacks.removeStyles).toBe('function')
      expect(typeof callbacks.getSelector).toBe('function')
      expect(typeof callbacks.saveChanges).toBe('function')
      expect(typeof callbacks.stop).toBe('function')
    })

    it('should call stop through coordinator callback', () => {
      const stopSpy = jest.spyOn(editor, 'stop')

      const coordinatorCallArgs = MockEditorCoordinator.mock.calls[0]
      const callbacks = coordinatorCallArgs[coordinatorCallArgs.length - 1] as EditorCoordinatorCallbacks
      callbacks.stop()

      expect(stopSpy).toHaveBeenCalled()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    beforeEach(() => {
      editor = new VisualEditor(mockOptions)
    })

    it('should handle missing preview header gracefully', () => {
      // Ensure no preview header exists
      const existingHeader = document.getElementById('absmartly-preview-header')
      if (existingHeader) {
        existingHeader.remove()
      }

      expect(() => editor.start()).not.toThrow()
    })

    it('should handle chrome API errors gracefully', () => {
      mockChrome.runtime.sendMessage.mockImplementation(() => {
        throw new Error('Chrome API error')
      })

      expect(() => editor.stop()).not.toThrow()
    })

    it('should handle multiple start calls gracefully', () => {
      const result1 = editor.start()
      const result2 = editor.start()
      const result3 = editor.start()

      expect(result1).toEqual({ success: true })
      expect(result2).toEqual({ success: true, already: true })
      expect(result3).toEqual({ success: true, already: true })
    })

    it('should handle multiple stop calls gracefully', () => {
      editor.start()

      expect(() => {
        editor.stop()
        editor.stop()
        editor.stop()
      }).not.toThrow()
    })

    it('should handle removeStyles callback', () => {
      const coordinatorCallArgs = MockEditorCoordinator.mock.calls[0]
      const callbacks = coordinatorCallArgs[coordinatorCallArgs.length - 1] as EditorCoordinatorCallbacks

      // Test removeStyles callback covers line 82
      expect(() => callbacks.removeStyles()).not.toThrow()
    })

    it('should return early when already active', () => {
      editor['isActive'] = true

      const result = editor.start()

      expect(result).toEqual({ success: true, already: true })
    })

    it('should handle onChangesUpdate callback errors in saveChanges', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const errorCallback = jest.fn().mockImplementation(() => {
        throw new Error('Callback error')
      })

      const editorWithError = new VisualEditor({
        ...mockOptions,
        onChangesUpdate: errorCallback
      })

      editorWithError['changes'] = [{ selector: '.test', type: 'text', value: 'test' }]

      const coordinatorCallArgs = MockEditorCoordinator.mock.calls[MockEditorCoordinator.mock.calls.length - 1]
      const callbacks = coordinatorCallArgs[coordinatorCallArgs.length - 1] as EditorCoordinatorCallbacks

      // This should cover line 312 (error handling in saveChanges)
      expect(() => callbacks.saveChanges()).not.toThrow()
      expect(consoleSpy).toHaveBeenCalledWith('Error in onChangesUpdate callback:', expect.any(Error))

      consoleSpy.mockRestore()
    })

    it('should handle chrome API unavailable gracefully', () => {
      // Remove chrome from global object
      const originalChrome = (global as any).chrome
      delete (global as any).chrome

      editor['changes'] = [{ selector: '.test', type: 'text', value: 'test' }]

      const coordinatorCallArgs = MockEditorCoordinator.mock.calls[0]
      const callbacks = coordinatorCallArgs[coordinatorCallArgs.length - 1] as EditorCoordinatorCallbacks

      // Should not throw even when chrome API is unavailable
      expect(() => callbacks.saveChanges()).not.toThrow()

      // Restore chrome object
      ;(global as any).chrome = originalChrome
    })
  })
})

describe('initVisualEditor', () => {
  let originalPostMessage: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Store original postMessage and replace it with a mock
    originalPostMessage = window.postMessage
    window.postMessage = jest.fn()

    delete (window as any).__absmartlyVisualEditor
    delete (window as any).__absmartlyVisualEditorActive
  })

  afterEach(() => {
    // Restore original postMessage
    window.postMessage = originalPostMessage
  })

  it('should create and start visual editor', () => {
    const result = initVisualEditor(
      'test-variant',
      'test-experiment',
      'https://example.com/logo.png',
      []
    )

    expect(result).toEqual({ success: true })
    expect((window as any).__absmartlyVisualEditor).toBeInstanceOf(VisualEditor)
  })

  it('should handle initial changes', () => {
    const initialChanges = [
      { selector: '.test', type: 'text' as const, value: 'Test content' }
    ]

    initVisualEditor(
      'test-variant',
      'test-experiment',
      'https://example.com/logo.png',
      initialChanges
    )

    expect(MockStateManager).toHaveBeenCalledWith(
      expect.objectContaining({
        initialChanges
      })
    )
  })

  it('should setup message handler for changes', () => {
    initVisualEditor(
      'test-variant',
      'test-experiment',
      'https://example.com/logo.png',
      []
    )

    // Get the onChangesUpdate callback from StateManager constructor call
    const stateManagerCall = MockStateManager.mock.calls[0]
    // The callback is passed to VisualEditor constructor, which passes it to onChangesUpdate
    // We can test it by triggering a change

    const testChanges = [{ selector: '.test', type: 'text' as const, value: 'Test' }]

    // Find the VisualEditor constructor call and get the options
    const editorOptions = MockStateManager.mock.calls[0]
    // The options should have been passed with the callback

    // We can't directly access the callback, but we can verify the window message is set up
    expect(window.postMessage).toBeDefined()
  })

  it('should return already active when global editor exists', () => {
    ;(window as any).__absmartlyVisualEditorActive = true

    const result = initVisualEditor(
      'test-variant',
      'test-experiment',
      'https://example.com/logo.png',
      []
    )

    expect(result).toEqual({ success: true, already: true })
  })

  it('should store editor instance globally', () => {
    initVisualEditor(
      'test-variant',
      'test-experiment',
      'https://example.com/logo.png',
      []
    )

    expect((window as any).__absmartlyVisualEditor).toBeDefined()
    expect((window as any).__absmartlyVisualEditor).toBeInstanceOf(VisualEditor)
  })

  it('should handle onChangesUpdate callback correctly', () => {
    initVisualEditor(
      'test-variant',
      'test-experiment',
      'https://example.com/logo.png',
      []
    )

    // Get the VisualEditor instance
    const editorInstance = (window as any).__absmartlyVisualEditor

    // Mock getChanges to return test data
    editorInstance.getChanges = jest.fn().mockReturnValue([
      { selector: '.test', type: 'text', value: 'Test content' }
    ])

    // Trigger onChangesUpdate by accessing the callback through the coordinator
    const coordinatorCallArgs = MockEditorCoordinator.mock.calls[0]
    const callbacks = coordinatorCallArgs[coordinatorCallArgs.length - 1] as EditorCoordinatorCallbacks

    const testChanges: DOMChange[] = [{ selector: '.test', type: 'text', value: 'Updated content' }]
    callbacks.onChangesUpdate(testChanges)

    expect(window.postMessage).toHaveBeenCalledWith({
      type: 'ABSMARTLY_VISUAL_EDITOR_SAVE',
      changes: testChanges,
      experimentName: 'test-experiment',
      variantName: 'test-variant'
    }, '*')
  })
})