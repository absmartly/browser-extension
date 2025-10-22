/**
 * UndoRedoManager - Manages undo/redo functionality for the visual editor
 *
 * Uses a single array with a pointer approach for efficient undo/redo:
 * - All changes stored in one array
 * - currentIndex tracks the current position in history
 * - Undo: move pointer backward
 * - Redo: move pointer forward
 * - New change: truncate future history, append change
 * - squashChanges() consolidates changes up to currentIndex for saving
 */

import type { DOMChange } from '../types/visual-editor'

export interface ChangeRecord {
  change: DOMChange  // The DOM change with the new value
  oldValue: any      // The previous value before this change
}

export class UndoRedoManager {
  private changes: ChangeRecord[] = []
  private currentIndex: number = -1 // Points to the current change (-1 means no changes)
  private maxStackSize: number = 100
  private onChangeAddedCallback: (() => void) | null = null

  constructor(maxStackSize: number = 100) {
    this.maxStackSize = maxStackSize
  }

  /**
   * Set a callback that will be called whenever a change is added
   */
  setOnChangeAdded(callback: () => void): void {
    this.onChangeAddedCallback = callback
  }

  /**
   * Add a change to the history
   * Truncates any "future" changes if we're in the middle of the history
   */
  addChange(change: DOMChange, oldValue: any): void {
    // Deep copy to prevent reference issues
    const newChange: DOMChange = JSON.parse(JSON.stringify(change))
    const newOldValue = JSON.parse(JSON.stringify(oldValue))

    const record: ChangeRecord = {
      change: newChange,
      oldValue: newOldValue
    }

    // Truncate future changes (anything after currentIndex)
    this.changes = this.changes.slice(0, this.currentIndex + 1)

    // Add new change
    this.changes.push(record)
    this.currentIndex++

    // Notify that a change was added
    if (this.onChangeAddedCallback) {
      this.onChangeAddedCallback()
    }

    // Limit stack size
    if (this.changes.length > this.maxStackSize) {
      this.changes.shift()
      this.currentIndex--
    }
  }

  /**
   * Undo the last change and return it for application
   */
  undo(): ChangeRecord | null {
    if (!this.canUndo()) {
      return null
    }

    const record = this.changes[this.currentIndex]
    this.currentIndex--

    // Return deep copy to prevent mutation
    return JSON.parse(JSON.stringify(record))
  }

  /**
   * Redo the last undone change and return it for application
   */
  redo(): ChangeRecord | null {
    if (!this.canRedo()) {
      return null
    }

    this.currentIndex++
    const record = this.changes[this.currentIndex]
    
    // Return deep copy to prevent mutation
    return JSON.parse(JSON.stringify(record))
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.currentIndex >= 0
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.currentIndex < this.changes.length - 1
  }

  /**
   * Get the number of changes that can be undone
   */
  getUndoCount(): number {
    return this.currentIndex + 1
  }

  /**
   * Get the number of changes that can be redone
   */
  getRedoCount(): number {
    return this.changes.length - this.currentIndex - 1
  }

  /**
   * Clear all undo/redo history
   */
  clear(): void {
    this.changes = []
    this.currentIndex = -1
  }

  /**
   * Squash changes by consolidating multiple changes to the same element
   * Used when saving to reduce redundant operations
   *
   * Only considers changes up to currentIndex (the "active" changes)
   *
   * @returns Array of squashed DOMChange objects ready for saving
   */
  squashChanges(): DOMChange[] {
    if (this.currentIndex < 0) {
      return []
    }

    // Map to track changes by selector+type combination
    const changeMap = new Map<string, { change: DOMChange; oldValue: any }>()

    // Process only the active changes (up to currentIndex)
    for (let i = 0; i <= this.currentIndex; i++) {
      const record = this.changes[i]
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
