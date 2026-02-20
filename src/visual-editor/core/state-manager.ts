/**
 * State Manager for Visual Editor
 * Manages the global state of the visual editor
 */

import type { DOMChange } from '../types/visual-editor'

export interface UndoRedoAction {
  type: 'add' | 'update' | 'remove'
  change: DOMChange
  index: number
}

export interface VisualEditorState {
  selectedElement: Element | null
  hoveredElement: Element | null
  changes: DOMChange[]
  undoStack: UndoRedoAction[]
  redoStack: UndoRedoAction[]
  originalValues: Map<string, unknown>
  isRearranging: boolean
  isResizing: boolean
  draggedElement: Element | null
  isActive: boolean
}

export interface VisualEditorConfig {
  variantName: string
  experimentName: string
  logoUrl: string
  initialChanges?: DOMChange[]
}

class StateManager {
  private state: VisualEditorState
  private config: VisualEditorConfig
  private stateChangeListeners: Array<(state: VisualEditorState) => void> = []

  constructor(config: VisualEditorConfig) {
    this.config = config
    this.state = {
      selectedElement: null,
      hoveredElement: null,
      changes: config.initialChanges || [],
      undoStack: [],
      redoStack: [],
      originalValues: new Map(),
      isRearranging: false,
      isResizing: false,
      draggedElement: null,
      isActive: true
    }
  }

  getState(): VisualEditorState {
    return { ...this.state }
  }

  getConfig(): VisualEditorConfig {
    return { ...this.config }
  }

  updateState(updates: Partial<VisualEditorState>): void {
    this.state = { ...this.state, ...updates }
    this.notifyStateChange()
  }

  setState(newState: VisualEditorState): void {
    this.state = newState
    this.notifyStateChange()
  }

  onStateChange(listener: (state: VisualEditorState) => void): () => void {
    this.stateChangeListeners.push(listener)
    return () => {
      const index = this.stateChangeListeners.indexOf(listener)
      if (index > -1) {
        this.stateChangeListeners.splice(index, 1)
      }
    }
  }

  private notifyStateChange(): void {
    this.stateChangeListeners.forEach(listener => listener(this.state))
  }

  // Convenience methods for common state updates
  setSelectedElement(element: Element | null): void {
    this.updateState({ selectedElement: element })
  }

  setHoveredElement(element: Element | null): void {
    this.updateState({ hoveredElement: element })
  }

  addChange(change: DOMChange): void {
    const changes = [...this.state.changes, change]
    this.updateState({ changes })
  }

  setChanges(changes: DOMChange[]): void {
    this.updateState({ changes })
  }

  pushUndo(action: UndoRedoAction): void {
    const undoStack = [...this.state.undoStack, action]
    this.updateState({ undoStack, redoStack: [] }) // Clear redo stack when new action is added
  }

  pushRedo(action: UndoRedoAction): void {
    const redoStack = [...this.state.redoStack, action]
    this.updateState({ redoStack })
  }

  popUndo(): UndoRedoAction | null {
    if (this.state.undoStack.length === 0) return null

    const undoStack = [...this.state.undoStack]
    const action = undoStack.pop()
    this.updateState({ undoStack })
    // Return a deep copy to prevent mutations
    return action ? JSON.parse(JSON.stringify(action)) : null
  }

  popRedo(): UndoRedoAction | null {
    if (this.state.redoStack.length === 0) return null

    const redoStack = [...this.state.redoStack]
    const action = redoStack.pop()
    this.updateState({ redoStack })
    // Return a deep copy to prevent mutations
    return action ? JSON.parse(JSON.stringify(action)) : null
  }

  setOriginalValue(key: string, value: unknown): void {
    this.state.originalValues.set(key, value)
  }

  getOriginalValue(key: string): unknown {
    return this.state.originalValues.get(key)
  }

  setRearranging(isRearranging: boolean): void {
    this.updateState({ isRearranging })
  }

  setResizing(isResizing: boolean): void {
    this.updateState({ isResizing })
  }

  setDraggedElement(element: Element | null): void {
    this.updateState({ draggedElement: element })
  }

  deactivate(): void {
    this.updateState({ isActive: false })
  }
}

export default StateManager