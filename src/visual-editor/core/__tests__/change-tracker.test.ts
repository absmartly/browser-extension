/**
 * @jest-environment jsdom
 */

import { ChangeTracker, ChangeAction, UndoRedoAction } from '../change-tracker'
import StateManager, { VisualEditorConfig } from '../state-manager'

// Mock StateManager
jest.mock('../state-manager')

describe('ChangeTracker', () => {
  let changeTracker: ChangeTracker
  let mockStateManager: jest.Mocked<StateManager>
  let container: HTMLElement
  let bannerHost: HTMLElement
  let shadowRoot: ShadowRoot

  const mockConfig: VisualEditorConfig = {
    variantName: 'variant-a',
    experimentName: 'test-experiment',
    logoUrl: 'https://example.com/logo.png'
  }

  beforeEach(() => {
    // Clear document
    document.body.innerHTML = ''

    // Create container for test elements
    container = document.createElement('div')
    container.id = 'test-container'
    document.body.appendChild(container)

    // Create mock banner host with shadow DOM
    bannerHost = document.createElement('div')
    bannerHost.id = 'absmartly-visual-editor-banner-host'
    shadowRoot = bannerHost.attachShadow({ mode: 'open' })

    // Create mock UI elements in shadow DOM
    shadowRoot.innerHTML = `
      <button data-action="undo" disabled>Undo</button>
      <button data-action="redo" disabled>Redo</button>
      <span class="changes-counter">0 changes</span>
    `

    document.body.appendChild(bannerHost)

    // Mock StateManager
    const mockState = {
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

    mockStateManager = {
      getState: jest.fn().mockReturnValue(mockState),
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

    // Mock constructor
    ;(StateManager as jest.MockedClass<typeof StateManager>).mockImplementation(() => mockStateManager)

    changeTracker = new ChangeTracker(mockStateManager)

    // Mock window.postMessage
    global.window.postMessage = jest.fn()

    // Mock Date.now for consistent timestamps
    jest.spyOn(Date, 'now').mockReturnValue(1234567890)

    // Mock Math.random for consistent IDs
    jest.spyOn(Math, 'random').mockReturnValue(0.123456789)
    // This will generate consistent ID string
  })

  afterEach(() => {
    jest.restoreAllMocks()
    document.body.innerHTML = ''
  })

  describe('Change Recording', () => {
    let testElement: HTMLElement

    beforeEach(() => {
      testElement = document.createElement('div')
      testElement.id = 'test-element'
      testElement.textContent = 'Original text'
      container.appendChild(testElement)
    })

    test('should record edit change', () => {
      const changeData = {
        oldText: 'Original text',
        newText: 'New text'
      }

      changeTracker.trackChange('edit', testElement, changeData)

      expect(mockStateManager.addChange).toHaveBeenCalledWith({
        type: 'edit',
        element: testElement,
        data: changeData,
        timestamp: 1234567890,
        id: 'change_1234567890_4fzzzxjyl'
      })

      expect(mockStateManager.pushUndo).toHaveBeenCalledWith({
        type: 'undo',
        originalAction: {
          type: 'edit',
          element: testElement,
          data: changeData,
          timestamp: 1234567890,
          id: 'change_1234567890_4fzzzxjyl'
        },
        undoData: {
          restoreText: 'Original text',
          element: testElement
        }
      })
    })

    test('should record editHtml change', () => {
      const changeData = {
        oldHtml: '<span>Original</span>',
        newHtml: '<span>New</span>'
      }

      changeTracker.trackChange('editHtml', testElement, changeData)

      expect(mockStateManager.addChange).toHaveBeenCalled()
      expect(mockStateManager.pushUndo).toHaveBeenCalledWith(
        expect.objectContaining({
          undoData: {
            restoreHtml: '<span>Original</span>',
            element: testElement
          }
        })
      )
    })

    test('should record hide change', () => {
      const changeData = {}

      changeTracker.trackChange('hide', testElement, changeData)

      expect(mockStateManager.pushUndo).toHaveBeenCalledWith(
        expect.objectContaining({
          undoData: {
            restoreDisplay: 'block',
            element: testElement
          }
        })
      )
    })

    test('should record delete change', () => {
      const parentElement = document.createElement('div')
      const nextSibling = document.createElement('span')

      const changeData = {
        deletedHtml: '<div id="test-element">Original text</div>',
        parent: parentElement,
        nextSibling: nextSibling
      }

      changeTracker.trackChange('delete', testElement, changeData)

      expect(mockStateManager.pushUndo).toHaveBeenCalledWith(
        expect.objectContaining({
          undoData: {
            restoreHtml: '<div id="test-element">Original text</div>',
            parentElement: parentElement,
            nextSibling: nextSibling
          }
        })
      )
    })

    test('should record move change', () => {
      const originalParent = document.createElement('div')
      const originalNextSibling = document.createElement('span')

      const changeData = {
        originalParent: originalParent,
        originalNextSibling: originalNextSibling
      }

      changeTracker.trackChange('move', testElement, changeData)

      expect(mockStateManager.pushUndo).toHaveBeenCalledWith(
        expect.objectContaining({
          undoData: {
            originalParent: originalParent,
            originalNextSibling: originalNextSibling,
            element: testElement
          }
        })
      )
    })

    test('should record resize change', () => {
      const changeData = {
        originalStyles: {
          width: '100px',
          height: '50px'
        }
      }

      changeTracker.trackChange('resize', testElement, changeData)

      expect(mockStateManager.pushUndo).toHaveBeenCalledWith(
        expect.objectContaining({
          undoData: {
            originalStyles: {
              width: '100px',
              height: '50px'
            },
            element: testElement
          }
        })
      )
    })

    test('should record insert change', () => {
      const changeData = {}

      changeTracker.trackChange('insert', testElement, changeData)

      expect(mockStateManager.pushUndo).toHaveBeenCalledWith(
        expect.objectContaining({
          undoData: {
            insertedElement: testElement
          }
        })
      )
    })

    test('should generate unique change IDs', () => {
      // Clear existing mocks
      jest.restoreAllMocks()

      // Mock different random values and timestamps
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(1234567890)
        .mockReturnValueOnce(1234567891)

      jest.spyOn(Math, 'random')
        .mockReturnValueOnce(0.1)
        .mockReturnValueOnce(0.9)

      changeTracker.trackChange('edit', testElement, { oldText: 'test1', newText: 'new1' })
      changeTracker.trackChange('edit', testElement, { oldText: 'test2', newText: 'new2' })

      const firstCall = (mockStateManager.addChange as jest.Mock).mock.calls[0][0]
      const secondCall = (mockStateManager.addChange as jest.Mock).mock.calls[1][0]

      expect(firstCall.id).not.toBe(secondCall.id)
      expect(firstCall.timestamp).not.toBe(secondCall.timestamp)
    })
  })

  describe('Undo Operations', () => {
    let testElement: HTMLElement

    beforeEach(() => {
      testElement = document.createElement('div')
      testElement.id = 'test-element'
      testElement.textContent = 'Original text'
      container.appendChild(testElement)
    })

    test('should perform undo for edit action', () => {
      const undoAction: UndoRedoAction = {
        type: 'undo',
        originalAction: {
          type: 'edit',
          element: testElement,
          data: { oldText: 'Original', newText: 'Modified' },
          timestamp: 1234567890,
          id: 'test-id'
        },
        undoData: {
          restoreText: 'Original',
          element: testElement
        }
      }

      mockStateManager.popUndo.mockReturnValue(undoAction)

      // Set current state
      testElement.textContent = 'Modified'

      changeTracker.performUndo()

      expect(testElement.textContent).toBe('Original')
      expect(mockStateManager.pushRedo).toHaveBeenCalled()
    })

    test('should perform undo for editHtml action', () => {
      const parentDiv = document.createElement('div')
      testElement.innerHTML = '<span>Modified HTML</span>'
      parentDiv.appendChild(testElement)

      const undoAction: UndoRedoAction = {
        type: 'undo',
        originalAction: {
          type: 'editHtml',
          element: testElement,
          data: { oldHtml: '<span>Original</span>', newHtml: '<span>Modified</span>' },
          timestamp: 1234567890,
          id: 'test-id'
        },
        undoData: {
          restoreHtml: '<span>Original HTML</span>',
          element: testElement
        }
      }

      mockStateManager.popUndo.mockReturnValue(undoAction)

      changeTracker.performUndo()

      // Should replace the element
      expect(parentDiv.querySelector('span')?.textContent).toBe('Original HTML')
      expect(mockStateManager.pushRedo).toHaveBeenCalled()
    })

    test('should perform undo for hide action', () => {
      const undoAction: UndoRedoAction = {
        type: 'undo',
        originalAction: {
          type: 'hide',
          element: testElement,
          data: {},
          timestamp: 1234567890,
          id: 'test-id'
        },
        undoData: {
          restoreDisplay: 'block',
          element: testElement
        }
      }

      mockStateManager.popUndo.mockReturnValue(undoAction)

      // Set hidden state
      testElement.style.display = 'none'

      changeTracker.performUndo()

      expect(testElement.style.display).toBe('block')
      expect(mockStateManager.pushRedo).toHaveBeenCalled()
    })

    test('should perform undo for delete action', () => {
      const parentElement = document.createElement('div')
      const nextSibling = document.createElement('span')
      parentElement.appendChild(nextSibling)

      const undoAction: UndoRedoAction = {
        type: 'undo',
        originalAction: {
          type: 'delete',
          element: testElement,
          data: {},
          timestamp: 1234567890,
          id: 'test-id'
        },
        undoData: {
          restoreHtml: '<div id="test-element">Restored content</div>',
          parentElement: parentElement,
          nextSibling: nextSibling
        }
      }

      mockStateManager.popUndo.mockReturnValue(undoAction)

      changeTracker.performUndo()

      // Should restore element before nextSibling
      const restoredElement = parentElement.querySelector('#test-element')
      expect(restoredElement).toBeTruthy()
      expect(restoredElement?.textContent).toBe('Restored content')
      expect(restoredElement?.nextSibling).toBe(nextSibling)
    })

    test('should perform undo for delete action without nextSibling', () => {
      const parentElement = document.createElement('div')

      const undoAction: UndoRedoAction = {
        type: 'undo',
        originalAction: {
          type: 'delete',
          element: testElement,
          data: {},
          timestamp: 1234567890,
          id: 'test-id'
        },
        undoData: {
          restoreHtml: '<div id="test-element">Restored content</div>',
          parentElement: parentElement,
          nextSibling: null
        }
      }

      mockStateManager.popUndo.mockReturnValue(undoAction)

      changeTracker.performUndo()

      // Should append to parent
      const restoredElement = parentElement.querySelector('#test-element')
      expect(restoredElement).toBeTruthy()
      expect(restoredElement?.textContent).toBe('Restored content')
    })

    test('should perform undo for move action', () => {
      const originalParent = document.createElement('div')
      const originalNextSibling = document.createElement('span')
      originalParent.appendChild(originalNextSibling)

      // Move element to different location
      const newParent = document.createElement('div')
      newParent.appendChild(testElement)

      const undoAction: UndoRedoAction = {
        type: 'undo',
        originalAction: {
          type: 'move',
          element: testElement,
          data: {},
          timestamp: 1234567890,
          id: 'test-id'
        },
        undoData: {
          originalParent: originalParent,
          originalNextSibling: originalNextSibling,
          element: testElement
        }
      }

      mockStateManager.popUndo.mockReturnValue(undoAction)

      changeTracker.performUndo()

      // Should move back to original position
      expect(testElement.parentElement).toBe(originalParent)
      expect(testElement.nextSibling).toBe(originalNextSibling)
    })

    test('should perform undo for move action without nextSibling', () => {
      const originalParent = document.createElement('div')

      // Move element to different location
      const newParent = document.createElement('div')
      newParent.appendChild(testElement)

      const undoAction: UndoRedoAction = {
        type: 'undo',
        originalAction: {
          type: 'move',
          element: testElement,
          data: {},
          timestamp: 1234567890,
          id: 'test-id'
        },
        undoData: {
          originalParent: originalParent,
          originalNextSibling: null,
          element: testElement
        }
      }

      mockStateManager.popUndo.mockReturnValue(undoAction)

      changeTracker.performUndo()

      // Should append to original parent
      expect(testElement.parentElement).toBe(originalParent)
    })

    test('should perform undo for resize action', () => {
      const undoAction: UndoRedoAction = {
        type: 'undo',
        originalAction: {
          type: 'resize',
          element: testElement,
          data: {},
          timestamp: 1234567890,
          id: 'test-id'
        },
        undoData: {
          originalStyles: {
            width: '100px',
            height: '50px'
          },
          element: testElement
        }
      }

      mockStateManager.popUndo.mockReturnValue(undoAction)

      // Set current styles
      testElement.style.width = '200px'
      testElement.style.height = '100px'

      changeTracker.performUndo()

      expect(testElement.style.width).toBe('100px')
      expect(testElement.style.height).toBe('50px')
    })

    test('should perform undo for insert action', () => {
      const insertedElement = document.createElement('div')
      insertedElement.textContent = 'Inserted content'
      container.appendChild(insertedElement)

      const undoAction: UndoRedoAction = {
        type: 'undo',
        originalAction: {
          type: 'insert',
          element: insertedElement,
          data: {},
          timestamp: 1234567890,
          id: 'test-id'
        },
        undoData: {
          insertedElement: insertedElement
        }
      }

      mockStateManager.popUndo.mockReturnValue(undoAction)

      expect(container.contains(insertedElement)).toBe(true)

      changeTracker.performUndo()

      expect(container.contains(insertedElement)).toBe(false)
    })

    test('should handle undo when no actions available', () => {
      mockStateManager.popUndo.mockReturnValue(null)

      // Should not throw
      expect(() => changeTracker.performUndo()).not.toThrow()

      expect(mockStateManager.pushRedo).not.toHaveBeenCalled()
    })

    test('should handle undo with missing elements gracefully', () => {
      const undoAction: UndoRedoAction = {
        type: 'undo',
        originalAction: {
          type: 'edit',
          element: null,
          data: { oldText: 'test', newText: 'new' },
          timestamp: 1234567890,
          id: 'test-id'
        },
        undoData: {
          restoreText: 'test',
          element: null
        }
      }

      mockStateManager.popUndo.mockReturnValue(undoAction)

      // Should not throw with null element
      expect(() => changeTracker.performUndo()).not.toThrow()
    })
  })

  describe('Redo Operations', () => {
    let testElement: HTMLElement

    beforeEach(() => {
      testElement = document.createElement('div')
      testElement.id = 'test-element'
      testElement.textContent = 'Original text'
      container.appendChild(testElement)
    })

    test('should perform redo for edit action', () => {
      const redoAction: UndoRedoAction = {
        type: 'redo',
        originalAction: {
          type: 'edit',
          element: testElement,
          data: { oldText: 'Original', newText: 'Modified' },
          timestamp: 1234567890,
          id: 'test-id'
        },
        undoData: { oldText: 'Original', newText: 'Modified' }
      }

      mockStateManager.popRedo.mockReturnValue(redoAction)

      // Set original state
      testElement.textContent = 'Original'

      changeTracker.performRedo()

      expect(testElement.textContent).toBe('Modified')
      expect(mockStateManager.pushUndo).toHaveBeenCalled()
    })

    test('should perform redo for editHtml action', () => {
      const parentDiv = document.createElement('div')
      testElement.innerHTML = '<span>Original HTML</span>'
      parentDiv.appendChild(testElement)

      const redoAction: UndoRedoAction = {
        type: 'redo',
        originalAction: {
          type: 'editHtml',
          element: testElement,
          data: { oldHtml: '<span>Original</span>', newHtml: '<span>Modified HTML</span>' },
          timestamp: 1234567890,
          id: 'test-id'
        },
        undoData: { oldHtml: '<span>Original</span>', newHtml: '<span>Modified</span>' }
      }

      mockStateManager.popRedo.mockReturnValue(redoAction)

      changeTracker.performRedo()

      // Should replace the element with new HTML
      expect(parentDiv.querySelector('span')?.textContent).toBe('Modified HTML')
    })

    test('should perform redo for hide action', () => {
      const redoAction: UndoRedoAction = {
        type: 'redo',
        originalAction: {
          type: 'hide',
          element: testElement,
          data: {},
          timestamp: 1234567890,
          id: 'test-id'
        },
        undoData: {}
      }

      mockStateManager.popRedo.mockReturnValue(redoAction)

      // Set visible state
      testElement.style.display = 'block'

      changeTracker.performRedo()

      expect(testElement.style.display).toBe('none')
    })

    test('should perform redo for delete action', () => {
      const redoAction: UndoRedoAction = {
        type: 'redo',
        originalAction: {
          type: 'delete',
          element: testElement,
          data: {},
          timestamp: 1234567890,
          id: 'test-id'
        },
        undoData: {}
      }

      mockStateManager.popRedo.mockReturnValue(redoAction)

      expect(container.contains(testElement)).toBe(true)

      changeTracker.performRedo()

      expect(container.contains(testElement)).toBe(false)
    })

    test('should handle redo when no actions available', () => {
      mockStateManager.popRedo.mockReturnValue(null)

      // Should not throw
      expect(() => changeTracker.performRedo()).not.toThrow()

      expect(mockStateManager.pushUndo).not.toHaveBeenCalled()
    })

    test('should handle redo with missing elements gracefully', () => {
      const redoAction: UndoRedoAction = {
        type: 'redo',
        originalAction: {
          type: 'edit',
          element: null,
          data: { oldText: 'test', newText: 'new' },
          timestamp: 1234567890,
          id: 'test-id'
        },
        undoData: { oldText: 'test', newText: 'new' }
      }

      mockStateManager.popRedo.mockReturnValue(redoAction)

      // Should not throw with null element
      expect(() => changeTracker.performRedo()).not.toThrow()
    })
  })

  describe('UI Updates', () => {
    test('should update undo/redo buttons when stacks are empty', () => {
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

      changeTracker.trackChange('edit', container.querySelector('#test-element'), {
        oldText: 'old',
        newText: 'new'
      })

      const undoBtn = shadowRoot.querySelector('[data-action="undo"]') as HTMLButtonElement
      const redoBtn = shadowRoot.querySelector('[data-action="redo"]') as HTMLButtonElement

      expect(undoBtn.disabled).toBe(true)
      expect(redoBtn.disabled).toBe(true)
    })

    test('should update undo/redo buttons when stacks have items', () => {
      mockStateManager.getState.mockReturnValue({
        selectedElement: null,
        hoveredElement: null,
        changes: [],
        undoStack: [{ type: 'undo' }],
        redoStack: [{ type: 'redo' }],
        originalValues: new Map(),
        isRearranging: false,
        isResizing: false,
        draggedElement: null,
        isActive: true
      })

      changeTracker.trackChange('edit', container.querySelector('#test-element'), {
        oldText: 'old',
        newText: 'new'
      })

      const undoBtn = shadowRoot.querySelector('[data-action="undo"]') as HTMLButtonElement
      const redoBtn = shadowRoot.querySelector('[data-action="redo"]') as HTMLButtonElement

      expect(undoBtn.disabled).toBe(false)
      expect(redoBtn.disabled).toBe(false)
    })

    test('should update changes counter', () => {
      mockStateManager.getState.mockReturnValue({
        selectedElement: null,
        hoveredElement: null,
        changes: [{ id: '1' }, { id: '2' }, { id: '3' }],
        undoStack: [],
        redoStack: [],
        originalValues: new Map(),
        isRearranging: false,
        isResizing: false,
        draggedElement: null,
        isActive: true
      })

      changeTracker.trackChange('edit', container.querySelector('#test-element'), {
        oldText: 'old',
        newText: 'new'
      })

      const counter = shadowRoot.querySelector('.changes-counter')
      expect(counter?.textContent).toBe('3 changes')
    })

    test('should handle missing banner elements gracefully', () => {
      // Remove banner host
      bannerHost.remove()

      // Should not throw when banner is missing
      expect(() => {
        changeTracker.trackChange('edit', container.querySelector('#test-element'), {
          oldText: 'old',
          newText: 'new'
        })
      }).not.toThrow()
    })

    test('should handle missing shadow root gracefully', () => {
      // Create new banner without shadow root
      const newBanner = document.createElement('div')
      newBanner.id = 'absmartly-visual-editor-banner-host'
      bannerHost.replaceWith(newBanner)

      // Should not throw when shadow root is missing
      expect(() => {
        changeTracker.trackChange('edit', container.querySelector('#test-element'), {
          oldText: 'old',
          newText: 'new'
        })
      }).not.toThrow()
    })
  })

  describe('Selector Generation', () => {
    test('should generate selector using element ID', () => {
      const element = document.createElement('div')
      element.id = 'unique-element'
      container.appendChild(element)

      changeTracker.trackChange('edit', element, { oldText: 'old', newText: 'new' })

      expect(window.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          change: expect.objectContaining({
            selector: '#unique-element'
          })
        }),
        '*'
      )
    })

    test('should generate selector using element classes', () => {
      const element = document.createElement('div')
      element.className = 'primary-button secondary large'
      container.appendChild(element)

      changeTracker.trackChange('edit', element, { oldText: 'old', newText: 'new' })

      expect(window.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          change: expect.objectContaining({
            selector: '.primary-button.secondary'
          })
        }),
        '*'
      )
    })

    test('should fallback to tag name when no ID or classes', () => {
      const element = document.createElement('span')
      container.appendChild(element)

      changeTracker.trackChange('edit', element, { oldText: 'old', newText: 'new' })

      expect(window.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          change: expect.objectContaining({
            selector: 'span'
          })
        }),
        '*'
      )
    })

    test('should handle selector generation errors gracefully', () => {
      const element = {
        get id() { throw new Error('Test error') },
        get className() { throw new Error('Test error') },
        get tagName() { return 'DIV' }
      } as any

      changeTracker.trackChange('edit', element, { oldText: 'old', newText: 'new' })

      expect(window.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          change: expect.objectContaining({
            selector: 'div'
          })
        }),
        '*'
      )
    })

    test('should filter empty classes', () => {
      const element = document.createElement('div')
      element.className = 'valid-class    another-class   '
      container.appendChild(element)

      changeTracker.trackChange('edit', element, { oldText: 'old', newText: 'new' })

      expect(window.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          change: expect.objectContaining({
            selector: '.valid-class.another-class'
          })
        }),
        '*'
      )
    })

    test('should limit classes to first two', () => {
      const element = document.createElement('div')
      element.className = 'first second third fourth fifth'
      container.appendChild(element)

      changeTracker.trackChange('edit', element, { oldText: 'old', newText: 'new' })

      expect(window.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          change: expect.objectContaining({
            selector: '.first.second'
          })
        }),
        '*'
      )
    })
  })

  describe('Message Passing', () => {
    test('should send change to extension with correct format', () => {
      const element = document.createElement('div')
      element.id = 'test-element'
      const changeData = { oldText: 'old', newText: 'new' }

      changeTracker.trackChange('edit', element, changeData)

      expect(window.postMessage).toHaveBeenCalledWith({
        type: 'ABSMARTLY_VISUAL_EDITOR_CHANGE',
        change: {
          type: 'edit',
          selector: '#test-element',
          data: changeData,
          timestamp: 1234567890,
          id: 'change_1234567890_4fzzzxjyl'
        }
      }, '*')
    })

    test('should handle null element in message', () => {
      const changeData = { someData: 'value' }

      changeTracker.trackChange('edit', null, changeData)

      expect(window.postMessage).toHaveBeenCalledWith({
        type: 'ABSMARTLY_VISUAL_EDITOR_CHANGE',
        change: {
          type: 'edit',
          selector: null,
          data: changeData,
          timestamp: 1234567890,
          id: 'change_1234567890_4fzzzxjyl'
        }
      }, '*')
    })
  })

  describe('Export/Import Changes', () => {
    test('should export changes from state manager', () => {
      const mockChanges: ChangeAction[] = [
        { type: 'edit', element: null, data: {}, timestamp: 123, id: '1' },
        { type: 'hide', element: null, data: {}, timestamp: 124, id: '2' }
      ]

      mockStateManager.getState.mockReturnValue({
        selectedElement: null,
        hoveredElement: null,
        changes: mockChanges,
        undoStack: [],
        redoStack: [],
        originalValues: new Map(),
        isRearranging: false,
        isResizing: false,
        draggedElement: null,
        isActive: true
      })

      const exported = changeTracker.exportChanges()

      expect(exported).toBe(mockChanges)
    })

    test('should import changes to state manager', () => {
      const changes: ChangeAction[] = [
        { type: 'edit', element: null, data: {}, timestamp: 123, id: '1' },
        { type: 'hide', element: null, data: {}, timestamp: 124, id: '2' }
      ]

      // Mock initial counter state
      mockStateManager.getState.mockReturnValue({
        selectedElement: null,
        hoveredElement: null,
        changes: changes,
        undoStack: [],
        redoStack: [],
        originalValues: new Map(),
        isRearranging: false,
        isResizing: false,
        draggedElement: null,
        isActive: true
      })

      changeTracker.importChanges(changes)

      expect(mockStateManager.setChanges).toHaveBeenCalledWith(changes)

      // Should update counter
      const counter = shadowRoot.querySelector('.changes-counter')
      expect(counter?.textContent).toBe('2 changes')
    })
  })

  describe('Complex Scenarios', () => {
    test('should handle rapid consecutive changes', () => {
      const element = document.createElement('div')
      element.id = 'rapid-element'
      container.appendChild(element)

      // Track multiple rapid changes
      for (let i = 0; i < 5; i++) {
        changeTracker.trackChange('edit', element, {
          oldText: `text${i}`,
          newText: `text${i + 1}`
        })
      }

      expect(mockStateManager.addChange).toHaveBeenCalledTimes(5)
      expect(mockStateManager.pushUndo).toHaveBeenCalledTimes(5)
    })

    test('should handle undo/redo sequence correctly', () => {
      const element = document.createElement('div')
      element.textContent = 'original'
      container.appendChild(element)

      // Mock sequence: has undo -> perform undo -> has redo -> perform redo
      const undoAction: UndoRedoAction = {
        type: 'undo',
        originalAction: {
          type: 'edit',
          element: element,
          data: { oldText: 'original', newText: 'modified' },
          timestamp: 1234567890,
          id: 'test-id'
        },
        undoData: {
          restoreText: 'original',
          element: element
        }
      }

      const redoAction: UndoRedoAction = {
        type: 'redo',
        originalAction: undoAction.originalAction,
        undoData: undoAction.originalAction.data
      }

      // Set up modified state
      element.textContent = 'modified'

      // First undo
      mockStateManager.popUndo.mockReturnValueOnce(undoAction)
      changeTracker.performUndo()
      expect(element.textContent).toBe('original')

      // Then redo
      mockStateManager.popRedo.mockReturnValueOnce(redoAction)
      changeTracker.performRedo()
      expect(element.textContent).toBe('modified')
    })

    test('should handle style merging for resize actions', () => {
      const element = document.createElement('div')
      element.style.width = '200px'
      element.style.height = '100px'
      element.style.color = 'red'
      container.appendChild(element)

      const undoAction: UndoRedoAction = {
        type: 'undo',
        originalAction: {
          type: 'resize',
          element: element,
          data: {},
          timestamp: 1234567890,
          id: 'test-id'
        },
        undoData: {
          originalStyles: {
            width: '100px',
            height: '50px'
          },
          element: element
        }
      }

      mockStateManager.popUndo.mockReturnValue(undoAction)

      changeTracker.performUndo()

      // Should restore only the specified styles
      expect(element.style.width).toBe('100px')
      expect(element.style.height).toBe('50px')
      expect(element.style.color).toBe('red') // Should preserve existing styles
    })

    test('should handle DOM structure changes during undo/redo', () => {
      const parentA = document.createElement('div')
      const parentB = document.createElement('div')
      const element = document.createElement('span')

      parentA.appendChild(element)
      container.appendChild(parentA)
      container.appendChild(parentB)

      // Create move undo action
      const undoAction: UndoRedoAction = {
        type: 'undo',
        originalAction: {
          type: 'move',
          element: element,
          data: {},
          timestamp: 1234567890,
          id: 'test-id'
        },
        undoData: {
          originalParent: parentA,
          originalNextSibling: null,
          element: element
        }
      }

      // Simulate element moved to parentB
      parentB.appendChild(element)
      expect(element.parentElement).toBe(parentB)

      mockStateManager.popUndo.mockReturnValue(undoAction)
      changeTracker.performUndo()

      // Should move back to original parent
      expect(element.parentElement).toBe(parentA)
    })

    test('should handle multiple element types in sequence', () => {
      const elements = [
        document.createElement('div'),
        document.createElement('span'),
        document.createElement('button'),
        document.createElement('input')
      ]

      elements.forEach((el, i) => {
        el.id = `element-${i}`
        container.appendChild(el)
      })

      const actions: ChangeAction['type'][] = ['edit', 'hide', 'resize', 'delete']

      elements.forEach((element, i) => {
        changeTracker.trackChange(actions[i], element, {
          testData: `data-${i}`
        })
      })

      expect(mockStateManager.addChange).toHaveBeenCalledTimes(4)
      expect(mockStateManager.pushUndo).toHaveBeenCalledTimes(4)

      // Each should have different undo data structure
      const undoCalls = (mockStateManager.pushUndo as jest.Mock).mock.calls
      expect(undoCalls[0][0].undoData).toHaveProperty('restoreText')
      expect(undoCalls[1][0].undoData).toHaveProperty('restoreDisplay')
      expect(undoCalls[2][0].undoData).toHaveProperty('originalStyles')
      expect(undoCalls[3][0].undoData).toHaveProperty('restoreHtml')
    })
  })

  describe('Edge Cases', () => {
    test('should handle elements removed from DOM during undo', () => {
      const element = document.createElement('div')
      container.appendChild(element)

      const undoAction: UndoRedoAction = {
        type: 'undo',
        originalAction: {
          type: 'edit',
          element: element,
          data: { oldText: 'old', newText: 'new' },
          timestamp: 1234567890,
          id: 'test-id'
        },
        undoData: {
          restoreText: 'old',
          element: element
        }
      }

      // Remove element from DOM
      element.remove()

      mockStateManager.popUndo.mockReturnValue(undoAction)

      // Should not throw when element is not in DOM
      expect(() => changeTracker.performUndo()).not.toThrow()
    })

    test('should handle malformed HTML during restoration', () => {
      const parentElement = document.createElement('div')
      container.appendChild(parentElement)

      const undoAction: UndoRedoAction = {
        type: 'undo',
        originalAction: {
          type: 'delete',
          element: null,
          data: {},
          timestamp: 1234567890,
          id: 'test-id'
        },
        undoData: {
          restoreHtml: '<div><span>Unclosed tag',
          parentElement: parentElement,
          nextSibling: null
        }
      }

      mockStateManager.popUndo.mockReturnValue(undoAction)

      // Should handle malformed HTML gracefully
      expect(() => changeTracker.performUndo()).not.toThrow()

      // Should still attempt to restore what it can
      expect(parentElement.children.length).toBeGreaterThan(0)
    })

    test('should handle empty or whitespace-only class names', () => {
      const element = document.createElement('div')
      element.className = '   \t\n   '
      container.appendChild(element)

      changeTracker.trackChange('edit', element, { oldText: 'old', newText: 'new' })

      expect(window.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          change: expect.objectContaining({
            selector: '.'  // When class is whitespace only, selector becomes "."
          })
        }),
        '*'
      )
    })

    test('should handle very long ID and class names', () => {
      const element = document.createElement('div')
      element.id = 'a'.repeat(1000)
      element.className = 'b'.repeat(500) + ' ' + 'c'.repeat(500)
      container.appendChild(element)

      changeTracker.trackChange('edit', element, { oldText: 'old', newText: 'new' })

      expect(window.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          change: expect.objectContaining({
            selector: '#' + 'a'.repeat(1000)
          })
        }),
        '*'
      )
    })

    test('should handle special characters in selectors', () => {
      const element = document.createElement('div')
      element.id = 'test:id[special]'
      element.className = 'class:name class[bracket]'
      container.appendChild(element)

      changeTracker.trackChange('edit', element, { oldText: 'old', newText: 'new' })

      // Should still generate some selector (even if not perfect)
      expect(window.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          change: expect.objectContaining({
            selector: expect.any(String)
          })
        }),
        '*'
      )
    })

    test('should handle undefined/null values in change data', () => {
      const element = document.createElement('div')
      container.appendChild(element)

      changeTracker.trackChange('edit', element, {
        oldText: undefined,
        newText: null,
        extraData: { nested: undefined }
      })

      expect(mockStateManager.addChange).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            oldText: undefined,
            newText: null,
            extraData: { nested: undefined }
          }
        })
      )
    })
  })

  describe('Performance and Memory', () => {
    test('should not create memory leaks with element references', () => {
      let element = document.createElement('div')
      const weakRef = new WeakRef(element)

      changeTracker.trackChange('edit', element, { oldText: 'old', newText: 'new' })

      // Clear direct reference
      element = null as any

      // The element should still be referenced in the change tracker until GC
      expect(mockStateManager.addChange).toHaveBeenCalledWith(
        expect.objectContaining({
          element: expect.any(HTMLElement)
        })
      )
    })

    test('should handle large numbers of changes efficiently', () => {
      const startTime = performance.now()

      // Create many changes
      for (let i = 0; i < 100; i++) {
        const element = document.createElement('div')
        element.id = `element-${i}`
        container.appendChild(element)

        changeTracker.trackChange('edit', element, {
          oldText: `old-${i}`,
          newText: `new-${i}`
        })
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(100) // 100ms threshold

      expect(mockStateManager.addChange).toHaveBeenCalledTimes(100)
    })

    test('should generate unique IDs efficiently', () => {
      const ids = new Set<string>()
      const startTime = performance.now()

      // Generate many IDs
      for (let i = 0; i < 1000; i++) {
        // Reset mocks to get fresh random values
        jest.spyOn(Date, 'now').mockReturnValue(1234567890 + i)
        jest.spyOn(Math, 'random').mockReturnValue(Math.random())

        const element = document.createElement('div')
        changeTracker.trackChange('edit', element, { test: i })

        const lastCall = (mockStateManager.addChange as jest.Mock).mock.calls.slice(-1)[0]
        ids.add(lastCall[0].id)
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      // All IDs should be unique
      expect(ids.size).toBe(1000)

      // Should complete efficiently
      expect(duration).toBeLessThan(200) // 200ms threshold
    })
  })
})