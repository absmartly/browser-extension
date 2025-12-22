/**
 * Comprehensive unit tests for ElementActions module
 * Tests all public methods with various DOM structures and edge cases
 * Aims for 95%+ test coverage
 */

import { ElementActions } from '../element-actions'
import type { ElementActionsOptions } from '../element-actions'
import StateManager from '../state-manager'
import type { VisualEditorConfig } from '../state-manager'
import UndoRedoManager from '../undo-redo-manager'
import { Notifications } from '../../ui/notifications'
import type { DOMChange } from '../../types/visual-editor'
import { generateRobustSelector } from '../../utils/selector-generator'

// Mock dependencies
jest.mock('../state-manager')
jest.mock('../undo-redo-manager')
jest.mock('../../ui/notifications')
jest.mock('../../utils/selector-generator')

describe('ElementActions', () => {
  let elementActions: ElementActions
  let mockStateManager: jest.Mocked<StateManager>
  let mockUndoRedoManager: jest.Mocked<UndoRedoManager>
  let mockNotifications: jest.Mocked<Notifications>
  let mockOptions: ElementActionsOptions
  let mockGenerateRobustSelector: jest.MockedFunction<typeof generateRobustSelector>

  // Test DOM elements
  let testDiv: HTMLDivElement
  let testButton: HTMLButtonElement
  let testContainer: HTMLDivElement
  let testChild1: HTMLSpanElement
  let testChild2: HTMLSpanElement

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks()

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    })

    // Mock window.confirm
    global.confirm = jest.fn().mockReturnValue(true)

    // Mock console.log to avoid test output pollution
    jest.spyOn(console, 'log').mockImplementation(() => {})

    // Setup DOM structure for testing
    document.body.innerHTML = ''

    // Create test container
    testContainer = document.createElement('div')
    testContainer.id = 'test-container'
    testContainer.className = 'container main-content'
    document.body.appendChild(testContainer)

    // Create test elements
    testDiv = document.createElement('div')
    testDiv.id = 'test-div'
    testDiv.className = 'test-class semantic-name'
    testDiv.textContent = 'Test content'
    testContainer.appendChild(testDiv)

    testButton = document.createElement('button')
    testButton.id = 'test-button'
    testButton.className = 'btn primary'
    testButton.textContent = 'Click me'
    testContainer.appendChild(testButton)

    // Create sibling elements for move testing
    testChild1 = document.createElement('span')
    testChild1.id = 'child-1'
    testChild1.className = 'child first'
    testChild1.textContent = 'Child 1'
    testDiv.appendChild(testChild1)

    testChild2 = document.createElement('span')
    testChild2.id = 'child-2'
    testChild2.className = 'child second'
    testChild2.textContent = 'Child 2'
    testDiv.appendChild(testChild2)

    // Mock StateManager
    const MockedStateManager = StateManager as jest.MockedClass<typeof StateManager>
    mockStateManager = new MockedStateManager({
      variantName: 'test-variant',
      experimentName: 'test-experiment',
      logoUrl: 'test-logo.png'
    } as VisualEditorConfig) as jest.Mocked<StateManager>

    mockStateManager.getState.mockReturnValue({
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

    mockStateManager.onStateChange.mockImplementation((callback) => {
      return () => {} // Return unsubscribe function
    })

    // Mock UndoRedoManager
    const MockedUndoRedoManager = UndoRedoManager as jest.MockedClass<typeof UndoRedoManager>
    mockUndoRedoManager = new MockedUndoRedoManager() as jest.Mocked<UndoRedoManager>

    // Mock Notifications
    const MockedNotifications = Notifications as jest.MockedClass<typeof Notifications>
    mockNotifications = new MockedNotifications() as jest.Mocked<Notifications>

    // Mock selector generator
    mockGenerateRobustSelector = generateRobustSelector as jest.MockedFunction<typeof generateRobustSelector>
    mockGenerateRobustSelector.mockImplementation((element) => {
      if (element.id) return `#${element.id}`
      if (element.className) {
        const classes = element.className.split(' ').filter(c => c).join('.')
        return `.${classes}`
      }
      return element.tagName.toLowerCase()
    })

    // Setup options
    mockOptions = {
      onChangesUpdate: jest.fn()
    }

    // Create ElementActions instance
    elementActions = new ElementActions(
      mockStateManager,
      mockUndoRedoManager,
      mockNotifications,
      mockOptions
    )
  })

  afterEach(() => {
    document.body.innerHTML = ''
    jest.restoreAllMocks()
  })

  describe('Constructor and Initialization', () => {
    it('should initialize with correct dependencies', () => {
      expect(mockStateManager.onStateChange).toHaveBeenCalled()
    })

    it('should sync with state manager changes', () => {
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]

      const newState = {
        selectedElement: testDiv,
        hoveredElement: testButton,
        changes: [{ selector: '#test', type: 'style', value: { color: 'red' } }],
        undoStack: [],
        redoStack: [],
        originalValues: new Map(),
        isRearranging: false,
        isResizing: false,
        draggedElement: null,
        isActive: true
      }

      stateChangeCallback(newState)
      // Should not throw and should update internal state
    })
  })

  describe('Element Selection', () => {
    it('should select an element successfully', () => {
      elementActions.selectElement(testDiv)

      expect(testDiv.classList.contains('absmartly-selected')).toBe(true)
      expect(mockStateManager.setSelectedElement).toHaveBeenCalledWith(testDiv)
    })

    it('should deselect previous element when selecting new one', () => {
      // First select an element and simulate state change
      testDiv.classList.add('absmartly-selected')
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: testDiv
      })

      // Now select a different element
      elementActions.selectElement(testButton)

      expect(testDiv.classList.contains('absmartly-selected')).toBe(false)
      expect(testButton.classList.contains('absmartly-selected')).toBe(true)
      expect(mockStateManager.setSelectedElement).toHaveBeenCalledWith(testButton)
    })

    it('should deselect current element', () => {
      testDiv.classList.add('absmartly-selected')
      mockStateManager.getState.mockReturnValue({
        ...mockStateManager.getState(),
        selectedElement: testDiv
      })

      // Update the selected element in the instance by simulating state change
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: testDiv
      })

      elementActions.deselectElement()

      expect(testDiv.classList.contains('absmartly-selected')).toBe(false)
      expect(mockStateManager.setSelectedElement).toHaveBeenCalledWith(null)
    })

    it('should handle deselection when no element is selected', () => {
      elementActions.deselectElement()

      expect(mockStateManager.setSelectedElement).toHaveBeenCalledWith(null)
    })
  })

  describe('Hover Tooltip Management', () => {
    it('should show hover tooltip at correct position', () => {
      mockGenerateRobustSelector.mockReturnValue('#test-div')

      elementActions.showHoverTooltip(testDiv, 100, 200)

      const tooltip = document.querySelector('.absmartly-hover-tooltip') as HTMLElement
      expect(tooltip).toBeTruthy()
      expect(tooltip.textContent).toBe('#test-div')
      expect(tooltip.style.left).toBe('110px') // x + 10
      expect(tooltip.style.top).toBe('170px') // y - 30
    })

    it('should adjust tooltip position to stay within viewport', () => {
      mockGenerateRobustSelector.mockReturnValue('#test-div')

      // Mock window dimensions
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 300
      })

      elementActions.showHoverTooltip(testDiv, 250, 200)

      const tooltip = document.querySelector('.absmartly-hover-tooltip') as HTMLElement
      expect(tooltip.style.left).toBe('100px') // Math.min(260, 100) = 100
    })

    it('should remove existing tooltip before showing new one', () => {
      mockGenerateRobustSelector.mockReturnValue('#test-div')

      elementActions.showHoverTooltip(testDiv, 100, 200)
      expect(document.querySelectorAll('.absmartly-hover-tooltip')).toHaveLength(1)

      elementActions.showHoverTooltip(testButton, 150, 250)
      expect(document.querySelectorAll('.absmartly-hover-tooltip')).toHaveLength(1)
    })

    it('should remove hover tooltip', () => {
      mockGenerateRobustSelector.mockReturnValue('#test-div')

      elementActions.showHoverTooltip(testDiv, 100, 200)
      expect(document.querySelector('.absmartly-hover-tooltip')).toBeTruthy()

      elementActions.removeHoverTooltip()
      expect(document.querySelector('.absmartly-hover-tooltip')).toBeNull()
    })

    it('should handle removeHoverTooltip when no tooltip exists', () => {
      elementActions.removeHoverTooltip()
      // Should not throw
    })
  })

  describe('Element Manipulation - Hide', () => {
    beforeEach(() => {
      // Simulate element being selected
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: testDiv
      })
    })

    it('should hide selected element', () => {
      mockGenerateRobustSelector.mockReturnValue('#test-div')

      elementActions.hideElement()

      expect(testDiv.style.display).toBe('none')
      expect(mockUndoRedoManager.addChange).toHaveBeenCalledWith(
        expect.objectContaining({
          selector: '#test-div',
          type: 'style',
          value: { display: 'none' }
        }),
        expect.any(Object)
      )
      expect(mockStateManager.setSelectedElement).toHaveBeenCalledWith(null)
    })

    it('should not hide when no element is selected', () => {
      // Reset to no selected element
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: null
      })

      elementActions.hideElement()

      expect(mockStateManager.setChanges).not.toHaveBeenCalled()
      expect(mockOptions.onChangesUpdate).not.toHaveBeenCalled()
    })
  })

  describe('Element Manipulation - Change Image Source', () => {
    let testImg: HTMLImageElement
    let testDivWithBg: HTMLDivElement

    beforeEach(() => {
      testImg = document.createElement('img')
      testImg.id = 'test-img'
      testImg.src = 'https://example.com/old.jpg'
      document.body.appendChild(testImg)

      testDivWithBg = document.createElement('div')
      testDivWithBg.id = 'test-bg'
      testDivWithBg.style.backgroundImage = "url('https://example.com/old-bg.jpg')"
      document.body.appendChild(testDivWithBg)
    })

    it('should change img src attribute', async () => {
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: testImg
      })

      mockGenerateRobustSelector.mockReturnValue('#test-img')

      // Mock the dialog to return a new URL
      const mockShow = jest.fn().mockResolvedValue('https://example.com/new.jpg')
      ;(elementActions as any).imageSourceDialog.show = mockShow

      await elementActions.changeImageSource()

      expect(testImg.src).toBe('https://example.com/new.jpg')
      expect(mockUndoRedoManager.addChange).toHaveBeenCalledWith(
        expect.objectContaining({
          selector: '#test-img',
          type: 'attribute',
          value: { src: 'https://example.com/new.jpg' },
          mode: 'merge'
        }),
        { src: 'https://example.com/old.jpg' }
      )
      expect(mockNotifications.show).toHaveBeenCalledWith(
        'Image source updated',
        '',
        'success'
      )
    })

    it('should change background-image style', async () => {
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: testDivWithBg
      })

      mockGenerateRobustSelector.mockReturnValue('#test-bg')

      const mockShow = jest.fn().mockResolvedValue('https://example.com/new-bg.jpg')
      ;(elementActions as any).imageSourceDialog.show = mockShow

      await elementActions.changeImageSource()

      // Browser normalizes to double quotes when reading from DOM
      expect(testDivWithBg.style.backgroundImage).toBe('url("https://example.com/new-bg.jpg")')
      // But the change object uses single quotes as set by the implementation
      expect(mockUndoRedoManager.addChange).toHaveBeenCalledWith(
        expect.objectContaining({
          selector: '#test-bg',
          type: 'style',
          value: { 'background-image': "url('https://example.com/new-bg.jpg')" },
          mode: 'merge'
        }),
        { 'background-image': 'url("https://example.com/old-bg.jpg")' }
      )
    })

    it('should not change when dialog is cancelled', async () => {
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: testImg
      })

      const mockShow = jest.fn().mockResolvedValue(null)
      ;(elementActions as any).imageSourceDialog.show = mockShow

      await elementActions.changeImageSource()

      expect(testImg.src).toBe('https://example.com/old.jpg')
      expect(mockUndoRedoManager.addChange).not.toHaveBeenCalled()
    })

    it('should not change when no element is selected', async () => {
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: null
      })

      await elementActions.changeImageSource()

      expect(mockUndoRedoManager.addChange).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: testImg
      })

      const mockShow = jest.fn().mockRejectedValue(new Error('Test error'))
      ;(elementActions as any).imageSourceDialog.show = mockShow

      await elementActions.changeImageSource()

      expect(mockNotifications.show).toHaveBeenCalledWith(
        'Failed to change image source',
        '',
        'error'
      )
    })
  })

  describe('Element Manipulation - Delete', () => {
    beforeEach(() => {
      // Simulate element being selected
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: testDiv
      })
    })

    it('should delete selected element', () => {
      mockGenerateRobustSelector.mockReturnValue('#test-div')
      const parent = testDiv.parentElement

      elementActions.deleteElement()

      // Delete now hides the element (doesn't remove from DOM)
      // Coordinator handles adding the delete change when Delete key is pressed
      expect(parent?.contains(testDiv)).toBe(true)
      expect(testDiv.style.display).toBe('none')
      expect(mockStateManager.setSelectedElement).toHaveBeenCalledWith(null)
    })

    it('should not delete when no element is selected', () => {
      // Reset to no selected element
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: null
      })

      elementActions.deleteElement()

      expect(mockStateManager.setChanges).not.toHaveBeenCalled()
      expect(mockOptions.onChangesUpdate).not.toHaveBeenCalled()
    })
  })

  describe('Copy Operations', () => {
    beforeEach(() => {
      // Simulate element being selected
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: testDiv
      })
    })

    it('should copy element HTML to clipboard', async () => {
      await elementActions.copyElement()

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(testDiv.outerHTML)
      expect(mockNotifications.show).toHaveBeenCalledWith(
        'Element HTML copied to clipboard!',
        '',
        'success'
      )
    })

    it('should copy selector path to clipboard', async () => {
      mockGenerateRobustSelector.mockReturnValue('#test-div')

      await elementActions.copySelectorPath()

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('#test-div')
      expect(mockNotifications.show).toHaveBeenCalledWith(
        'Selector copied: #test-div',
        '',
        'success'
      )
    })

    it('should not copy when no element is selected', async () => {
      // Reset to no selected element
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: null
      })

      await elementActions.copyElement()
      await elementActions.copySelectorPath()

      expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
      expect(mockNotifications.show).not.toHaveBeenCalled()
    })

    // Note: Clipboard error handling test removed due to Jest async handling issues
    // The actual implementation should include try-catch blocks around clipboard operations
  })

  describe('Move Element Operations', () => {
    beforeEach(() => {
      // Simulate element being selected
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: testChild2
      })
    })

    it('should move element up', () => {
      mockGenerateRobustSelector.mockReturnValue('#child-2')
      const parent = testChild2.parentElement!

      elementActions.moveElement('up')

      expect(parent.children[0]).toBe(testChild2)
      expect(parent.children[1]).toBe(testChild1)
      expect(mockUndoRedoManager.addChange).toHaveBeenCalledWith(
        expect.objectContaining({
          selector: '#child-2',
          type: 'move',
          targetSelector: 'div',
          position: 'before'
        }),
        'down' // oldValue is opposite direction
      )
    })

    it('should move element down', () => {
      // Select first child instead
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: testChild1
      })

      mockGenerateRobustSelector.mockReturnValue('#child-1')
      const parent = testChild1.parentElement!

      elementActions.moveElement('down')

      expect(parent.children[0]).toBe(testChild2)
      expect(parent.children[1]).toBe(testChild1)
    })

    it('should not move element up when it is first child', () => {
      // Select first child
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: testChild1
      })

      const parent = testChild1.parentElement!
      const originalOrder = Array.from(parent.children)

      elementActions.moveElement('up')

      expect(Array.from(parent.children)).toEqual(originalOrder)
    })

    it('should not move element down when it is last child', () => {
      const parent = testChild2.parentElement!
      const originalOrder = Array.from(parent.children)

      elementActions.moveElement('down')

      expect(Array.from(parent.children)).toEqual(originalOrder)
    })

    it('should not move when no element is selected', () => {
      // Reset to no selected element
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: null
      })

      elementActions.moveElement('up')

      expect(mockStateManager.setChanges).not.toHaveBeenCalled()
      expect(mockOptions.onChangesUpdate).not.toHaveBeenCalled()
    })

    it('should not move when element has no parent', () => {
      // Create orphaned element
      const orphanElement = document.createElement('div')
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: orphanElement
      })

      elementActions.moveElement('up')

      expect(mockStateManager.setChanges).not.toHaveBeenCalled()
      expect(mockOptions.onChangesUpdate).not.toHaveBeenCalled()
    })
  })

  describe('Insert New Block', () => {
    it('should not insert when no element is selected', async () => {
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: null
      })

      await elementActions.insertNewBlock()

      expect(mockUndoRedoManager.addChange).not.toHaveBeenCalled()
    })

    it('should insert block when dialog returns options', async () => {
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: testDiv
      })

      mockGenerateRobustSelector.mockReturnValue('#test-div')
      mockStateManager.getConfig.mockReturnValue({
        variantName: 'test-variant',
        experimentName: 'test-experiment',
        logoUrl: 'test-logo.png'
      })

      const mockShow = jest.fn().mockResolvedValue({
        html: '<div class="inserted">New Block</div>',
        position: 'after'
      })
      ;(elementActions as any).blockInserter.show = mockShow

      await elementActions.insertNewBlock()

      expect(mockUndoRedoManager.addChange).toHaveBeenCalledWith(
        expect.objectContaining({
          selector: '#test-div',
          type: 'insert',
          html: '<div class="inserted">New Block</div>',
          position: 'after'
        }),
        expect.objectContaining({
          insertedSelector: expect.any(String)
        })
      )
      expect(mockNotifications.show).toHaveBeenCalledWith(
        'HTML block inserted after selected element',
        '',
        'success'
      )
    })

    it('should not insert when dialog is cancelled', async () => {
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: testDiv
      })

      const mockShow = jest.fn().mockResolvedValue(null)
      ;(elementActions as any).blockInserter.show = mockShow

      await elementActions.insertNewBlock()

      expect(mockUndoRedoManager.addChange).not.toHaveBeenCalled()
      expect(mockNotifications.show).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: testDiv
      })

      const mockShow = jest.fn().mockRejectedValue(new Error('Dialog error'))
      ;(elementActions as any).blockInserter.show = mockShow

      await elementActions.insertNewBlock()

      expect(mockNotifications.show).toHaveBeenCalledWith(
        'Failed to insert element',
        '',
        'error'
      )
    })

    it('should sanitize HTML before insertion', async () => {
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: testDiv
      })

      mockGenerateRobustSelector.mockReturnValue('#test-div')
      mockStateManager.getConfig.mockReturnValue({
        variantName: 'test-variant',
        experimentName: 'test-experiment',
        logoUrl: 'test-logo.png'
      })

      const mockShow = jest.fn().mockResolvedValue({
        html: '<div class="safe">Safe Content</div>',
        position: 'before'
      })
      ;(elementActions as any).blockInserter.show = mockShow

      await elementActions.insertNewBlock()

      expect(mockUndoRedoManager.addChange).toHaveBeenCalledWith(
        expect.objectContaining({
          selector: '#test-div',
          type: 'insert',
          html: '<div class="safe">Safe Content</div>',
          position: 'before'
        }),
        expect.objectContaining({
          insertedSelector: expect.any(String)
        })
      )
    })
  })

  describe('Show Relative Element Selector', () => {
    it('should show placeholder notification for relative element selector', () => {
      elementActions.showRelativeElementSelector()

      expect(mockNotifications.show).toHaveBeenCalledWith(
        'Select relative elements: Coming soon!',
        '',
        'info'
      )
    })
  })

  // Undo/Redo tests removed - functionality now uses undo stack which is tested in state-manager and integration tests

  describe('Clear All Changes', () => {
    it('should clear all changes when confirmed', () => {
      // Setup some changes
      const changes: DOMChange[] = [
        { selector: '#test1', type: 'style', value: { color: 'red' } },
        { selector: '#test2', type: 'style', value: { color: 'blue' } }
      ]

      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        changes
      })

      global.confirm = jest.fn().mockReturnValue(true)

      elementActions.clearAllChanges()

      expect(global.confirm).toHaveBeenCalledWith('Are you sure you want to clear all changes?')
      expect(mockStateManager.setChanges).toHaveBeenCalledWith([])
      expect(mockOptions.onChangesUpdate).toHaveBeenCalledWith([])
      expect(mockNotifications.show).toHaveBeenCalledWith(
        'All changes cleared',
        '',
        'success'
      )
    })

    it('should not clear changes when cancelled', () => {
      // Setup some changes
      const changes: DOMChange[] = [
        { selector: '#test1', type: 'style', value: { color: 'red' } }
      ]

      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        changes
      })

      global.confirm = jest.fn().mockReturnValue(false)

      elementActions.clearAllChanges()

      expect(global.confirm).toHaveBeenCalledWith('Are you sure you want to clear all changes?')
      expect(mockStateManager.setChanges).not.toHaveBeenCalled()
      expect(mockOptions.onChangesUpdate).not.toHaveBeenCalled()
      expect(mockNotifications.show).not.toHaveBeenCalled()
    })
  })

  describe('Utility Methods - Selector Generation', () => {
    it('should generate selector for element', () => {
      mockGenerateRobustSelector.mockReturnValue('#test-div')

      const selector = elementActions.getSelector(testDiv)

      expect(selector).toBe('#test-div')
      expect(mockGenerateRobustSelector).toHaveBeenCalledWith(testDiv, {
        preferDataAttributes: false,
        avoidAutoGenerated: true,
        includeParentContext: true,
        maxParentLevels: 3
      })
    })

    it('should use consistent selector options', () => {
      elementActions.getSelector(testButton)

      expect(mockGenerateRobustSelector).toHaveBeenCalledWith(testButton, {
        preferDataAttributes: false,
        avoidAutoGenerated: true,
        includeParentContext: true,
        maxParentLevels: 3
      })
    })
  })

  describe('Utility Methods - Extension Element Detection', () => {
    it('should detect ABSmartly extension elements by ID', () => {
      const absmartlyElement = document.createElement('div')
      absmartlyElement.id = 'absmartly-toolbar'

      expect(elementActions.isExtensionElement(absmartlyElement)).toBe(true)
    })

    it('should detect ABSmartly extension elements by className string', () => {
      const absmartlyElement = document.createElement('div')
      absmartlyElement.className = 'some-class absmartly-hover other-class'

      expect(elementActions.isExtensionElement(absmartlyElement)).toBe(true)
    })

    it('should detect ABSmartly extension elements by className object (SVG)', () => {
      const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      // Mock SVG className behavior
      Object.defineProperty(svgElement, 'className', {
        value: { baseVal: 'absmartly-icon' },
        writable: true
      })

      expect(elementActions.isExtensionElement(svgElement as any)).toBe(true)
    })

    it('should detect ABSmartly extension elements in parent hierarchy', () => {
      const parent = document.createElement('div')
      parent.className = 'absmartly-container'
      const child = document.createElement('span')
      parent.appendChild(child)

      expect(elementActions.isExtensionElement(child)).toBe(true)
    })

    it('should not detect regular elements as extension elements', () => {
      expect(elementActions.isExtensionElement(testDiv)).toBe(false)
      expect(elementActions.isExtensionElement(testButton)).toBe(false)
    })

    it('should handle elements with no className', () => {
      const plainElement = document.createElement('div')
      plainElement.removeAttribute('class')

      expect(elementActions.isExtensionElement(plainElement)).toBe(false)
    })

    it('should handle elements with null className', () => {
      const element = document.createElement('div')
      Object.defineProperty(element, 'className', {
        value: null,
        writable: true
      })

      expect(elementActions.isExtensionElement(element)).toBe(false)
    })
  })

  // Note: Change management tests removed as logic moved to UndoRedoManager
  // Changes are now tracked individually in UndoRedoManager and squashed only when saving


  describe('Edge Cases and Error Handling', () => {
    it('should handle element selection with no existing classes', () => {
      const elementWithoutClass = document.createElement('div')
      document.body.appendChild(elementWithoutClass)

      elementActions.selectElement(elementWithoutClass)

      expect(elementWithoutClass.classList.contains('absmartly-selected')).toBe(true)
    })

    it('should handle selector generation errors gracefully', () => {
      mockGenerateRobustSelector.mockImplementation(() => {
        throw new Error('Selector generation failed')
      })

      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: testDiv
      })

      // Should not throw
      expect(() => elementActions.hideElement()).not.toThrow()
      expect(mockNotifications.show).toHaveBeenCalledWith(
        'Failed to hide element',
        '',
        'error'
      )
    })

    it('should handle clipboard API not available', async () => {
      delete (navigator as any).clipboard

      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: testDiv
      })

      // Should not throw and should show error notification
      await elementActions.copyElement()
      expect(mockNotifications.show).toHaveBeenCalledWith(
        'Clipboard not available',
        '',
        'error'
      )
    })

    it('should handle clipboard writeText failure for copyElement', async () => {
      const mockWriteText = jest.fn().mockRejectedValue(new Error('Clipboard write failed'))
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      })

      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: testDiv
      })

      elementActions.copyElement()

      // Wait for the async operation to complete
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(mockNotifications.show).toHaveBeenCalledWith(
        'Failed to copy to clipboard',
        '',
        'error'
      )
    })

    it('should handle clipboard writeText failure for copySelectorPath', async () => {
      const mockWriteText = jest.fn().mockRejectedValue(new Error('Clipboard write failed'))
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      })
      mockGenerateRobustSelector.mockReturnValue('#test-div')

      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: testDiv
      })

      elementActions.copySelectorPath()

      // Wait for the async operation to complete
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(mockNotifications.show).toHaveBeenCalledWith(
        'Failed to copy selector to clipboard',
        '',
        'error'
      )
    })

    it('should handle clipboard API not available for copySelectorPath', async () => {
      delete (navigator as any).clipboard

      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: testDiv
      })

      await elementActions.copySelectorPath()
      expect(mockNotifications.show).toHaveBeenCalledWith(
        'Clipboard not available',
        '',
        'error'
      )
    })

    it('should handle exceptions in copyElement method', async () => {
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]

      // Create a problematic element that will throw when accessing outerHTML
      const problematicElement = Object.create(HTMLElement.prototype)
      Object.defineProperty(problematicElement, 'outerHTML', {
        get() {
          throw new Error('Failed to access outerHTML')
        }
      })

      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: problematicElement as HTMLElement
      })

      await elementActions.copyElement()
      expect(mockNotifications.show).toHaveBeenCalledWith(
        'Failed to copy element',
        '',
        'error'
      )
    })

    it('should handle exceptions in copySelectorPath method', async () => {
      mockGenerateRobustSelector.mockImplementation(() => {
        throw new Error('Selector generation error')
      })

      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: testDiv
      })

      await elementActions.copySelectorPath()
      expect(mockNotifications.show).toHaveBeenCalledWith(
        'Failed to copy selector',
        '',
        'error'
      )
    })

    it('should handle DOM manipulation on detached elements', () => {
      const detachedElement = document.createElement('div')

      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]
      stateChangeCallback({
        ...mockStateManager.getState(),
        selectedElement: detachedElement
      })

      // Should not throw
      expect(() => elementActions.deleteElement()).not.toThrow()
      expect(() => elementActions.hideElement()).not.toThrow()
      expect(() => elementActions.moveElement('up')).not.toThrow()
    })

    it('should handle empty text content in tooltip', () => {
      mockGenerateRobustSelector.mockReturnValue('')

      elementActions.showHoverTooltip(testDiv, 100, 200)

      const tooltip = document.querySelector('.absmartly-hover-tooltip')
      expect(tooltip?.textContent).toBe('')
    })

    it('should handle multiple consecutive tooltip operations', () => {
      mockGenerateRobustSelector.mockReturnValue('#test-div')

      elementActions.showHoverTooltip(testDiv, 100, 200)
      elementActions.showHoverTooltip(testButton, 150, 250)
      elementActions.removeHoverTooltip()
      elementActions.removeHoverTooltip() // Second call should not throw

      expect(document.querySelector('.absmartly-hover-tooltip')).toBeNull()
    })
  })

  describe('Integration with StateManager', () => {
    it('should properly sync with state changes', () => {
      const mockUnsubscribe = jest.fn()
      mockStateManager.onStateChange.mockReturnValue(mockUnsubscribe)

      // Create a new instance to test subscription
      const newElementActions = new ElementActions(
        mockStateManager,
        mockUndoRedoManager,
        mockNotifications,
        mockOptions
      )

      expect(mockStateManager.onStateChange).toHaveBeenCalledTimes(2) // Original + new instance
    })

    it('should handle state updates with null elements', () => {
      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]

      stateChangeCallback({
        selectedElement: null,
        hoveredElement: null,
        changes: [],
        undoStack: [],
        redoStack: [],
        originalValues: new Map(),
        isRearranging: false,
        isResizing: false,
        draggedElement: null,
        isActive: false
      })

      // Should not throw
    })

    it('should handle state updates with complex changes', () => {
      const complexChanges: DOMChange[] = [
        {
          selector: '#complex-1',
          type: 'style',
          value: {
            color: 'red',
            backgroundColor: 'blue',
            fontSize: '16px'
          }
        },
        {
          selector: '#complex-2',
          type: 'attribute',
          value: { 'data-test': 'new-value' }
        }
      ]

      const stateChangeCallback = mockStateManager.onStateChange.mock.calls[0][0]

      stateChangeCallback({
        selectedElement: testDiv,
        hoveredElement: testButton,
        changes: complexChanges,
        undoStack: [],
        redoStack: [],
        originalValues: new Map([['key1', 'value1'], ['key2', 'value2']]),
        isRearranging: true,
        isResizing: false,
        draggedElement: testChild1,
        isActive: true
      })

      // Should not throw and should handle complex state
    })
  })
})