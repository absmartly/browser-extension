/**
 * Type definitions for session storage state objects
 */

export interface DOMChangesInlineState {
  variantName: string
  editingChange: any
  pickingForField: string
  dragDropMode?: boolean
  changes?: any[]
}

export interface ElementPickerResult {
  variantName: string
  fieldId: string
  selector: string
}

export interface DragDropResult {
  variantName: string
  selector: string
  targetSelector: string
  position: string
}

export interface VisualEditorChanges {
  variantName: string
  changes: any[]
}
