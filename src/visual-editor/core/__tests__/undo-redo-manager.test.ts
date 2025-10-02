import { describe, it, expect, beforeEach } from 'vitest'
import UndoRedoManager, { ChangeRecord } from '../undo-redo-manager'
import { DOMChange } from '../../types/dom-changes'

describe('UndoRedoManager', () => {
  let manager: UndoRedoManager

  beforeEach(() => {
    manager = new UndoRedoManager()
  })

  describe('Basic functionality', () => {
    it('should start with empty stacks', () => {
      expect(manager.canUndo()).toBe(false)
      expect(manager.canRedo()).toBe(false)
      expect(manager.getUndoCount()).toBe(0)
      expect(manager.getRedoCount()).toBe(0)
    })

    it('should add changes to undo stack', () => {
      const change: DOMChange = {
        selector: '#test',
        type: 'text',
        value: 'new text',
        enabled: true
      }

      manager.addChange(change, 'old text')

      expect(manager.canUndo()).toBe(true)
      expect(manager.getUndoCount()).toBe(1)
      expect(manager.canRedo()).toBe(false)
    })

    it('should clear redo stack when new change is added', () => {
      const change1: DOMChange = {
        selector: '#test',
        type: 'text',
        value: 'text 1',
        enabled: true
      }
      const change2: DOMChange = {
        selector: '#test',
        type: 'text',
        value: 'text 2',
        enabled: true
      }

      manager.addChange(change1, 'original')
      manager.undo()

      expect(manager.canRedo()).toBe(true)

      manager.addChange(change2, 'text 1')

      expect(manager.canRedo()).toBe(false)
      expect(manager.getRedoCount()).toBe(0)
    })
  })

  describe('Undo functionality', () => {
    it('should undo a single change', () => {
      const change: DOMChange = {
        selector: '#test',
        type: 'text',
        value: 'new text',
        enabled: true
      }

      manager.addChange(change, 'old text')
      const record = manager.undo()

      expect(record).not.toBeNull()
      expect(record!.change.value).toBe('new text')
      expect(record!.oldValue).toBe('old text')
      expect(manager.canUndo()).toBe(false)
      expect(manager.canRedo()).toBe(true)
    })

    it('should undo multiple changes in correct order', () => {
      const changes = [
        { selector: '#test', type: 'text' as const, value: 'text 1', enabled: true },
        { selector: '#test', type: 'text' as const, value: 'text 2', enabled: true },
        { selector: '#test', type: 'text' as const, value: 'text 3', enabled: true }
      ]

      manager.addChange(changes[0], 'original')
      manager.addChange(changes[1], 'text 1')
      manager.addChange(changes[2], 'text 2')

      const undo1 = manager.undo()
      expect(undo1!.change.value).toBe('text 3')
      expect(undo1!.oldValue).toBe('text 2')

      const undo2 = manager.undo()
      expect(undo2!.change.value).toBe('text 2')
      expect(undo2!.oldValue).toBe('text 1')

      const undo3 = manager.undo()
      expect(undo3!.change.value).toBe('text 1')
      expect(undo3!.oldValue).toBe('original')

      expect(manager.canUndo()).toBe(false)
    })

    it('should return null when undo stack is empty', () => {
      const record = manager.undo()
      expect(record).toBeNull()
    })
  })

  describe('Redo functionality', () => {
    it('should redo a single change', () => {
      const change: DOMChange = {
        selector: '#test',
        type: 'text',
        value: 'new text',
        enabled: true
      }

      manager.addChange(change, 'old text')
      manager.undo()

      const record = manager.redo()

      expect(record).not.toBeNull()
      expect(record!.change.value).toBe('new text')
      expect(record!.oldValue).toBe('old text')
      expect(manager.canUndo()).toBe(true)
      expect(manager.canRedo()).toBe(false)
    })

    it('should redo multiple changes in correct order', () => {
      const changes = [
        { selector: '#test', type: 'text' as const, value: 'text 1', enabled: true },
        { selector: '#test', type: 'text' as const, value: 'text 2', enabled: true },
        { selector: '#test', type: 'text' as const, value: 'text 3', enabled: true }
      ]

      manager.addChange(changes[0], 'original')
      manager.addChange(changes[1], 'text 1')
      manager.addChange(changes[2], 'text 2')

      // Undo all
      manager.undo()
      manager.undo()
      manager.undo()

      // Redo all
      const redo1 = manager.redo()
      expect(redo1!.change.value).toBe('text 1')
      expect(redo1!.oldValue).toBe('original')

      const redo2 = manager.redo()
      expect(redo2!.change.value).toBe('text 2')
      expect(redo2!.oldValue).toBe('text 1')

      const redo3 = manager.redo()
      expect(redo3!.change.value).toBe('text 3')
      expect(redo3!.oldValue).toBe('text 2')

      expect(manager.canRedo()).toBe(false)
    })

    it('should return null when redo stack is empty', () => {
      const record = manager.redo()
      expect(record).toBeNull()
    })
  })

  describe('Reference isolation', () => {
    it('should deep copy changes to prevent mutation', () => {
      const change: DOMChange = {
        selector: '#test',
        type: 'text',
        value: 'original value',
        enabled: true
      }

      manager.addChange(change, 'old value')

      // Mutate the original
      change.value = 'mutated value'

      // The stored change should not be affected
      const record = manager.undo()
      expect(record!.change.value).toBe('original value')
    })

    it('should deep copy old values to prevent mutation', () => {
      const change: DOMChange = {
        selector: '#test',
        type: 'style',
        value: { color: 'red' },
        enabled: true
      }
      const oldValue = { color: 'blue' }

      manager.addChange(change, oldValue)

      // Mutate the original old value
      oldValue.color = 'green'

      // The stored old value should not be affected
      const record = manager.undo()
      expect(record!.oldValue).toEqual({ color: 'blue' })
    })

    it('should isolate undo and redo stacks', () => {
      const change: DOMChange = {
        selector: '#test',
        type: 'text',
        value: 'new value',
        enabled: true
      }

      manager.addChange(change, 'old value')
      const undoRecord = manager.undo()

      // Mutate the undo record
      undoRecord!.change.value = 'mutated'

      // The redo record should not be affected
      const redoRecord = manager.redo()
      expect(redoRecord!.change.value).toBe('new value')
    })
  })

  describe('Stack size limit', () => {
    it('should respect max stack size', () => {
      const smallManager = new UndoRedoManager(3)

      for (let i = 0; i < 5; i++) {
        const change: DOMChange = {
          selector: '#test',
          type: 'text',
          value: `text ${i}`,
          enabled: true
        }
        smallManager.addChange(change, `old ${i}`)
      }

      expect(smallManager.getUndoCount()).toBe(3)

      // Should have the last 3 changes (2, 3, 4)
      const undo1 = smallManager.undo()
      expect(undo1!.change.value).toBe('text 4')

      const undo2 = smallManager.undo()
      expect(undo2!.change.value).toBe('text 3')

      const undo3 = smallManager.undo()
      expect(undo3!.change.value).toBe('text 2')

      expect(smallManager.canUndo()).toBe(false)
    })
  })

  describe('Clear functionality', () => {
    it('should clear all stacks', () => {
      const change: DOMChange = {
        selector: '#test',
        type: 'text',
        value: 'new text',
        enabled: true
      }

      manager.addChange(change, 'old text')
      manager.undo()

      expect(manager.canUndo()).toBe(false)
      expect(manager.canRedo()).toBe(true)

      manager.clear()

      expect(manager.canUndo()).toBe(false)
      expect(manager.canRedo()).toBe(false)
      expect(manager.getUndoCount()).toBe(0)
      expect(manager.getRedoCount()).toBe(0)
    })
  })

  describe('Complex undo/redo scenarios', () => {
    it('should handle alternating undo/redo operations', () => {
      const changes = [
        { selector: '#test', type: 'text' as const, value: 'A', enabled: true },
        { selector: '#test', type: 'text' as const, value: 'B', enabled: true },
        { selector: '#test', type: 'text' as const, value: 'C', enabled: true }
      ]

      manager.addChange(changes[0], 'original')
      manager.addChange(changes[1], 'A')
      manager.addChange(changes[2], 'B')

      // Undo -> Redo -> Undo -> Redo pattern
      manager.undo() // C -> B
      expect(manager.getUndoCount()).toBe(2)
      expect(manager.getRedoCount()).toBe(1)

      manager.redo() // B -> C
      expect(manager.getUndoCount()).toBe(3)
      expect(manager.getRedoCount()).toBe(0)

      manager.undo() // C -> B
      manager.undo() // B -> A
      expect(manager.getUndoCount()).toBe(1)
      expect(manager.getRedoCount()).toBe(2)

      const redo1 = manager.redo() // A -> B
      expect(redo1!.change.value).toBe('B')

      const redo2 = manager.redo() // B -> C
      expect(redo2!.change.value).toBe('C')
    })
  })
})
