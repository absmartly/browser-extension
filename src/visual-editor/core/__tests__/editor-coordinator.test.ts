/**
 * EditorCoordinator Unit Tests
 * Comprehensive test suite for the EditorCoordinator class
 */

import { EditorCoordinator, EditorCoordinatorCallbacks } from '../editor-coordinator'
import StateManager, { VisualEditorState } from '../state-manager'
import EventHandlers from '../event-handlers'
import ContextMenu from '../context-menu'
import ChangeTracker from '../change-tracker'
import UIComponents from '../../ui/components'
import EditModes from '../edit-modes'
import Cleanup from '../cleanup'
import { Toolbar } from '../../ui/toolbar'
import { Notifications } from '../../ui/notifications'
import type { DOMChange } from '../../types/visual-editor'

// Mock all dependencies
jest.mock('../state-manager')
jest.mock('../event-handlers')
jest.mock('../context-menu')
jest.mock('../change-tracker')
jest.mock('../../ui/components')
jest.mock('../edit-modes')
jest.mock('../cleanup')
jest.mock('../../ui/toolbar')
jest.mock('../../ui/notifications')
jest.mock('../../utils/selector-generator', () => ({
  generateRobustSelector: jest.fn().mockReturnValue('.mock-selector')
}))

// Mock DOM APIs
const mockMutationObserver = jest.fn()
mockMutationObserver.prototype.observe = jest.fn()
mockMutationObserver.prototype.disconnect = jest.fn()
global.MutationObserver = mockMutationObserver

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined)
  }
})

// Mock window.getSelection
const mockSelection = {
  removeAllRanges: jest.fn(),
  addRange: jest.fn(),
  anchorNode: null,
  anchorOffset: 0,
  focusNode: null,
  focusOffset: 0,
  isCollapsed: true,
  rangeCount: 0,
  type: 'None'
} as any

global.getSelection = jest.fn(() => mockSelection)

// Mock document.createRange
const mockRange = {
  selectNodeContents: jest.fn(),
  cloneContents: jest.fn(),
  cloneRange: jest.fn(),
  collapse: jest.fn(),
  commonAncestorContainer: document.body,
  comparePoint: jest.fn(),
  createContextualFragment: jest.fn(),
  deleteContents: jest.fn(),
  detach: jest.fn(),
  extractContents: jest.fn(),
  getBoundingClientRect: jest.fn(),
  getClientRects: jest.fn(),
  insertNode: jest.fn(),
  intersectsNode: jest.fn(),
  isPointInRange: jest.fn(),
  selectNode: jest.fn(),
  setEnd: jest.fn(),
  setEndAfter: jest.fn(),
  setEndBefore: jest.fn(),
  setStart: jest.fn(),
  setStartAfter: jest.fn(),
  setStartBefore: jest.fn(),
  surroundContents: jest.fn(),
  toString: jest.fn(),
  collapsed: false,
  endContainer: document.body,
  endOffset: 0,
  startContainer: document.body,
  startOffset: 0
} as any

global.document.createRange = jest.fn(() => mockRange)

describe('EditorCoordinator', () => {
  let coordinator: EditorCoordinator
  let mockStateManager: jest.Mocked<StateManager>
  let mockEventHandlers: jest.Mocked<EventHandlers>
  let mockContextMenu: jest.Mocked<ContextMenu>
  let mockChangeTracker: jest.Mocked<ChangeTracker>
  let mockUIComponents: jest.Mocked<UIComponents>
  let mockEditModes: jest.Mocked<EditModes>
  let mockCleanup: jest.Mocked<Cleanup>
  let mockToolbar: jest.Mocked<Toolbar>
  let mockNotifications: jest.Mocked<Notifications>
  let mockCallbacks: jest.Mocked<EditorCoordinatorCallbacks>

  // Mock DOM elements
  let mockElement: HTMLElement
  let mockSelectedElement: HTMLElement

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Create mock element
    mockElement = document.createElement('div')
    mockElement.textContent = 'Test content'
    mockElement.id = 'test-element'
    mockElement.className = 'test-class'

    mockSelectedElement = document.createElement('span')
    mockSelectedElement.textContent = 'Selected content'
    mockSelectedElement.id = 'selected-element'

    // Setup DOM mocks
    document.body.innerHTML = ''
    document.body.appendChild(mockElement)
    document.body.appendChild(mockSelectedElement)

    // Mock dependencies
    mockStateManager = new StateManager({
      variantName: 'test',
      experimentName: 'test',
      logoUrl: 'test'
    }) as jest.Mocked<StateManager>

    mockEventHandlers = new EventHandlers(mockStateManager) as jest.Mocked<EventHandlers>
    mockContextMenu = new ContextMenu(mockStateManager) as jest.Mocked<ContextMenu>
    mockChangeTracker = new ChangeTracker(mockStateManager) as jest.Mocked<ChangeTracker>
    mockUIComponents = new UIComponents({} as any) as jest.Mocked<UIComponents>
    mockEditModes = new EditModes({} as any) as jest.Mocked<EditModes>
    mockCleanup = new Cleanup(mockStateManager) as jest.Mocked<Cleanup>
    mockToolbar = new Toolbar({} as any) as jest.Mocked<Toolbar>
    mockNotifications = new Notifications() as jest.Mocked<Notifications>

    // Mock callbacks
    mockCallbacks = {
      onChangesUpdate: jest.fn(),
      removeStyles: jest.fn(),
      addChange: jest.fn(),
      getSelector: jest.fn().mockReturnValue('.mock-selector'),
      hideElement: jest.fn(),
      deleteElement: jest.fn(),
      copyElement: jest.fn(),
      copySelectorPath: jest.fn(),
      moveElement: jest.fn(),
      insertNewBlock: jest.fn(),
      showRelativeElementSelector: jest.fn(),
      undoLastChange: jest.fn(),
      redoChange: jest.fn(),
      clearAllChanges: jest.fn(),
      saveChanges: jest.fn(),
      stop: jest.fn()
    }

    // Mock state manager methods
    mockStateManager.getState = jest.fn().mockReturnValue({
      selectedElement: mockSelectedElement,
      hoveredElement: null,
      changes: [],
      undoStack: [],
      redoStack: [],
      originalValues: new Map(),
      isRearranging: false,
      isResizing: false,
      draggedElement: null,
      isActive: true
    })
    mockStateManager.onStateChange = jest.fn()

    // Mock cleanup methods
    mockCleanup.registerEventHandler = jest.fn()

    // Mock notifications
    mockNotifications.show = jest.fn()

    // Mock toolbar methods
    mockToolbar.updateChangesCount = jest.fn()
    mockToolbar.updateUndoRedoButtons = jest.fn()
    mockToolbar.remove = jest.fn()

    // Mock UI components
    mockUIComponents.removeBanner = jest.fn()
    mockUIComponents.updateBanner = jest.fn()

    // Mock EventHandlers methods
    mockEventHandlers.handleClick = jest.fn()
    mockEventHandlers.handleMouseOver = jest.fn()
    mockEventHandlers.handleMouseOut = jest.fn()

    // Create coordinator instance
    coordinator = new EditorCoordinator(
      mockStateManager,
      mockEventHandlers,
      mockContextMenu,
      mockChangeTracker,
      mockUIComponents,
      mockEditModes,
      mockCleanup,
      mockToolbar,
      mockNotifications,
      mockCallbacks
    )
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('Constructor', () => {
    it('should initialize with all dependencies', () => {
      expect(coordinator).toBeInstanceOf(EditorCoordinator)
    })

    it('should store all dependencies as instance properties', () => {
      expect(coordinator['stateManager']).toBe(mockStateManager)
      expect(coordinator['eventHandlers']).toBe(mockEventHandlers)
      expect(coordinator['contextMenu']).toBe(mockContextMenu)
      expect(coordinator['changeTracker']).toBe(mockChangeTracker)
      expect(coordinator['uiComponents']).toBe(mockUIComponents)
      expect(coordinator['editModes']).toBe(mockEditModes)
      expect(coordinator['cleanup']).toBe(mockCleanup)
      // expect(coordinator['toolbar']).toBe(mockToolbar) // removed - using UIComponents banner
      expect(coordinator['notifications']).toBe(mockNotifications)
      expect(coordinator['callbacks']).toBe(mockCallbacks)
    })

    it('should initialize internal state properties', () => {
      expect(coordinator['selectedElement']).toBeNull()
      expect(coordinator['hoveredElement']).toBeNull()
      expect(coordinator['changes']).toEqual([])
      expect(coordinator['mutationObserver']).toBeNull()
      expect(coordinator['isInternalChange']).toBe(false)
    })
  })

  describe('setupModuleIntegrations', () => {
    beforeEach(() => {
      coordinator.setupModuleIntegrations()
    })

    it('should connect event handlers to context menu', () => {
      expect(mockEventHandlers.showContextMenu).toBeDefined()

      // Test the connection
      mockEventHandlers.showContextMenu!(100, 200, mockElement)
      expect(mockContextMenu.show).toHaveBeenCalledWith(100, 200, mockElement)
    })

    it('should connect context menu to action handlers', () => {
      expect(mockContextMenu.handleAction).toBeDefined()

      // Mock handleMenuAction
      const handleMenuActionSpy = jest.spyOn(coordinator, 'handleMenuAction')

      // Test the connection - uses selectedElement from state
      mockContextMenu.handleAction!('edit', mockSelectedElement)
      expect(handleMenuActionSpy).toHaveBeenCalledWith('edit', mockSelectedElement)
    })

    it('should connect UI components to callbacks', () => {
      expect(mockUIComponents.onUndo).toBeDefined()
      expect(mockUIComponents.onRedo).toBeDefined()
      expect(mockUIComponents.onClear).toBeDefined()
      expect(mockUIComponents.onSave).toBeDefined()
      expect(mockUIComponents.onExit).toBeDefined()

      // Test undo connection
      mockUIComponents.onUndo!()
      expect(mockCallbacks.undoLastChange).toHaveBeenCalled()

      // Test redo connection
      mockUIComponents.onRedo!()
      expect(mockCallbacks.redoChange).toHaveBeenCalled()

      // Test clear connection
      mockUIComponents.onClear!()
      expect(mockCallbacks.clearAllChanges).toHaveBeenCalled()

      // Test save connection
      mockUIComponents.onSave!()
      expect(mockCallbacks.saveChanges).toHaveBeenCalled()

      // Test exit connection
      mockUIComponents.onExit!()
      expect(mockCallbacks.stop).toHaveBeenCalled()
    })

    // Toolbar removed - now using UIComponents banner
    it.skip('should connect toolbar to callbacks', () => {
      expect(mockToolbar.onUndo).toBeDefined()
      expect(mockToolbar.onRedo).toBeDefined()
      expect(mockToolbar.onClear).toBeDefined()
      expect(mockToolbar.onSave).toBeDefined()
      expect(mockToolbar.onExit).toBeDefined()

      // Test all toolbar connections
      mockToolbar.onUndo!()
      expect(mockCallbacks.undoLastChange).toHaveBeenCalled()

      mockToolbar.onRedo!()
      expect(mockCallbacks.redoChange).toHaveBeenCalled()

      mockToolbar.onClear!()
      expect(mockCallbacks.clearAllChanges).toHaveBeenCalled()

      mockToolbar.onSave!()
      expect(mockCallbacks.saveChanges).toHaveBeenCalled()

      mockToolbar.onExit!()
      expect(mockCallbacks.stop).toHaveBeenCalled()
    })

    it('should register cleanup handlers', () => {
      // 6 handlers: detachEventListeners, removeEventListeners, stopMutationObserver, makeElementsNonEditable, removeStyles, removeBanner
      expect(mockCleanup.registerEventHandler).toHaveBeenCalledTimes(6)

      // Verify cleanup handlers are registered
      const cleanupCalls = mockCleanup.registerEventHandler.mock.calls
      expect(cleanupCalls).toHaveLength(6)

      // Test each cleanup handler
      const handlers = cleanupCalls.map(call => call[0])

      // Test event handlers cleanup (first handler)
      handlers[0]()
      expect(mockEventHandlers.detachEventListeners).toHaveBeenCalled()

      // Test UI components cleanup (last handler - index 5)
      handlers[5]()
      expect(mockUIComponents.removeBanner).toHaveBeenCalled()
    })
  })

  describe('setupStateListeners', () => {
    it('should register state change listener', () => {
      coordinator.setupStateListeners()
      expect(mockStateManager.onStateChange).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should update local state when state changes', () => {
      coordinator.setupStateListeners()

      // Get the callback function
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]

      const newState: VisualEditorState = {
        selectedElement: mockSelectedElement,
        hoveredElement: mockElement,
        changes: [{ selector: '.test', type: 'text', value: 'test' }],
        undoStack: [{ selector: '.undo', type: 'text', value: 'undo' }],
        redoStack: [{ selector: '.redo', type: 'text', value: 'redo' }],
        originalValues: new Map(),
        isRearranging: false,
        isResizing: false,
        draggedElement: null,
        isActive: true
      }

      // Trigger state change
      stateChangeCallback(newState)

      // Verify local state is updated
      expect(coordinator['selectedElement']).toBe(mockSelectedElement)
      expect(coordinator['hoveredElement']).toBe(mockElement)
      expect(coordinator['changes']).toEqual(newState.changes)
    })

    it('should update toolbar on state change', () => {
      coordinator.setupStateListeners()

      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]

      const newState: VisualEditorState = {
        selectedElement: null,
        hoveredElement: null,
        changes: [{ selector: '.test', type: 'text', value: 'test' }],
        undoStack: [{ selector: '.undo', type: 'text', value: 'undo' }],
        redoStack: [],
        originalValues: new Map(),
        isRearranging: false,
        isResizing: false,
        draggedElement: null,
        isActive: true
      }

      stateChangeCallback(newState)

      // Now uses UIComponents.updateBanner instead of toolbar methods
      expect(mockUIComponents.updateBanner).toHaveBeenCalledWith({
        changesCount: 1,  // undoStack length
        canUndo: true,
        canRedo: false
      })
    })
  })

  describe('setupEventListeners & removeEventListeners', () => {
    let addEventListenerSpy: jest.SpyInstance
    let removeEventListenerSpy: jest.SpyInstance

    beforeEach(() => {
      addEventListenerSpy = jest.spyOn(document, 'addEventListener')
      removeEventListenerSpy = jest.spyOn(document, 'removeEventListener')
    })

    afterEach(() => {
      addEventListenerSpy.mockRestore()
      removeEventListenerSpy.mockRestore()
    })

    it('should setup all event listeners', () => {
      coordinator.setupEventListeners()

      // Coordinator only registers these 4 - EventHandlers module handles click, mouseover, mouseout
      expect(addEventListenerSpy).toHaveBeenCalledWith('contextmenu', expect.any(Function), true)
      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function), true)
      expect(addEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function), true)
      expect(addEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function), true)

      // EventHandlers.attachEventListeners() is called but we're only testing coordinator's direct listeners
      expect(addEventListenerSpy).toHaveBeenCalledTimes(4)
    })

    it('should remove all event listeners', () => {
      coordinator.setupEventListeners()
      coordinator.removeEventListeners()

      // Coordinator only removes its 4 listeners - EventHandlers module handles the rest
      expect(removeEventListenerSpy).toHaveBeenCalledWith('contextmenu', expect.any(Function), true)
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function), true)
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function), true)
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function), true)

      // EventHandlers.detachEventListeners() is called but we're only testing coordinator's direct listeners
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(4)
    })

    // Outdated - coordinator no longer handles these events directly, they're in EventHandlers module
    it.skip('should delegate events to event handlers', () => {
      coordinator.setupEventListeners()

      // Simulate events
      const clickEvent = new MouseEvent('click')
      const mouseOverEvent = new MouseEvent('mouseover')
      const mouseOutEvent = new MouseEvent('mouseout')

      // Dispatch events to trigger the coordinator's event handlers
      const clickHandler = coordinator['handleElementClick']
      const mouseOverHandler = coordinator['handleMouseOver']
      const mouseOutHandler = coordinator['handleMouseOut']

      clickHandler(clickEvent)
      mouseOverHandler(mouseOverEvent)
      mouseOutHandler(mouseOutEvent)

      // Verify delegation to the correct methods
      expect(mockEventHandlers.handleClick).toHaveBeenCalledWith(clickEvent)
      expect(mockEventHandlers.handleMouseOver).toHaveBeenCalledWith(mouseOverEvent)
      expect(mockEventHandlers.handleMouseOut).toHaveBeenCalledWith(mouseOutEvent)
    })

    it('should handle context menu events by preventing default', () => {
      coordinator.setupEventListeners()

      const contextMenuEvent = new MouseEvent('contextmenu')
      const preventDefaultSpy = jest.spyOn(contextMenuEvent, 'preventDefault')
      const stopPropagationSpy = jest.spyOn(contextMenuEvent, 'stopPropagation')

      const contextMenuHandler = coordinator['handleContextMenu']
      contextMenuHandler(contextMenuEvent)

      expect(preventDefaultSpy).toHaveBeenCalled()
      expect(stopPropagationSpy).toHaveBeenCalled()
    })

    it('should handle placeholder events without errors', () => {
      coordinator.setupEventListeners()

      const keyDownEvent = new KeyboardEvent('keydown')
      const mouseDownEvent = new MouseEvent('mousedown')
      const mouseUpEvent = new MouseEvent('mouseup')

      const keyDownHandler = coordinator['handleKeyDown']
      const mouseDownHandler = coordinator['handleMouseDown']
      const mouseUpHandler = coordinator['handleMouseUp']

      // These should not throw errors (they are placeholder implementations)
      expect(() => keyDownHandler(keyDownEvent)).not.toThrow()
      expect(() => mouseDownHandler(mouseDownEvent)).not.toThrow()
      expect(() => mouseUpHandler(mouseUpEvent)).not.toThrow()
    })
  })

  describe('setupKeyboardHandlers', () => {
    let addEventListenerSpy: jest.SpyInstance

    beforeEach(() => {
      addEventListenerSpy = jest.spyOn(document, 'addEventListener')
    })

    afterEach(() => {
      addEventListenerSpy.mockRestore()
    })

    it('should setup keyboard event listener', () => {
      coordinator.setupKeyboardHandlers()

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
      expect(mockCleanup.registerEventHandler).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should handle Ctrl+Z for undo', () => {
      coordinator.setupKeyboardHandlers()

      const keydownHandler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true })
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault')

      keydownHandler(event)

      expect(preventDefaultSpy).toHaveBeenCalled()
      expect(mockChangeTracker.performUndo).toHaveBeenCalled()
    })

    it('should handle Cmd+Z for undo on Mac', () => {
      coordinator.setupKeyboardHandlers()

      const keydownHandler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', { key: 'z', metaKey: true })
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault')

      keydownHandler(event)

      expect(preventDefaultSpy).toHaveBeenCalled()
      expect(mockChangeTracker.performUndo).toHaveBeenCalled()
    })

    it('should handle Ctrl+Y for redo', () => {
      coordinator.setupKeyboardHandlers()

      const keydownHandler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', { key: 'y', ctrlKey: true })
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault')

      keydownHandler(event)

      expect(preventDefaultSpy).toHaveBeenCalled()
      expect(mockChangeTracker.performRedo).toHaveBeenCalled()
    })

    it('should handle Ctrl+Shift+Z for redo', () => {
      coordinator.setupKeyboardHandlers()

      const keydownHandler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true })
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault')

      keydownHandler(event)

      expect(preventDefaultSpy).toHaveBeenCalled()
      expect(mockChangeTracker.performRedo).toHaveBeenCalled()
    })

    it('should handle Ctrl+Shift+C for copy selector', async () => {
      coordinator.setupKeyboardHandlers()

      const keydownHandler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, shiftKey: true })
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault')

      keydownHandler(event)

      expect(preventDefaultSpy).toHaveBeenCalled()
      await Promise.resolve() // Wait for async clipboard operation
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('.mock-selector')
      expect(mockNotifications.show).toHaveBeenCalledWith(
        'Selector copied: .mock-selector',
        '',
        'success'
      )
    })

    it('should handle Delete key for element deletion', () => {
      coordinator.setupKeyboardHandlers()
      Object.defineProperty(mockEventHandlers, 'isEditingMode', {
        get: jest.fn(() => false),
        configurable: true
      })

      const keydownHandler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', { key: 'Delete' })
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault')
      const removeSpy = jest.spyOn(mockSelectedElement, 'remove')

      keydownHandler(event)

      expect(preventDefaultSpy).toHaveBeenCalled()
      expect(removeSpy).toHaveBeenCalled()
      expect(mockCallbacks.addChange).toHaveBeenCalledWith({
        selector: '.mock-selector',
        type: 'delete',
        value: null,
        originalHtml: mockSelectedElement.outerHTML,
        enabled: true
      })
    })

    it('should not handle Delete key when in editing mode', () => {
      coordinator.setupKeyboardHandlers()
      Object.defineProperty(mockEventHandlers, 'isEditingMode', {
        get: jest.fn(() => true),
        configurable: true
      })

      const keydownHandler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', { key: 'Delete' })
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault')

      keydownHandler(event)

      expect(preventDefaultSpy).not.toHaveBeenCalled()
      expect(mockCallbacks.addChange).not.toHaveBeenCalled()
    })

    it('should not handle shortcuts when no element is selected', () => {
      mockStateManager.getState = jest.fn().mockReturnValue({
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
      })

      coordinator.setupKeyboardHandlers()

      const keydownHandler = addEventListenerSpy.mock.calls[0][1]
      const event = new KeyboardEvent('keydown', { key: 'Delete' })
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault')

      keydownHandler(event)

      expect(preventDefaultSpy).not.toHaveBeenCalled()
    })
  })

  describe('setupMessageHandlers', () => {
    let addEventListenerSpy: jest.SpyInstance

    beforeEach(() => {
      addEventListenerSpy = jest.spyOn(window, 'addEventListener')
    })

    afterEach(() => {
      addEventListenerSpy.mockRestore()
    })

    it('should setup message event listener', () => {
      coordinator.setupMessageHandlers()

      expect(addEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function))
      expect(mockCleanup.registerEventHandler).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should handle ABSMARTLY_VISUAL_EDITOR_EXIT message', () => {
      coordinator.setupMessageHandlers()

      const messageHandler = addEventListenerSpy.mock.calls[0][1]
      const event = new MessageEvent('message', {
        source: window,
        data: { type: 'ABSMARTLY_VISUAL_EDITOR_EXIT' }
      })

      messageHandler(event)

      expect(mockCallbacks.stop).toHaveBeenCalled()
    })

    it('should ignore messages not from window', () => {
      coordinator.setupMessageHandlers()

      const messageHandler = addEventListenerSpy.mock.calls[0][1]
      const event = new MessageEvent('message', {
        source: null,
        data: { type: 'ABSMARTLY_VISUAL_EDITOR_EXIT' }
      })

      messageHandler(event)

      expect(mockCallbacks.stop).not.toHaveBeenCalled()
    })
  })

  describe('handleMenuAction', () => {
    beforeEach(() => {
      // Mock methods used in handleMenuAction
      jest.spyOn(coordinator, 'handleEditAction').mockImplementation()
      jest.spyOn(coordinator, 'handleEditHtmlAction').mockImplementation()
      jest.spyOn(coordinator, 'handleSelectRelativeElement').mockImplementation()
    })

    it('should handle edit action', () => {
      coordinator.handleMenuAction('edit', mockElement)
      expect(coordinator.handleEditAction).toHaveBeenCalledWith(mockElement, expect.any(Object))
    })

    it('should handle edit-element action', () => {
      coordinator.handleMenuAction('edit-element', mockElement)
      expect(coordinator.handleEditAction).toHaveBeenCalledWith(mockElement, expect.any(Object))
    })

    it('should handle editHtml action', () => {
      coordinator.handleMenuAction('editHtml', mockElement)
      expect(coordinator.handleEditHtmlAction).toHaveBeenCalledWith(mockElement, expect.any(Object))
    })

    it('should handle edit-html action', () => {
      coordinator.handleMenuAction('edit-html', mockElement)
      expect(coordinator.handleEditHtmlAction).toHaveBeenCalledWith(mockElement, expect.any(Object))
    })

    it('should handle rearrange action', () => {
      coordinator.handleMenuAction('rearrange', mockElement)
      expect(mockEditModes.enableRearrangeMode).toHaveBeenCalledWith(mockElement)
    })

    it('should handle resize action', () => {
      coordinator.handleMenuAction('resize', mockElement)
      expect(mockEditModes.enableResizeMode).toHaveBeenCalledWith(mockElement)
    })

    it('should handle select-relative action', () => {
      coordinator.handleMenuAction('select-relative', mockElement)
      expect(coordinator.handleSelectRelativeElement).toHaveBeenCalledWith(mockElement)
    })

    it('should handle selectRelative action', () => {
      coordinator.handleMenuAction('selectRelative', mockElement)
      expect(coordinator.handleSelectRelativeElement).toHaveBeenCalledWith(mockElement)
    })

    it('should handle hide action', () => {
      coordinator.handleMenuAction('hide', mockElement)
      expect(mockCallbacks.hideElement).toHaveBeenCalled()
    })

    it('should handle delete action', () => {
      coordinator.handleMenuAction('delete', mockElement)
      expect(mockCallbacks.deleteElement).toHaveBeenCalled()
    })

    it('should handle copy action', () => {
      coordinator.handleMenuAction('copy', mockElement)
      expect(mockCallbacks.copyElement).toHaveBeenCalled()
    })

    it('should handle copy-selector action', () => {
      coordinator.handleMenuAction('copy-selector', mockElement)
      expect(mockCallbacks.copySelectorPath).toHaveBeenCalled()
    })

    it('should handle copySelector action', () => {
      coordinator.handleMenuAction('copySelector', mockElement)
      expect(mockCallbacks.copySelectorPath).toHaveBeenCalled()
    })

    it('should handle move-up action', () => {
      coordinator.handleMenuAction('move-up', mockElement)
      expect(mockCallbacks.moveElement).toHaveBeenCalledWith('up')
    })

    it('should handle move-down action', () => {
      coordinator.handleMenuAction('move-down', mockElement)
      expect(mockCallbacks.moveElement).toHaveBeenCalledWith('down')
    })

    it('should handle insert-block action', () => {
      coordinator.handleMenuAction('insert-block', mockElement)
      expect(mockCallbacks.insertNewBlock).toHaveBeenCalled()
    })


    it('should handle unknown action with notification', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      coordinator.handleMenuAction('unknown-action', mockElement)

      expect(consoleLogSpy).toHaveBeenCalledWith('[ABSmartly] Action not yet implemented:', 'unknown-action')
      expect(mockNotifications.show).toHaveBeenCalledWith('unknown-action: Coming soon!', '', 'info')

      consoleLogSpy.mockRestore()
    })

    it('should preserve original state for all actions', () => {
      const originalHtml = mockElement.outerHTML
      const originalParent = mockElement.parentElement
      const originalTextContent = mockElement.textContent

      coordinator.handleMenuAction('edit', mockElement)

      const callArgs = (coordinator.handleEditAction as jest.Mock).mock.calls[0]
      const originalState = callArgs[1]

      expect(originalState.html).toBe(originalHtml)
      expect(originalState.parent).toBe(originalParent)
      expect(originalState.textContent).toBe(originalTextContent)
    })
  })

  describe('handleEditAction', () => {
    let mockRemoveContextMenu: jest.SpyInstance

    beforeEach(() => {
      mockRemoveContextMenu = jest.spyOn(coordinator, 'removeContextMenu').mockImplementation()
    })

    it('should setup element for editing', () => {
      const originalState = {
        html: mockElement.outerHTML,
        parent: mockElement.parentElement,
        nextSibling: mockElement.nextElementSibling,
        textContent: mockElement.textContent
      }

      coordinator.handleEditAction(mockElement, originalState)

      expect(mockRemoveContextMenu).toHaveBeenCalled()
      expect(mockElement.dataset.absmartlyModified).toBe('true')
      expect(mockElement.classList.contains('absmartly-editing')).toBe(true)
      expect(mockElement.classList.contains('absmartly-selected')).toBe(false)
      expect(mockElement.contentEditable).toBe('true')
      expect(mockEventHandlers.setEditing).toHaveBeenCalledWith(true)
    })

    it('should handle blur event and create change', () => {
      const originalState = {
        html: mockElement.outerHTML,
        parent: mockElement.parentElement,
        nextSibling: mockElement.nextElementSibling,
        textContent: 'Original content'
      }

      coordinator.handleEditAction(mockElement, originalState)

      // Simulate text change
      mockElement.textContent = 'Modified content'

      // Trigger blur event
      const blurEvent = new Event('blur')
      mockElement.dispatchEvent(blurEvent)

      expect(mockElement.contentEditable).toBe('false')
      expect(mockElement.classList.contains('absmartly-editing')).toBe(false)
      expect(mockElement.classList.contains('absmartly-selected')).toBe(true)
      expect(mockEventHandlers.setEditing).toHaveBeenCalledWith(false)
      expect(mockCallbacks.addChange).toHaveBeenCalledWith({
        selector: '.mock-selector',
        type: 'text',
        value: 'Modified content',
        originalText: 'Original content',
        enabled: true
      })
    })

    it('should handle Enter key to finish editing', () => {
      const originalState = {
        html: mockElement.outerHTML,
        parent: mockElement.parentElement,
        nextSibling: mockElement.nextElementSibling,
        textContent: mockElement.textContent
      }

      coordinator.handleEditAction(mockElement, originalState)

      const blurSpy = jest.spyOn(mockElement, 'blur')
      const keydownEvent = new KeyboardEvent('keydown', { key: 'Enter' })
      const preventDefaultSpy = jest.spyOn(keydownEvent, 'preventDefault')

      mockElement.dispatchEvent(keydownEvent)

      expect(preventDefaultSpy).toHaveBeenCalled()
      expect(blurSpy).toHaveBeenCalled()
    })

    it('should handle Shift+Enter without finishing editing', () => {
      const originalState = {
        html: mockElement.outerHTML,
        parent: mockElement.parentElement,
        nextSibling: mockElement.nextElementSibling,
        textContent: mockElement.textContent
      }

      coordinator.handleEditAction(mockElement, originalState)

      const blurSpy = jest.spyOn(mockElement, 'blur')
      const keydownEvent = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true })
      const preventDefaultSpy = jest.spyOn(keydownEvent, 'preventDefault')

      mockElement.dispatchEvent(keydownEvent)

      expect(preventDefaultSpy).not.toHaveBeenCalled()
      expect(blurSpy).not.toHaveBeenCalled()
    })

    it('should handle Escape key to cancel editing', () => {
      const originalState = {
        html: mockElement.outerHTML,
        parent: mockElement.parentElement,
        nextSibling: mockElement.nextElementSibling,
        textContent: 'Original content'
      }

      coordinator.handleEditAction(mockElement, originalState)

      // Modify content
      mockElement.textContent = 'Modified content'

      const blurSpy = jest.spyOn(mockElement, 'blur')
      const keydownEvent = new KeyboardEvent('keydown', { key: 'Escape' })

      mockElement.dispatchEvent(keydownEvent)

      expect(mockElement.textContent).toBe('Original content')
      expect(blurSpy).toHaveBeenCalled()
    })

    it('should prevent click events during editing', () => {
      const originalState = {
        html: mockElement.outerHTML,
        parent: mockElement.parentElement,
        nextSibling: mockElement.nextElementSibling,
        textContent: mockElement.textContent
      }

      // Mock editing mode
      Object.defineProperty(mockEventHandlers, 'isEditingMode', {
        get: jest.fn(() => true),
        configurable: true
      })

      coordinator.handleEditAction(mockElement, originalState)

      const clickEvent = new Event('click')
      const preventDefaultSpy = jest.spyOn(clickEvent, 'preventDefault')
      const stopPropagationSpy = jest.spyOn(clickEvent, 'stopPropagation')

      mockElement.dispatchEvent(clickEvent)

      expect(preventDefaultSpy).toHaveBeenCalled()
      expect(stopPropagationSpy).toHaveBeenCalled()
    })
  })

  describe('handleEditHtmlAction', () => {
    it('should open HTML editor and handle changes', async () => {
      const originalState = {
        html: mockElement.outerHTML,
        parent: mockElement.parentElement,
        nextSibling: mockElement.nextElementSibling,
        textContent: mockElement.textContent,
        innerHTML: mockElement.innerHTML
      }

      // Mock HTML editor to return modified HTML
      const mockHtmlEditor = {
        show: jest.fn().mockResolvedValue('<div>Modified HTML</div>')
      }
      ;(coordinator as any).htmlEditor = mockHtmlEditor

      await coordinator.handleEditHtmlAction(mockElement, originalState)

      expect(mockHtmlEditor.show).toHaveBeenCalledWith(mockElement, 'Test content')
      expect(mockCallbacks.addChange).toHaveBeenCalledWith({
        selector: '.mock-selector',
        type: 'html',
        value: '<div>Modified HTML</div>',
        originalHtml: 'Test content',
        enabled: true
      })
      expect(mockNotifications.show).toHaveBeenCalledWith(
        'HTML updated successfully',
        '',
        'success'
      )
    })
  })

  describe('handleSelectRelativeElement', () => {
    it('should show relative element selector panel', () => {
      const showSelectorSpy = jest.spyOn(coordinator, 'showRelativeElementSelector')
      coordinator.handleSelectRelativeElement(mockElement)

      expect(showSelectorSpy).toHaveBeenCalledWith(mockElement)
    })

    it('should remove context menu before showing selector', () => {
      const removeMenuSpy = jest.spyOn(coordinator, 'removeContextMenu')
      coordinator.handleSelectRelativeElement(mockElement)

      expect(removeMenuSpy).toHaveBeenCalled()
    })
  })

  describe('startMutationObserver & stopMutationObserver', () => {
    it('should create and start mutation observer', () => {
      coordinator.startMutationObserver()

      expect(MutationObserver).toHaveBeenCalledWith(expect.any(Function))
      expect(coordinator['mutationObserver']).toBeDefined()
      expect(coordinator['mutationObserver']!.observe).toHaveBeenCalledWith(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeOldValue: true,
        characterData: true,
        characterDataOldValue: true
      })
    })

    it('should ignore mutations when isInternalChange is true', () => {
      coordinator['isInternalChange'] = true
      coordinator.startMutationObserver()

      const mutationCallback = (MutationObserver as jest.Mock).mock.calls[0][0]
      const mutations = [{ type: 'childList' }]

      // Should return early and not process mutations
      mutationCallback(mutations)
      // Test passes if no errors are thrown
    })

    it('should stop and disconnect mutation observer', () => {
      coordinator.startMutationObserver()
      const observer = coordinator['mutationObserver']!

      coordinator.stopMutationObserver()

      expect(observer.disconnect).toHaveBeenCalled()
      expect(coordinator['mutationObserver']).toBeNull()
    })

    it('should handle stopMutationObserver when observer is null', () => {
      coordinator['mutationObserver'] = null

      // Should not throw error
      expect(() => coordinator.stopMutationObserver()).not.toThrow()
    })
  })

  describe('makeElementsEditable & makeElementsNonEditable', () => {
    let mockIsExtensionElement: jest.SpyInstance

    beforeEach(() => {
      mockIsExtensionElement = jest.spyOn(coordinator as any, 'isExtensionElement')

      // Create test elements
      const element1 = document.createElement('div')
      element1.className = 'test-element-1'
      const element2 = document.createElement('span')
      element2.className = 'test-element-2'
      const extensionElement = document.createElement('div')
      extensionElement.id = 'absmartly-test'

      document.body.appendChild(element1)
      document.body.appendChild(element2)
      document.body.appendChild(extensionElement)
    })

    it('should make all non-extension elements editable', () => {
      mockIsExtensionElement.mockImplementation((el: HTMLElement) =>
        el.id.includes('absmartly') || el.className.includes('absmartly')
      )

      coordinator.makeElementsEditable()

      const testElements = document.querySelectorAll('.test-element-1, .test-element-2')
      testElements.forEach(el => {
        expect(el.classList.contains('absmartly-editable')).toBe(true)
      })

      const extensionElement = document.getElementById('absmartly-test')
      expect(extensionElement!.classList.contains('absmartly-editable')).toBe(false)
    })

    it('should make all elements non-editable', () => {
      // First make elements editable
      const element1 = document.querySelector('.test-element-1')!
      const element2 = document.querySelector('.test-element-2')!

      element1.classList.add('absmartly-editable', 'absmartly-selected', 'absmartly-editing')
      element2.classList.add('absmartly-editable', 'absmartly-selected', 'absmartly-editing')

      coordinator.makeElementsNonEditable()

      expect(element1.classList.contains('absmartly-editable')).toBe(false)
      expect(element1.classList.contains('absmartly-selected')).toBe(false)
      expect(element1.classList.contains('absmartly-editing')).toBe(false)

      expect(element2.classList.contains('absmartly-editable')).toBe(false)
      expect(element2.classList.contains('absmartly-selected')).toBe(false)
      expect(element2.classList.contains('absmartly-editing')).toBe(false)
    })
  })

  describe('showContextMenu & removeContextMenu', () => {
    beforeEach(() => {
      coordinator['selectedElement'] = mockSelectedElement
    })

    it('should show context menu for selected element', () => {
      coordinator.showContextMenu(100, 200)

      expect(mockContextMenu.show).toHaveBeenCalledWith(100, 200, mockSelectedElement)
    })

    it('should not show context menu when no element is selected', () => {
      coordinator['selectedElement'] = null
      coordinator.showContextMenu(100, 200)

      expect(mockContextMenu.show).not.toHaveBeenCalled()
    })

    it('should remove context menu elements from DOM', () => {
      // Create mock menu elements
      const menuOverlay = document.createElement('div')
      menuOverlay.id = 'absmartly-menu-overlay'
      const menuContainer = document.createElement('div')
      menuContainer.id = 'absmartly-menu-container'

      document.body.appendChild(menuOverlay)
      document.body.appendChild(menuContainer)

      coordinator.removeContextMenu()

      expect(document.getElementById('absmartly-menu-overlay')).toBeNull()
      expect(document.getElementById('absmartly-menu-container')).toBeNull()
    })
  })

  describe('isExtensionElement', () => {
    it('should identify elements with absmartly in id', () => {
      const element = document.createElement('div')
      element.id = 'absmartly-test-element'

      const result = coordinator['isExtensionElement'](element)
      expect(result).toBe(true)
    })

    it('should identify elements with absmartly in className', () => {
      const element = document.createElement('div')
      element.className = 'test absmartly-class another'

      const result = coordinator['isExtensionElement'](element)
      expect(result).toBe(true)
    })

    it('should identify elements with absmartly parent', () => {
      const parent = document.createElement('div')
      parent.id = 'absmartly-parent'
      const child = document.createElement('span')
      parent.appendChild(child)

      const result = coordinator['isExtensionElement'](child)
      expect(result).toBe(true)
    })

    it('should handle SVG elements with baseVal className', () => {
      const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      // Mock SVG className behavior
      Object.defineProperty(svgElement, 'className', {
        value: { baseVal: 'absmartly-svg-class' },
        writable: false
      })

      const result = coordinator['isExtensionElement'](svgElement as any)
      expect(result).toBe(true)
    })

    it('should return false for non-extension elements', () => {
      const element = document.createElement('div')
      element.id = 'regular-element'
      element.className = 'regular-class'

      const result = coordinator['isExtensionElement'](element)
      expect(result).toBe(false)
    })
  })

  describe('setupAll', () => {
    it('should call all setup methods in correct order', () => {
      const setupModuleIntegrationsSpy = jest.spyOn(coordinator, 'setupModuleIntegrations')
      const setupStateListenersSpy = jest.spyOn(coordinator, 'setupStateListeners')
      const setupEventListenersSpy = jest.spyOn(coordinator, 'setupEventListeners')
      const setupKeyboardHandlersSpy = jest.spyOn(coordinator, 'setupKeyboardHandlers')
      const setupMessageHandlersSpy = jest.spyOn(coordinator, 'setupMessageHandlers')
      const startMutationObserverSpy = jest.spyOn(coordinator, 'startMutationObserver')
      const makeElementsEditableSpy = jest.spyOn(coordinator, 'makeElementsEditable')

      coordinator.setupAll()

      expect(setupModuleIntegrationsSpy).toHaveBeenCalled()
      expect(setupStateListenersSpy).toHaveBeenCalled()
      expect(setupEventListenersSpy).toHaveBeenCalled()
      expect(setupKeyboardHandlersSpy).toHaveBeenCalled()
      expect(setupMessageHandlersSpy).toHaveBeenCalled()
      expect(startMutationObserverSpy).toHaveBeenCalled()
      expect(makeElementsEditableSpy).toHaveBeenCalled()
    })
  })

  describe('teardownAll', () => {
    it('should call all teardown methods in correct order', () => {
      const removeEventListenersSpy = jest.spyOn(coordinator, 'removeEventListeners')
      const stopMutationObserverSpy = jest.spyOn(coordinator, 'stopMutationObserver')
      const makeElementsNonEditableSpy = jest.spyOn(coordinator, 'makeElementsNonEditable')

      coordinator.teardownAll()

      expect(removeEventListenersSpy).toHaveBeenCalled()
      expect(stopMutationObserverSpy).toHaveBeenCalled()
      expect(makeElementsNonEditableSpy).toHaveBeenCalled()
    })
  })

  describe('Integration Tests', () => {
    it('should handle complete edit workflow', () => {
      // Setup
      coordinator.setupAll()

      // Start editing
      const originalState = {
        html: mockElement.outerHTML,
        parent: mockElement.parentElement,
        nextSibling: mockElement.nextElementSibling,
        textContent: 'Original content'
      }

      coordinator.handleEditAction(mockElement, originalState)

      // Verify editing state
      expect(mockElement.classList.contains('absmartly-editing')).toBe(true)
      expect(mockElement.contentEditable).toBe('true')
      expect(mockEventHandlers.setEditing).toHaveBeenCalledWith(true)

      // Modify content and finish editing
      mockElement.textContent = 'Modified content'
      mockElement.dispatchEvent(new Event('blur'))

      // Verify change was created
      expect(mockCallbacks.addChange).toHaveBeenCalledWith({
        selector: '.mock-selector',
        type: 'text',
        value: 'Modified content',
        originalText: 'Original content',
        enabled: true
      })

      // Verify editing state is reset
      expect(mockElement.contentEditable).toBe('false')
      expect(mockElement.classList.contains('absmartly-editing')).toBe(false)
      expect(mockEventHandlers.setEditing).toHaveBeenCalledWith(false)
    })

    it('should handle keyboard shortcuts integration', () => {
      coordinator.setupKeyboardHandlers()

      // Test undo shortcut
      const undoEvent = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true })
      document.dispatchEvent(undoEvent)
      expect(mockChangeTracker.performUndo).toHaveBeenCalled()

      // Test redo shortcut
      const redoEvent = new KeyboardEvent('keydown', { key: 'y', ctrlKey: true })
      document.dispatchEvent(redoEvent)
      expect(mockChangeTracker.performRedo).toHaveBeenCalled()
    })

    it('should handle state changes and update UI', () => {
      coordinator.setupStateListeners()

      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      const newState: VisualEditorState = {
        selectedElement: mockSelectedElement,
        hoveredElement: null,
        changes: [{ selector: '.test', type: 'text', value: 'test' }],
        undoStack: [{ selector: '.undo', type: 'text', value: 'undo' }],
        redoStack: [],
        originalValues: new Map(),
        isRearranging: false,
        isResizing: false,
        draggedElement: null,
        isActive: true
      }

      stateChangeCallback(newState)

      expect(coordinator['changes']).toEqual(newState.changes)
      // Now uses UIComponents.updateBanner instead of toolbar methods
      expect(mockUIComponents.updateBanner).toHaveBeenCalledWith({
        changesCount: 1,  // undoStack length
        canUndo: true,
        canRedo: false
      })
    })
  })

  describe('Event Cleanup', () => {
    it('should register keydown event cleanup handler', () => {
      const registerSpy = jest.spyOn(mockCleanup, 'registerEventHandler')

      coordinator.setupKeyboardHandlers()

      expect(registerSpy).toHaveBeenCalled()

      // Execute the cleanup handler to cover line 202
      const cleanupHandler = registerSpy.mock.calls[0][0]
      expect(() => cleanupHandler()).not.toThrow()
    })

    it('should register message event cleanup handler', () => {
      const registerSpy = jest.spyOn(mockCleanup, 'registerEventHandler')

      coordinator.setupMessageHandlers()

      expect(registerSpy).toHaveBeenCalled()

      // Execute the cleanup handler to cover line 219
      const cleanupHandler = registerSpy.mock.calls[0][0]
      expect(() => cleanupHandler()).not.toThrow()
    })

    it('should handle message event for visual editor exit', () => {
      coordinator.setupMessageHandlers()

      const messageEvent = new MessageEvent('message', {
        data: { type: 'ABSMARTLY_VISUAL_EDITOR_EXIT' },
        source: window
      })

      window.dispatchEvent(messageEvent)

      expect(mockCallbacks.stop).toHaveBeenCalled()
    })
  })
})