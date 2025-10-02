/**
 * UndoRedoManager - Manages undo/redo functionality for the visual editor
 *
 * This class maintains separate stacks for undo and redo operations.
 * It automatically squashes changes to the same element to prevent
 * intermediate steps from cluttering the undo stack.
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
   * Automatically squashes changes to the same selector+type combination
   */
  addChange(change: DOMChange, oldValue: any): void {
    // Deep copy to prevent reference issues
    const newChange: DOMChange = JSON.parse(JSON.stringify(change))
    const newOldValue = JSON.parse(JSON.stringify(oldValue))

    // Check if we're updating an existing change (squashing)
    const existingIndex = this.undoStack.findIndex(
      record => record.change.selector === newChange.selector &&
                record.change.type === newChange.type
    )

    if (existingIndex >= 0) {
      // Squash: Keep the original oldValue, update to new value
      this.undoStack[existingIndex].change.value = newChange.value
      // Note: We keep the original oldValue from the first change
    } else {
      // New change: add to stack
      const record: ChangeRecord = {
        change: newChange,
        oldValue: newOldValue
      }

      this.undoStack.push(record)

      // Limit stack size
      if (this.undoStack.length > this.maxStackSize) {
        this.undoStack.shift()
      }
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
}

export default UndoRedoManager
