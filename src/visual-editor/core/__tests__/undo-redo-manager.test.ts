import UndoRedoManager from '../undo-redo-manager'
import type { ChangeRecord } from '../undo-redo-manager'
import type { DOMChange } from '../../types/visual-editor'

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

  describe('Individual change tracking (no auto-squashing)', () => {
    it('should track multiple changes to same element individually', () => {
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

      // Should have 3 individual changes in undo stack (no squashing)
      expect(manager.getUndoCount()).toBe(3)

      // Undo should work step by step
      const undo1 = manager.undo()
      expect((undo1!.change as any).value).toBe('text 3')
      expect(undo1!.oldValue).toBe('text 2')

      const undo2 = manager.undo()
      expect((undo2!.change as any).value).toBe('text 2')
      expect(undo2!.oldValue).toBe('text 1')

      const undo3 = manager.undo()
      expect((undo3!.change as any).value).toBe('text 1')
      expect(undo3!.oldValue).toBe('original')
    })

    it('should track changes to different selectors individually', () => {
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

    it('should track changes to different types individually', () => {
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
      expect((record!.change as any).value).toBe('new text')
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
      expect((record!.change as any).value).toBe('new text')
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

  describe('squashChanges() method', () => {
    it('should squash multiple changes to same element', () => {
      // Add 3 changes to same element
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

      // Should have 3 individual changes
      expect(manager.getUndoCount()).toBe(3)

      // Squash should return 1 change with final value
      const squashed = manager.squashChanges()
      expect(squashed.length).toBe(1)
      expect(squashed[0].selector).toBe('#test')
      expect(squashed[0].type).toBe('text')
      expect((squashed[0] as any).value).toBe('text 3')
    })

    it('should not squash changes to different selectors', () => {
      manager.addChange(
        { selector: '#test1', type: 'text', value: 'text 1', enabled: true },
        'old1'
      )
      manager.addChange(
        { selector: '#test2', type: 'text', value: 'text 2', enabled: true },
        'old2'
      )

      const squashed = manager.squashChanges()
      expect(squashed.length).toBe(2)
    })

    it('should not squash changes to different types', () => {
      manager.addChange(
        { selector: '#test', type: 'text', value: 'new text', enabled: true },
        'old text'
      )
      manager.addChange(
        { selector: '#test', type: 'html', value: '<div>new html</div>', enabled: true },
        'old html'
      )

      const squashed = manager.squashChanges()
      expect(squashed.length).toBe(2)
    })

    it('should squash mixed changes correctly', () => {
      // Changes to #test1 (will squash to 1)
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

      // Another change to #test1 (will merge with earlier #test1 changes)
      manager.addChange(
        { selector: '#test1', type: 'text', value: 'C', enabled: true },
        'B'
      )

      const squashed = manager.squashChanges()

      // Should have 2 squashed changes
      expect(squashed.length).toBe(2)

      // Find the #test1 and #test2 changes
      const test1Change = squashed.find(c => c.selector === '#test1')
      const test2Change = squashed.find(c => c.selector === '#test2')

      expect(test1Change!.value).toBe('C') // Final value
      expect(test2Change!.value).toBe('X')
    })

    it('should return empty array when no changes', () => {
      const squashed = manager.squashChanges()
      expect(squashed).toEqual([])
    })

    it('should squash style changes correctly', () => {
      manager.addChange(
        { selector: '#test', type: 'style', value: { color: 'red' }, enabled: true },
        { color: 'black' }
      )
      manager.addChange(
        { selector: '#test', type: 'style', value: { color: 'blue', fontSize: '16px' }, enabled: true },
        { color: 'red' }
      )

      const squashed = manager.squashChanges()
      expect(squashed.length).toBe(1)
      expect((squashed[0] as any).value).toEqual({ color: 'blue', fontSize: '16px' })
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
      ;(change as any).value = 'mutated value'

      // The stored change should not be affected
      const record = manager.undo()
      expect((record!.change as any).value).toBe('original value')
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
      ;(undoRecord!.change as any).value = 'mutated'

      // The redo record should not be affected
      const redoRecord = manager.redo()
      expect((redoRecord!.change as any).value).toBe('new value')
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
      expect((undo1!.change as any).value).toBe('text 4')

      const undo2 = smallManager.undo()
      expect((undo2!.change as any).value).toBe('text 3')

      const undo3 = smallManager.undo()
      expect((undo3!.change as any).value).toBe('text 2')

      expect(smallManager.canUndo()).toBe(false)
    })

    it('should not exceed max size without squashing', () => {
      const smallManager = new UndoRedoManager(2)

      // Add many changes to same element (no squashing - each tracked individually)
      for (let i = 0; i < 5; i++) {
        smallManager.addChange(
          { selector: '#test', type: 'text', value: `text ${i}`, enabled: true },
          i === 0 ? 'original' : `text ${i - 1}`
        )
      }

      // Stack size limited to 2, so should only have last 2
      expect(smallManager.getUndoCount()).toBe(2)

      // Should have the last 2 changes (3 and 4)
      const undo1 = smallManager.undo()
      expect((undo1!.change as any).value).toBe('text 4')

      const undo2 = smallManager.undo()
      expect((undo2!.change as any).value).toBe('text 3')

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

  describe('Complex scenarios', () => {
    it('should handle alternating undo/redo operations with individual changes', () => {
      const changes = [
        { selector: '#test', type: 'text' as const, value: 'A', enabled: true },
        { selector: '#test', type: 'text' as const, value: 'B', enabled: true },
        { selector: '#test', type: 'text' as const, value: 'C', enabled: true }
      ]

      manager.addChange(changes[0], 'original')
      manager.addChange(changes[1], 'A')
      manager.addChange(changes[2], 'B')

      // All tracked individually - 3 changes
      expect(manager.getUndoCount()).toBe(3)

      // Undo -> Redo -> Undo -> Redo pattern
      manager.undo() // C -> B
      expect(manager.getUndoCount()).toBe(2)
      expect(manager.getRedoCount()).toBe(1)

      manager.redo() // B -> C
      expect(manager.getUndoCount()).toBe(3)
      expect(manager.getRedoCount()).toBe(0)

      manager.undo() // C -> B
      expect(manager.getUndoCount()).toBe(2)
      expect(manager.getRedoCount()).toBe(1)

      const redo1 = manager.redo() // B -> C
      expect((redo1!.change as any).value).toBe('C')
      expect(redo1!.oldValue).toBe('B')
    })
  })
})

  describe('E2E scenario simulation', () => {
    it('should handle the exact E2E test flow: 3 text changes, 3 undos, 3 redos', () => {
      const manager = new UndoRedoManager()

      // Simulate the E2E test flow: three text changes to the same element
      // Change 1: "Modified text!" -> "Undo test 1"
      manager.addChange(
        { selector: '#test-paragraph', type: 'text', value: 'Undo test 1', enabled: true },
        'Modified text!'
      )

      // Change 2: "Undo test 1" -> "Undo test 2"
      manager.addChange(
        { selector: '#test-paragraph', type: 'text', value: 'Undo test 2', enabled: true },
        'Undo test 1'
      )

      // Change 3: "Undo test 2" -> "Undo test 3"
      manager.addChange(
        { selector: '#test-paragraph', type: 'text', value: 'Undo test 3', enabled: true },
        'Undo test 2'
      )

      // Should have 3 individual changes
      expect(manager.getUndoCount()).toBe(3)
      expect(manager.getRedoCount()).toBe(0)

      // Perform 3 undos (like the E2E test does)
      // Undo 1: "Undo test 3" -> "Undo test 2"
      const undo1 = manager.undo()
      expect(undo1).not.toBeNull()
      expect((undo1!.change as any).value).toBe('Undo test 3')
      expect(undo1!.oldValue).toBe('Undo test 2')

      // Undo 2: "Undo test 2" -> "Undo test 1"
      const undo2 = manager.undo()
      expect(undo2).not.toBeNull()
      expect((undo2!.change as any).value).toBe('Undo test 2')
      expect(undo2!.oldValue).toBe('Undo test 1')

      // Undo 3: "Undo test 1" -> "Modified text!"
      const undo3 = manager.undo()
      expect(undo3).not.toBeNull()
      expect((undo3!.change as any).value).toBe('Undo test 1')
      expect(undo3!.oldValue).toBe('Modified text!')

      // After 3 undos
      expect(manager.getUndoCount()).toBe(0)
      expect(manager.getRedoCount()).toBe(3)

      // Perform 3 redos (like the E2E test does)
      // Redo 1: "Modified text!" -> "Undo test 1"
      const redo1 = manager.redo()
      expect(redo1).not.toBeNull()
      expect((redo1!.change as any).value).toBe('Undo test 1')
      expect(redo1!.oldValue).toBe('Modified text!')

      // Redo 2: "Undo test 1" -> "Undo test 2"
      const redo2 = manager.redo()
      expect(redo2).not.toBeNull()
      expect((redo2!.change as any).value).toBe('Undo test 2')
      expect(redo2!.oldValue).toBe('Undo test 1')

      // Redo 3: "Undo test 2" -> "Undo test 3"
      const redo3 = manager.redo()
      expect(redo3).not.toBeNull()
      expect((redo3!.change as any).value).toBe('Undo test 3')
      expect(redo3!.oldValue).toBe('Undo test 2')

      // After 3 redos, we should be back to the final state
      expect(manager.getUndoCount()).toBe(3)
      expect(manager.getRedoCount()).toBe(0)

      // The final state should be "Undo test 3" (the last redo's change.value)
      expect((redo3!.change as any).value).toBe('Undo test 3')
  })
  })

  describe('Change counting accuracy', () => {
    it('should correctly count undo changes with pointer approach', () => {
      const manager = new UndoRedoManager()

      // Add 3 changes
      manager.addChange(
        { selector: '#test', type: 'text', value: 'A', enabled: true },
        'original'
      )
      manager.addChange(
        { selector: '#test', type: 'text', value: 'B', enabled: true },
        'A'
      )
      manager.addChange(
        { selector: '#test', type: 'text', value: 'C', enabled: true },
        'B'
      )

      // All 3 changes can be undone
      expect(manager.getUndoCount()).toBe(3)
      expect(manager.getRedoCount()).toBe(0)

      // After 1 undo
      manager.undo()
      expect(manager.getUndoCount()).toBe(2)
      expect(manager.getRedoCount()).toBe(1)

      // After 2 undos
      manager.undo()
      expect(manager.getUndoCount()).toBe(1)
      expect(manager.getRedoCount()).toBe(2)

      // After 3 undos
      manager.undo()
      expect(manager.getUndoCount()).toBe(0)
      expect(manager.getRedoCount()).toBe(3)

      // After 1 redo
      manager.redo()
      expect(manager.getUndoCount()).toBe(1)
      expect(manager.getRedoCount()).toBe(2)

      // After 2 redos
      manager.redo()
      expect(manager.getUndoCount()).toBe(2)
      expect(manager.getRedoCount()).toBe(1)

      // After 3 redos (back to original state)
      manager.redo()
      expect(manager.getUndoCount()).toBe(3)
      expect(manager.getRedoCount()).toBe(0)
    })

    it('should count changes correctly after adding new change mid-history', () => {
      const manager = new UndoRedoManager()

      // Add 3 changes
      manager.addChange(
        { selector: '#test', type: 'text', value: 'A', enabled: true },
        'original'
      )
      manager.addChange(
        { selector: '#test', type: 'text', value: 'B', enabled: true },
        'A'
      )
      manager.addChange(
        { selector: '#test', type: 'text', value: 'C', enabled: true },
        'B'
      )

      // Undo twice to go back to 'A'
      manager.undo() // C -> B
      manager.undo() // B -> A

      expect(manager.getUndoCount()).toBe(1) // Only 'A' can be undone
      expect(manager.getRedoCount()).toBe(2) // 'B' and 'C' can be redone

      // Add new change - should truncate future history
      manager.addChange(
        { selector: '#test', type: 'text', value: 'D', enabled: true },
        'A'
      )

      // Now we have: original -> A -> D
      expect(manager.getUndoCount()).toBe(2) // 'A' and 'D'
      expect(manager.getRedoCount()).toBe(0) // 'B' and 'C' were discarded
    })

    it('should maintain accurate counts with mixed operations', () => {
      const manager = new UndoRedoManager()

      // Initial state
      expect(manager.getUndoCount()).toBe(0)
      expect(manager.getRedoCount()).toBe(0)

      // Add 1
      manager.addChange(
        { selector: '#test', type: 'text', value: 'A', enabled: true },
        'original'
      )
      expect(manager.getUndoCount()).toBe(1)
      expect(manager.getRedoCount()).toBe(0)

      // Add 2
      manager.addChange(
        { selector: '#test', type: 'text', value: 'B', enabled: true },
        'A'
      )
      expect(manager.getUndoCount()).toBe(2)
      expect(manager.getRedoCount()).toBe(0)

      // Undo 1
      manager.undo()
      expect(manager.getUndoCount()).toBe(1)
      expect(manager.getRedoCount()).toBe(1)

      // Add 3 (should clear redo stack)
      manager.addChange(
        { selector: '#test', type: 'text', value: 'C', enabled: true },
        'A'
      )
      expect(manager.getUndoCount()).toBe(2)
      expect(manager.getRedoCount()).toBe(0)

      // Undo all
      manager.undo()
      manager.undo()
      expect(manager.getUndoCount()).toBe(0)
      expect(manager.getRedoCount()).toBe(2)

      // Redo all
      manager.redo()
      manager.redo()
      expect(manager.getUndoCount()).toBe(2)
      expect(manager.getRedoCount()).toBe(0)
    })

    it('should count squashed changes correctly regardless of undo/redo state', () => {
      const manager = new UndoRedoManager()

      // Add 3 changes to same element
      manager.addChange(
        { selector: '#test', type: 'text', value: 'A', enabled: true },
        'original'
      )
      manager.addChange(
        { selector: '#test', type: 'text', value: 'B', enabled: true },
        'A'
      )
      manager.addChange(
        { selector: '#test', type: 'text', value: 'C', enabled: true },
        'B'
      )

      // Before any undo: squash should give final state
      let squashed = manager.squashChanges()
      expect(squashed.length).toBe(1)
      expect((squashed[0] as any).value).toBe('C')

      // After 1 undo: squash should give intermediate state
      manager.undo()
      squashed = manager.squashChanges()
      expect(squashed.length).toBe(1)
      expect((squashed[0] as any).value).toBe('B')

      // After 2 undos: squash should give first state
      manager.undo()
      squashed = manager.squashChanges()
      expect(squashed.length).toBe(1)
      expect((squashed[0] as any).value).toBe('A')

      // After 3 undos: squash should give empty
      manager.undo()
      squashed = manager.squashChanges()
      expect(squashed.length).toBe(0)

      // After 1 redo: squash should give first state again
      manager.redo()
      squashed = manager.squashChanges()
      expect(squashed.length).toBe(1)
      expect((squashed[0] as any).value).toBe('A')

      // After all redos: squash should give final state
      manager.redo()
      manager.redo()
      squashed = manager.squashChanges()
      expect(squashed.length).toBe(1)
      expect((squashed[0] as any).value).toBe('C')
    })

    it('should handle edge case: canUndo/canRedo at boundaries', () => {
      const manager = new UndoRedoManager()

      // No changes
      expect(manager.canUndo()).toBe(false)
      expect(manager.canRedo()).toBe(false)

      // 1 change
      manager.addChange(
        { selector: '#test', type: 'text', value: 'A', enabled: true },
        'original'
      )
      expect(manager.canUndo()).toBe(true)
      expect(manager.canRedo()).toBe(false)

      // After undo
      manager.undo()
      expect(manager.canUndo()).toBe(false)
      expect(manager.canRedo()).toBe(true)

      // After redo
      manager.redo()
      expect(manager.canUndo()).toBe(true)
      expect(manager.canRedo()).toBe(false)

      // After clear
      manager.clear()
      expect(manager.canUndo()).toBe(false)
      expect(manager.canRedo()).toBe(false)
    })
})
