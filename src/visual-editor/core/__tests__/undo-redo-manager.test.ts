import UndoRedoManager, { ChangeRecord } from '../undo-redo-manager'
import { DOMChange } from '../../types/visual-editor'

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

  describe('Change squashing', () => {
    it('should squash multiple changes to same element', () => {
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
      const change3: DOMChange = {
        selector: '#test',
        type: 'text',
        value: 'text 3',
        enabled: true
      }

      manager.addChange(change1, 'original')
      manager.addChange(change2, 'text 1')
      manager.addChange(change3, 'text 2')

      // Should only have 1 change in undo stack (squashed)
      expect(manager.getUndoCount()).toBe(1)

      const record = manager.undo()
      expect(record!.change.value).toBe('text 3') // Latest value
      expect(record!.oldValue).toBe('original')    // Original old value
    })

    it('should not squash changes to different selectors', () => {
      const change1: DOMChange = {
        selector: '#test1',
        type: 'text',
        value: 'text 1',
        enabled: true
      }
      const change2: DOMChange = {
        selector: '#test2',
        type: 'text',
        value: 'text 2',
        enabled: true
      }

      manager.addChange(change1, 'old1')
      manager.addChange(change2, 'old2')

      expect(manager.getUndoCount()).toBe(2)
    })

    it('should not squash changes to different types', () => {
      const change1: DOMChange = {
        selector: '#test',
        type: 'text',
        value: 'new text',
        enabled: true
      }
      const change2: DOMChange = {
        selector: '#test',
        type: 'html',
        value: '<div>new html</div>',
        enabled: true
      }

      manager.addChange(change1, 'old text')
      manager.addChange(change2, 'old html')

      expect(manager.getUndoCount()).toBe(2)
    })

    it('should squash style changes correctly', () => {
      const change1: DOMChange = {
        selector: '#test',
        type: 'style',
        value: { color: 'red' },
        enabled: true
      }
      const change2: DOMChange = {
        selector: '#test',
        type: 'style',
        value: { color: 'blue', fontSize: '16px' },
        enabled: true
      }

      manager.addChange(change1, { color: 'black' })
      manager.addChange(change2, { color: 'red' })

      expect(manager.getUndoCount()).toBe(1)

      const record = manager.undo()
      expect(record!.change.value).toEqual({ color: 'blue', fontSize: '16px' })
      expect(record!.oldValue).toEqual({ color: 'black' })
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
        { selector: '#test1', type: 'text' as const, value: 'text 1', enabled: true },
        { selector: '#test2', type: 'text' as const, value: 'text 2', enabled: true },
        { selector: '#test3', type: 'text' as const, value: 'text 3', enabled: true }
      ]

      manager.addChange(changes[0], 'original1')
      manager.addChange(changes[1], 'original2')
      manager.addChange(changes[2], 'original3')

      const undo1 = manager.undo()
      expect(undo1!.change.selector).toBe('#test3')

      const undo2 = manager.undo()
      expect(undo2!.change.selector).toBe('#test2')

      const undo3 = manager.undo()
      expect(undo3!.change.selector).toBe('#test1')

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
        { selector: '#test1', type: 'text' as const, value: 'text 1', enabled: true },
        { selector: '#test2', type: 'text' as const, value: 'text 2', enabled: true },
        { selector: '#test3', type: 'text' as const, value: 'text 3', enabled: true }
      ]

      manager.addChange(changes[0], 'original1')
      manager.addChange(changes[1], 'original2')
      manager.addChange(changes[2], 'original3')

      // Undo all
      manager.undo()
      manager.undo()
      manager.undo()

      // Redo all
      const redo1 = manager.redo()
      expect(redo1!.change.selector).toBe('#test1')

      const redo2 = manager.redo()
      expect(redo2!.change.selector).toBe('#test2')

      const redo3 = manager.redo()
      expect(redo3!.change.selector).toBe('#test3')

      expect(manager.canRedo()).toBe(false)
    })

    it('should return null when redo stack is empty', () => {
      const record = manager.redo()
      expect(record).toBeNull()
    })
  })

  describe('Undo/Redo with squashing', () => {
    it('should handle undo/redo correctly with squashed changes', () => {
      // Add 3 changes to same element (will be squashed)
      manager.addChange(
        { selector: '#test', type: 'text', value: 'text 1', enabled: true },
        'original'
      )
      manager.addChange(
        { selector: '#test', type: 'text', value: 'text 2', enabled: true },
        'text 1'
      )
      manager.addChange(
        { selector: '#test', type: 'text', value: 'text 3', enabled: true },
        'text 2'
      )

      // Should have 1 squashed change
      expect(manager.getUndoCount()).toBe(1)

      // Undo should revert to original
      const undoRecord = manager.undo()
      expect(undoRecord!.change.value).toBe('text 3')
      expect(undoRecord!.oldValue).toBe('original')

      // Redo should apply the final squashed value
      const redoRecord = manager.redo()
      expect(redoRecord!.change.value).toBe('text 3')
      expect(redoRecord!.oldValue).toBe('original')
    })

    it('should handle mixed squashed and non-squashed changes', () => {
      // Changes to #test1 (will be squashed)
      manager.addChange(
        { selector: '#test1', type: 'text', value: 'A', enabled: true },
        'original'
      )
      manager.addChange(
        { selector: '#test1', type: 'text', value: 'B', enabled: true },
        'A'
      )

      // Change to #test2 (different element)
      manager.addChange(
        { selector: '#test2', type: 'text', value: 'X', enabled: true },
        'oldX'
      )

      // Another change to #test1 (will squash with previous #test1 changes)
      manager.addChange(
        { selector: '#test1', type: 'text', value: 'C', enabled: true },
        'B'
      )

      // Should have 2 changes (#test1 squashed, #test2 separate)
      expect(manager.getUndoCount()).toBe(2)

      // Undo last added (which is #test2)
      const undo1 = manager.undo()
      expect(undo1!.change.selector).toBe('#test2')
      expect(undo1!.change.value).toBe('X')
      expect(undo1!.oldValue).toBe('oldX')

      // Undo #test1 (squashed)
      const undo2 = manager.undo()
      expect(undo2!.change.selector).toBe('#test1')
      expect(undo2!.change.value).toBe('C')
      expect(undo2!.oldValue).toBe('original')
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
          selector: `#test${i}`,
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

    it('should not exceed max size with squashing', () => {
      const smallManager = new UndoRedoManager(2)

      // Add many changes to same element (will squash to 1)
      for (let i = 0; i < 10; i++) {
        smallManager.addChange(
          { selector: '#test', type: 'text', value: `text ${i}`, enabled: true },
          i === 0 ? 'original' : `text ${i - 1}`
        )
      }

      expect(smallManager.getUndoCount()).toBe(1)

      // Add change to different element
      smallManager.addChange(
        { selector: '#other', type: 'text', value: 'other', enabled: true },
        'old other'
      )

      expect(smallManager.getUndoCount()).toBe(2)

      // Add one more to different element (should remove oldest)
      smallManager.addChange(
        { selector: '#another', type: 'text', value: 'another', enabled: true },
        'old another'
      )

      expect(smallManager.getUndoCount()).toBe(2)
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

  describe('Complex scenarios', () => {
    it('should handle alternating undo/redo operations', () => {
      const changes = [
        { selector: '#test', type: 'text' as const, value: 'A', enabled: true },
        { selector: '#test', type: 'text' as const, value: 'B', enabled: true },
        { selector: '#test', type: 'text' as const, value: 'C', enabled: true }
      ]

      manager.addChange(changes[0], 'original')
      manager.addChange(changes[1], 'A')
      manager.addChange(changes[2], 'B')

      // All squashed to 1 change
      expect(manager.getUndoCount()).toBe(1)

      // Undo -> Redo -> Undo -> Redo pattern
      manager.undo() // C -> original
      expect(manager.getUndoCount()).toBe(0)
      expect(manager.getRedoCount()).toBe(1)

      manager.redo() // original -> C
      expect(manager.getUndoCount()).toBe(1)
      expect(manager.getRedoCount()).toBe(0)

      manager.undo() // C -> original
      expect(manager.getUndoCount()).toBe(0)
      expect(manager.getRedoCount()).toBe(1)

      const redo1 = manager.redo() // original -> C
      expect(redo1!.change.value).toBe('C')
      expect(redo1!.oldValue).toBe('original')
    })
  })
})
