/**
 * UndoRedoManager - Manages undo/redo functionality for the visual editor
 *
 * This class maintains separate stacks for undo and redo operations.
 * Each change is tracked individually to allow step-by-step undo/redo.
 * Changes can be squashed when saving via the squashChanges() method.
 */

import { DOMChange } from '../types/visual-editor'

export interface ChangeRecord {
  change: DOMChange  // The DOM change with the new value
  oldValue: any      // The previous value before this change
}

export class UndoRedoManager {
  private undoStack: ChangeRecord[] = []
  private redoStack: ChangeRecord[] = []
  private maxStackSize: number = 100

  constructor(maxStackSize: number = 100) {
    this.maxStackSize = maxStackSize
  }

  /**
   * Add a change to the undo stack
   * Each change is tracked individually for undo/redo
   */
  addChange(change: DOMChange, oldValue: any): void {
    // Deep copy to prevent reference issues
    const newChange: DOMChange = JSON.parse(JSON.stringify(change))
    const newOldValue = JSON.parse(JSON.stringify(oldValue))

    // Simply add the change to the stack without squashing
    const record: ChangeRecord = {
      change: newChange,
      oldValue: newOldValue
    }

    this.undoStack.push(record)

    // Limit stack size
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift()
    }

    // Clear redo stack when new change is made
    this.redoStack = []
  }

  /**
   * Undo the last change and return it for application
   */
  undo(): ChangeRecord | null {
    if (this.undoStack.length === 0) {
      return null
    }

    const record = this.undoStack.pop()!

    // Deep copy and add to redo stack
    this.redoStack.push(JSON.parse(JSON.stringify(record)))

    return record
  }

  /**
   * Redo the last undone change and return it for application
   */
  redo(): ChangeRecord | null {
    if (this.redoStack.length === 0) {
      return null
    }

    const record = this.redoStack.pop()!

    // Deep copy and add back to undo stack
    this.undoStack.push(JSON.parse(JSON.stringify(record)))

    return record
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  /**
   * Get the number of changes in the undo stack
   */
  getUndoCount(): number {
    return this.undoStack.length
  }

  /**
   * Get the number of changes in the redo stack
   */
  getRedoCount(): number {
    return this.redoStack.length
  }

  /**
   * Clear all undo/redo history
   */
  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }

  /**
   * Squash changes by consolidating multiple changes to the same element
   * Used when saving to reduce redundant operations
   *
   * For each unique selector+type combination, keeps only the final value
   * while preserving the original oldValue from the first change
   *
   * @returns Array of squashed DOMChange objects ready for saving
   */
  squashChanges(): DOMChange[] {
    if (this.undoStack.length === 0) {
      return []
    }

    // Map to track changes by selector+type combination
    const changeMap = new Map<string, { change: DOMChange; oldValue: any }>()

    // Process changes in order, keeping track of first oldValue and last change
    for (const record of this.undoStack) {
      const key = `${record.change.selector}-${record.change.type}`

      if (changeMap.has(key)) {
        // Update to latest change value, but keep original oldValue
        const existing = changeMap.get(key)!
        changeMap.set(key, {
          change: record.change,
          oldValue: existing.oldValue // Keep the original oldValue
        })
      } else {
        // First change for this selector+type
        changeMap.set(key, {
          change: record.change,
          oldValue: record.oldValue
        })
      }
    }

    // Convert map to array of DOMChange objects
    return Array.from(changeMap.values()).map(({ change }) => change)
  }
}

export default UndoRedoManager
