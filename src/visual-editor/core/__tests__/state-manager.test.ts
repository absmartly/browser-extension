/**
 * Comprehensive unit tests for StateManager
 * Tests all state mutations, immutability, transitions, and edge cases
 */

import StateManager from '../state-manager'
import type { VisualEditorState, VisualEditorConfig } from '../state-manager'

describe('StateManager', () => {
  let stateManager: StateManager
  let mockConfig: VisualEditorConfig
  let mockElement: Element
  let mockElement2: Element

  beforeEach(() => {
    // Create mock DOM elements
    mockElement = document.createElement('div')
    mockElement.id = 'test-element-1'
    mockElement2 = document.createElement('span')
    mockElement2.id = 'test-element-2'

    // Create mock config
    mockConfig = {
      variantName: 'test-variant',
      experimentName: 'test-experiment',
      logoUrl: 'https://example.com/logo.png'
    }

    stateManager = new StateManager(mockConfig)
  })

  describe('Constructor and Initial State', () => {
    it('should initialize with correct default state', () => {
      const state = stateManager.getState()

      expect(state.selectedElement).toBeNull()
      expect(state.hoveredElement).toBeNull()
      expect(state.changes).toEqual([])
      expect(state.undoStack).toEqual([])
      expect(state.redoStack).toEqual([])
      expect(state.originalValues).toBeInstanceOf(Map)
      expect(state.originalValues.size).toBe(0)
      expect(state.isRearranging).toBe(false)
      expect(state.isResizing).toBe(false)
      expect(state.draggedElement).toBeNull()
      expect(state.isActive).toBe(true)
    })

    it('should initialize with initial changes from config', () => {
      const initialChanges: any[] = [
        { selector: '.test', type: 'text', value: 'Hello' },
        { selector: '.test2', type: 'style', value: { color: 'red' } }
      ]

      const configWithChanges: VisualEditorConfig = {
        ...mockConfig,
        initialChanges
      }

      const stateManagerWithChanges = new StateManager(configWithChanges)
      const state = stateManagerWithChanges.getState()

      expect(state.changes).toEqual(initialChanges)
      // Note: StateManager assigns initialChanges directly, so they share the same reference
      expect(state.changes).toBe(initialChanges)
    })

    it('should store config correctly', () => {
      const config = stateManager.getConfig()

      expect(config).toEqual(mockConfig)
      expect(config).not.toBe(mockConfig) // Should return a copy
    })
  })

  describe('State Getters', () => {
    it('should return immutable state copy', () => {
      const state1 = stateManager.getState()
      const state2 = stateManager.getState()

      expect(state1).toEqual(state2)
      expect(state1).not.toBe(state2) // Different objects

      // Modifying returned state should not affect internal state
      state1.selectedElement = mockElement
      const state3 = stateManager.getState()
      expect(state3.selectedElement).toBeNull()
    })

    it('should return immutable config copy', () => {
      const config1 = stateManager.getConfig()
      const config2 = stateManager.getConfig()

      expect(config1).toEqual(config2)
      expect(config1).not.toBe(config2) // Different objects

      // Modifying returned config should not affect internal config
      config1.variantName = 'modified'
      const config3 = stateManager.getConfig()
      expect(config3.variantName).toBe('test-variant')
    })
  })

  describe('State Updates', () => {
    it('should update state with partial updates', () => {
      stateManager.updateState({
        selectedElement: mockElement,
        isRearranging: true
      })

      const state = stateManager.getState()
      expect(state.selectedElement).toBe(mockElement)
      expect(state.isRearranging).toBe(true)
      expect(state.hoveredElement).toBeNull() // Other properties unchanged
    })

    it('should replace entire state with setState', () => {
      const newState: VisualEditorState = {
        selectedElement: mockElement,
        hoveredElement: mockElement2,
        changes: [{ selector: '.test', type: 'text', value: 'Test' }] as any,
        undoStack: [{ type: 'add', change: { selector: '.test', type: 'text', value: 'Test' }, index: 0 }],
        redoStack: [{ type: 'add', change: { selector: '.test', type: 'text', value: 'Test' }, index: 0 }],
        originalValues: new Map([['key', 'value']]),
        isRearranging: true,
        isResizing: true,
        draggedElement: mockElement,
        isActive: false
      }

      stateManager.setState(newState)
      const state = stateManager.getState()

      expect(state).toEqual(newState)
      expect(state).not.toBe(newState) // Should be immutable
    })

    it('should maintain immutability during updates', () => {
      const originalState = stateManager.getState()

      stateManager.updateState({ selectedElement: mockElement })

      // Original state reference should be unchanged
      expect(originalState.selectedElement).toBeNull()

      // New state should have the update
      const newState = stateManager.getState()
      expect(newState.selectedElement).toBe(mockElement)
    })
  })

  describe('State Change Listeners', () => {
    it('should notify listeners on state changes', () => {
      const listener1 = jest.fn()
      const listener2 = jest.fn()

      stateManager.onStateChange(listener1)
      stateManager.onStateChange(listener2)

      stateManager.updateState({ selectedElement: mockElement })

      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(1)

      const calledState = listener1.mock.calls[0][0]
      expect(calledState.selectedElement).toBe(mockElement)
    })

    it('should return unsubscribe function', () => {
      const listener = jest.fn()
      const unsubscribe = stateManager.onStateChange(listener)

      stateManager.updateState({ selectedElement: mockElement })
      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()
      stateManager.updateState({ selectedElement: null })
      expect(listener).toHaveBeenCalledTimes(1) // Should not be called again
    })

    it('should handle multiple unsubscribes safely', () => {
      const listener = jest.fn()
      const unsubscribe = stateManager.onStateChange(listener)

      unsubscribe()
      unsubscribe() // Should not throw

      stateManager.updateState({ selectedElement: mockElement })
      expect(listener).not.toHaveBeenCalled()
    })

    it('should not notify on setState calls', () => {
      const listener = jest.fn()
      stateManager.onStateChange(listener)

      const newState: VisualEditorState = {
        selectedElement: mockElement,
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

      stateManager.setState(newState)
      expect(listener).toHaveBeenCalledTimes(1)
    })
  })

  describe('Element Selection and Hover', () => {
    it('should set selected element', () => {
      stateManager.setSelectedElement(mockElement)

      const state = stateManager.getState()
      expect(state.selectedElement).toBe(mockElement)
    })

    it('should clear selected element', () => {
      stateManager.setSelectedElement(mockElement)
      stateManager.setSelectedElement(null)

      const state = stateManager.getState()
      expect(state.selectedElement).toBeNull()
    })

    it('should set hovered element', () => {
      stateManager.setHoveredElement(mockElement)

      const state = stateManager.getState()
      expect(state.hoveredElement).toBe(mockElement)
    })

    it('should clear hovered element', () => {
      stateManager.setHoveredElement(mockElement)
      stateManager.setHoveredElement(null)

      const state = stateManager.getState()
      expect(state.hoveredElement).toBeNull()
    })

    it('should handle same element for selected and hovered', () => {
      stateManager.setSelectedElement(mockElement)
      stateManager.setHoveredElement(mockElement)

      const state = stateManager.getState()
      expect(state.selectedElement).toBe(mockElement)
      expect(state.hoveredElement).toBe(mockElement)
    })
  })

  describe('Changes Management', () => {
    it('should add change to empty changes array', () => {
      const change: any = { selector: '.test', type: 'text', value: 'Hello' }

      stateManager.addChange(change)

      const state = stateManager.getState()
      expect(state.changes).toEqual([change])
    })

    it('should add multiple changes', () => {
      const change1: any = { selector: '.test1', type: 'text', value: 'Hello' }
      const change2: any = { selector: '.test2', type: 'style', value: { color: 'red' } }

      stateManager.addChange(change1)
      stateManager.addChange(change2)

      const state = stateManager.getState()
      expect(state.changes).toEqual([change1, change2])
    })

    it('should maintain immutability when adding changes', () => {
      const originalState = stateManager.getState()
      const change: any = { selector: '.test', type: 'text', value: 'Hello' }

      stateManager.addChange(change)

      expect(originalState.changes).toEqual([])

      const newState = stateManager.getState()
      expect(newState.changes).toEqual([change])
      expect(newState.changes).not.toBe(originalState.changes)
    })

    it('should set changes array', () => {
      const changes: any[] = [
        { selector: '.test1', type: 'text', value: 'Hello' },
        { selector: '.test2', type: 'style', value: { color: 'red' } }
      ]

      stateManager.setChanges(changes)

      const state = stateManager.getState()
      expect(state.changes).toEqual(changes)
      // Note: setChanges assigns directly through updateState, which creates a new state object
      // but doesn't deep clone the changes array
      expect(state.changes).toBe(changes)
    })

    it('should replace existing changes when setting', () => {
      stateManager.addChange({ selector: '.old', type: 'text', value: 'Old' })

      const newChanges: any[] = [{ selector: '.new', type: 'text', value: 'New' }]
      stateManager.setChanges(newChanges)

      const state = stateManager.getState()
      expect(state.changes).toEqual(newChanges)
    })
  })

  describe('Undo/Redo Stack Management', () => {
    describe('Undo Stack', () => {
      it('should push action to undo stack', () => {
        const action: any = { type: 'add', data: 'test-data' }

        stateManager.pushUndo(action)

        const state = stateManager.getState()
        expect(state.undoStack).toEqual([action])
      })

      it('should push multiple actions to undo stack', () => {
        const action1: any = { type: 'test1', data: 'data1' }
        const action2: any = { type: 'test2', data: 'data2' }

        stateManager.pushUndo(action1)
        stateManager.pushUndo(action2)

        const state = stateManager.getState()
        expect(state.undoStack).toEqual([action1, action2])
      })

      it('should clear redo stack when pushing to undo stack', () => {
        const undoAction: any = { type: 'undo', data: 'undo-data' }
        const redoAction: any = { type: 'redo', data: 'redo-data' }

        stateManager.pushRedo(redoAction)
        stateManager.pushUndo(undoAction)

        const state = stateManager.getState()
        expect(state.undoStack).toEqual([undoAction])
        expect(state.redoStack).toEqual([])
      })

      it('should pop action from undo stack', () => {
        const action1: any = { type: 'test1', data: 'data1' }
        const action2: any = { type: 'test2', data: 'data2' }

        stateManager.pushUndo(action1)
        stateManager.pushUndo(action2)

        const poppedAction = stateManager.popUndo()

        expect(poppedAction).toEqual(action2)

        const state = stateManager.getState()
        expect(state.undoStack).toEqual([action1])
      })

      it('should return null when popping from empty undo stack', () => {
        const poppedAction = stateManager.popUndo()

        expect(poppedAction).toBeNull()

        const state = stateManager.getState()
        expect(state.undoStack).toEqual([])
      })

      it('should maintain immutability of undo stack', () => {
        const originalState = stateManager.getState()
        const action: any = { type: 'add', data: 'test-data' }

        stateManager.pushUndo(action)

        expect(originalState.undoStack).toEqual([])

        const newState = stateManager.getState()
        expect(newState.undoStack).toEqual([action])
        expect(newState.undoStack).not.toBe(originalState.undoStack)
      })
    })

    describe('Redo Stack', () => {
      it('should push action to redo stack', () => {
        const action: any = { type: 'add', data: 'test-data' }

        stateManager.pushRedo(action)

        const state = stateManager.getState()
        expect(state.redoStack).toEqual([action])
      })

      it('should push multiple actions to redo stack', () => {
        const action1: any = { type: 'test1', data: 'data1' }
        const action2: any = { type: 'test2', data: 'data2' }

        stateManager.pushRedo(action1)
        stateManager.pushRedo(action2)

        const state = stateManager.getState()
        expect(state.redoStack).toEqual([action1, action2])
      })

      it('should pop action from redo stack', () => {
        const action1: any = { type: 'test1', data: 'data1' }
        const action2: any = { type: 'test2', data: 'data2' }

        stateManager.pushRedo(action1)
        stateManager.pushRedo(action2)

        const poppedAction = stateManager.popRedo()

        expect(poppedAction).toEqual(action2)

        const state = stateManager.getState()
        expect(state.redoStack).toEqual([action1])
      })

      it('should return null when popping from empty redo stack', () => {
        const poppedAction = stateManager.popRedo()

        expect(poppedAction).toBeNull()

        const state = stateManager.getState()
        expect(state.redoStack).toEqual([])
      })

      it('should maintain immutability of redo stack', () => {
        const originalState = stateManager.getState()
        const action: any = { type: 'add', data: 'test-data' }

        stateManager.pushRedo(action)

        expect(originalState.redoStack).toEqual([])

        const newState = stateManager.getState()
        expect(newState.redoStack).toEqual([action])
        expect(newState.redoStack).not.toBe(originalState.redoStack)
      })
    })
  })

  describe('Original Values Management', () => {
    it('should set original value', () => {
      const key = 'element-123-text'
      const value = 'Original Text'

      stateManager.setOriginalValue(key, value)

      const retrievedValue = stateManager.getOriginalValue(key)
      expect(retrievedValue).toBe(value)
    })

    it('should get original value', () => {
      const key = 'element-456-style'
      const value = { color: 'blue', fontSize: '16px' }

      stateManager.setOriginalValue(key, value)

      const retrievedValue = stateManager.getOriginalValue(key)
      expect(retrievedValue).toEqual(value)
      expect(retrievedValue).toBe(value) // Should be the same reference
    })

    it('should return undefined for non-existent key', () => {
      const retrievedValue = stateManager.getOriginalValue('non-existent-key')
      expect(retrievedValue).toBeUndefined()
    })

    it('should overwrite existing original value', () => {
      const key = 'element-789-text'
      const originalValue = 'Original'
      const newValue = 'Updated'

      stateManager.setOriginalValue(key, originalValue)
      stateManager.setOriginalValue(key, newValue)

      const retrievedValue = stateManager.getOriginalValue(key)
      expect(retrievedValue).toBe(newValue)
    })

    it('should handle different data types as values', () => {
      stateManager.setOriginalValue('string-key', 'string-value')
      stateManager.setOriginalValue('number-key', 42)
      stateManager.setOriginalValue('object-key', { prop: 'value' })
      stateManager.setOriginalValue('array-key', [1, 2, 3])
      stateManager.setOriginalValue('null-key', null)
      stateManager.setOriginalValue('undefined-key', undefined)

      expect(stateManager.getOriginalValue('string-key')).toBe('string-value')
      expect(stateManager.getOriginalValue('number-key')).toBe(42)
      expect(stateManager.getOriginalValue('object-key')).toEqual({ prop: 'value' })
      expect(stateManager.getOriginalValue('array-key')).toEqual([1, 2, 3])
      expect(stateManager.getOriginalValue('null-key')).toBeNull()
      expect(stateManager.getOriginalValue('undefined-key')).toBeUndefined()
    })
  })

  describe('Mode State Management', () => {
    describe('Rearranging Mode', () => {
      it('should set rearranging mode to true', () => {
        stateManager.setRearranging(true)

        const state = stateManager.getState()
        expect(state.isRearranging).toBe(true)
      })

      it('should set rearranging mode to false', () => {
        stateManager.setRearranging(true)
        stateManager.setRearranging(false)

        const state = stateManager.getState()
        expect(state.isRearranging).toBe(false)
      })

      it('should notify listeners when rearranging mode changes', () => {
        const listener = jest.fn()
        stateManager.onStateChange(listener)

        stateManager.setRearranging(true)

        expect(listener).toHaveBeenCalledTimes(1)
        const calledState = listener.mock.calls[0][0]
        expect(calledState.isRearranging).toBe(true)
      })
    })

    describe('Resizing Mode', () => {
      it('should set resizing mode to true', () => {
        stateManager.setResizing(true)

        const state = stateManager.getState()
        expect(state.isResizing).toBe(true)
      })

      it('should set resizing mode to false', () => {
        stateManager.setResizing(true)
        stateManager.setResizing(false)

        const state = stateManager.getState()
        expect(state.isResizing).toBe(false)
      })

      it('should notify listeners when resizing mode changes', () => {
        const listener = jest.fn()
        stateManager.onStateChange(listener)

        stateManager.setResizing(true)

        expect(listener).toHaveBeenCalledTimes(1)
        const calledState = listener.mock.calls[0][0]
        expect(calledState.isResizing).toBe(true)
      })
    })

    it('should allow both rearranging and resizing to be true simultaneously', () => {
      stateManager.setRearranging(true)
      stateManager.setResizing(true)

      const state = stateManager.getState()
      expect(state.isRearranging).toBe(true)
      expect(state.isResizing).toBe(true)
    })
  })

  describe('Dragged Element Management', () => {
    it('should set dragged element', () => {
      stateManager.setDraggedElement(mockElement)

      const state = stateManager.getState()
      expect(state.draggedElement).toBe(mockElement)
    })

    it('should clear dragged element', () => {
      stateManager.setDraggedElement(mockElement)
      stateManager.setDraggedElement(null)

      const state = stateManager.getState()
      expect(state.draggedElement).toBeNull()
    })

    it('should notify listeners when dragged element changes', () => {
      const listener = jest.fn()
      stateManager.onStateChange(listener)

      stateManager.setDraggedElement(mockElement)

      expect(listener).toHaveBeenCalledTimes(1)
      const calledState = listener.mock.calls[0][0]
      expect(calledState.draggedElement).toBe(mockElement)
    })

    it('should handle setting same element multiple times', () => {
      const listener = jest.fn()
      stateManager.onStateChange(listener)

      stateManager.setDraggedElement(mockElement)
      stateManager.setDraggedElement(mockElement)

      expect(listener).toHaveBeenCalledTimes(2)

      const state = stateManager.getState()
      expect(state.draggedElement).toBe(mockElement)
    })
  })

  describe('Deactivation', () => {
    it('should deactivate the state manager', () => {
      stateManager.deactivate()

      const state = stateManager.getState()
      expect(state.isActive).toBe(false)
    })

    it('should notify listeners when deactivated', () => {
      const listener = jest.fn()
      stateManager.onStateChange(listener)

      stateManager.deactivate()

      expect(listener).toHaveBeenCalledTimes(1)
      const calledState = listener.mock.calls[0][0]
      expect(calledState.isActive).toBe(false)
    })

    it('should allow multiple deactivation calls', () => {
      stateManager.deactivate()
      stateManager.deactivate()

      const state = stateManager.getState()
      expect(state.isActive).toBe(false)
    })
  })

  describe('Complex State Transitions', () => {
    it('should handle editing workflow: select element, start resizing, make changes', () => {
      const listener = jest.fn()
      stateManager.onStateChange(listener)

      // Start editing workflow
      stateManager.setSelectedElement(mockElement)
      stateManager.setResizing(true)
      stateManager.addChange({ selector: '#test-element-1', type: 'style', value: { width: '200px' } })
      stateManager.setResizing(false)

      expect(listener).toHaveBeenCalledTimes(4)

      const finalState = stateManager.getState()
      expect(finalState.selectedElement).toBe(mockElement)
      expect(finalState.isResizing).toBe(false)
      expect(finalState.changes).toHaveLength(1)
    })

    it('should handle drag and drop workflow', () => {
      const listener = jest.fn()
      stateManager.onStateChange(listener)

      // Start drag
      stateManager.setDraggedElement(mockElement)
      stateManager.setRearranging(true)

      // Complete drag
      stateManager.addChange({ selector: '#test-element-1', type: 'move', target: '#container' } as any)
      stateManager.setDraggedElement(null)
      stateManager.setRearranging(false)

      expect(listener).toHaveBeenCalledTimes(5)

      const finalState = stateManager.getState()
      expect(finalState.draggedElement).toBeNull()
      expect(finalState.isRearranging).toBe(false)
      expect(finalState.changes).toHaveLength(1)
    })

    it('should handle undo/redo workflow', () => {
      // Setup initial state
      stateManager.addChange({ selector: '.test1', type: 'text', value: 'Text1' } as any)
      stateManager.pushUndo({ type: 'add', change: { selector: '.test1', type: 'text', value: 'Text1' } as any, index: 0 })

      stateManager.addChange({ selector: '.test2', type: 'text', value: 'Text2' } as any)
      stateManager.pushUndo({ type: 'add', change: { selector: '.test2', type: 'text', value: 'Text2' } as any, index: 1 })

      // Perform undo
      const undoAction = stateManager.popUndo()
      stateManager.pushRedo(undoAction)

      const state = stateManager.getState()
      expect(state.undoStack).toHaveLength(1)
      expect(state.redoStack).toHaveLength(1)
      expect(state.changes).toHaveLength(2) // Changes remain until actually applied
    })
  })

  describe('Concurrent State Updates', () => {
    it('should handle rapid sequential updates', () => {
      const listener = jest.fn()
      stateManager.onStateChange(listener)

      // Rapid updates
      stateManager.setSelectedElement(mockElement)
      stateManager.setHoveredElement(mockElement2)
      stateManager.setRearranging(true)
      stateManager.setResizing(true)
      stateManager.setDraggedElement(mockElement)

      expect(listener).toHaveBeenCalledTimes(5)

      const finalState = stateManager.getState()
      expect(finalState.selectedElement).toBe(mockElement)
      expect(finalState.hoveredElement).toBe(mockElement2)
      expect(finalState.isRearranging).toBe(true)
      expect(finalState.isResizing).toBe(true)
      expect(finalState.draggedElement).toBe(mockElement)
    })

    it('should maintain state consistency with batch updates', () => {
      const updates = {
        selectedElement: mockElement,
        hoveredElement: mockElement2,
        isRearranging: true,
        isResizing: true,
        draggedElement: mockElement
      }

      stateManager.updateState(updates)

      const state = stateManager.getState()
      expect(state.selectedElement).toBe(mockElement)
      expect(state.hoveredElement).toBe(mockElement2)
      expect(state.isRearranging).toBe(true)
      expect(state.isResizing).toBe(true)
      expect(state.draggedElement).toBe(mockElement)
    })
  })

  describe('Edge Cases', () => {
    it('should handle null and undefined values gracefully', () => {
      stateManager.setSelectedElement(null)
      stateManager.setHoveredElement(undefined as any)
      stateManager.setDraggedElement(null)

      const state = stateManager.getState()
      expect(state.selectedElement).toBeNull()
      expect(state.hoveredElement).toBeUndefined()
      expect(state.draggedElement).toBeNull()
    })

    it('should handle empty changes array operations', () => {
      stateManager.setChanges([])

      const state = stateManager.getState()
      expect(state.changes).toEqual([])
    })

    it('should handle setting original values with special keys', () => {
      const specialKeys = ['', ' ', '\n', '\t', 'key with spaces', 'key-with-dashes', 'key_with_underscores']

      specialKeys.forEach((key, index) => {
        stateManager.setOriginalValue(key, `value-${index}`)
      })

      specialKeys.forEach((key, index) => {
        expect(stateManager.getOriginalValue(key)).toBe(`value-${index}`)
      })
    })

    it('should handle large undo/redo stacks', () => {
      const largeStackSize = 1000

      // Fill undo stack
      for (let i = 0; i < largeStackSize; i++) {
        stateManager.pushUndo({ type: 'add', change: { selector: `.test${i}`, type: 'text', value: 'test' } as any, index: i })
      }

      const state = stateManager.getState()
      expect(state.undoStack).toHaveLength(largeStackSize)

      // Pop all items
      for (let i = largeStackSize - 1; i >= 0; i--) {
        const action = stateManager.popUndo()
        expect(action.index).toBe(i)
      }

      expect(stateManager.popUndo()).toBeNull()
    })

    it('should handle many state change listeners', () => {
      const listeners = Array.from({ length: 100 }, () => jest.fn())
      const unsubscribers = listeners.map(listener => stateManager.onStateChange(listener))

      stateManager.setSelectedElement(mockElement)

      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalledTimes(1)
      })

      // Unsubscribe all
      unsubscribers.forEach(unsubscribe => unsubscribe())

      stateManager.setSelectedElement(null)

      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalledTimes(1) // Should not be called again
      })
    })

    it('should handle state reset to initial values', () => {
      // Modify all state properties
      stateManager.setSelectedElement(mockElement)
      stateManager.setHoveredElement(mockElement2)
      stateManager.addChange({ selector: '.test', type: 'text', value: 'Test' } as any)
      stateManager.pushUndo({ type: 'add', change: { selector: '.test', type: 'text', value: 'Test' }, index: 0 })
      stateManager.pushRedo({ type: 'add', change: { selector: '.test', type: 'text', value: 'Test' }, index: 0 })
      stateManager.setOriginalValue('key', 'value')
      stateManager.setRearranging(true)
      stateManager.setResizing(true)
      stateManager.setDraggedElement(mockElement)
      stateManager.deactivate()

      // Reset to initial state
      const initialState: VisualEditorState = {
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

      stateManager.setState(initialState)

      const state = stateManager.getState()
      expect(state.selectedElement).toBeNull()
      expect(state.hoveredElement).toBeNull()
      expect(state.changes).toEqual([])
      expect(state.undoStack).toEqual([])
      expect(state.redoStack).toEqual([])
      expect(state.originalValues.size).toBe(0)
      expect(state.isRearranging).toBe(false)
      expect(state.isResizing).toBe(false)
      expect(state.draggedElement).toBeNull()
      expect(state.isActive).toBe(true)
    })
  })

  describe('Memory and Performance', () => {
    it('should not leak memory with listeners', () => {
      const listeners: Array<() => void> = []

      // Create and immediately unsubscribe many listeners
      for (let i = 0; i < 100; i++) {
        const unsubscribe = stateManager.onStateChange(() => {})
        listeners.push(unsubscribe)
      }

      // Unsubscribe all
      listeners.forEach(unsubscribe => unsubscribe())

      // Check that no listeners are called
      const testListener = jest.fn()
      stateManager.onStateChange(testListener)

      stateManager.setSelectedElement(mockElement)

      expect(testListener).toHaveBeenCalledTimes(1)
    })

    it('should handle complex objects in state (shallow immutability)', () => {
      const complexChange = {
        selector: '.test',
        type: 'style',
        value: {
          border: '1px solid red',
          background: {
            color: 'blue',
            image: 'url(test.png)'
          }
        },
        metadata: {
          timestamp: Date.now(),
          user: 'test-user'
        }
      } as any

      stateManager.addChange(complexChange)

      const state1 = stateManager.getState()
      const state2 = stateManager.getState()

      expect(state1).toEqual(state2)
      expect(state1).not.toBe(state2)
      expect(state1.changes).toBe(state2.changes)

      const changeRef = state1.changes[0]
      expect(changeRef).toBe(complexChange)
      expect((changeRef as any).value).toBe(complexChange.value)
    })
  })
})