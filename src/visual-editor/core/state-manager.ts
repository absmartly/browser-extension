/**
 * State Manager for Visual Editor
 * Manages the global state of the visual editor
 */

export interface VisualEditorState {
  selectedElement: Element | null
  hoveredElement: Element | null
  changes: any[]
  undoStack: any[]
  redoStack: any[]
  originalValues: Map<string, any>
  isRearranging: boolean
  isResizing: boolean
  draggedElement: Element | null
  isActive: boolean
}

export interface VisualEditorConfig {
  variantName: string
  experimentName: string
  logoUrl: string
  initialChanges?: any[]
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

  addChange(change: any): void {
    const changes = [...this.state.changes, change]
    this.updateState({ changes })
  }

  setChanges(changes: any[]): void {
    this.updateState({ changes })
  }

  pushUndo(action: any): void {
    const undoStack = [...this.state.undoStack, action]
    this.updateState({ undoStack, redoStack: [] }) // Clear redo stack when new action is added
  }

  pushRedo(action: any): void {
    const redoStack = [...this.state.redoStack, action]
    this.updateState({ redoStack })
  }

  popUndo(): any | null {
    if (this.state.undoStack.length === 0) return null

    const undoStack = [...this.state.undoStack]
    const action = undoStack.pop()
    this.updateState({ undoStack })
    return action
  }

  popRedo(): any | null {
    if (this.state.redoStack.length === 0) return null

    const redoStack = [...this.state.redoStack]
    const action = redoStack.pop()
    this.updateState({ redoStack })
    return action
  }

  setOriginalValue(key: string, value: any): void {
    this.state.originalValues.set(key, value)
  }

  getOriginalValue(key: string): any {
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