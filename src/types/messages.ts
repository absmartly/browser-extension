export interface ElementSelectedMessage {
  type: 'ELEMENT_SELECTED'
  selector: string
  fieldId?: string
}

export interface DragDropCompleteMessage {
  type: 'DRAG_DROP_COMPLETE'
  selector: string
  targetSelector: string
  position: 'before' | 'after' | 'inside'
}

export interface VisualEditorMessage {
  type: 'VISUAL_EDITOR_CHANGES'
  changes: unknown[]
  variantName: string
  experimentId: number
}

export type ChromeMessage =
  | ElementSelectedMessage
  | DragDropCompleteMessage
  | VisualEditorMessage
  | { type: string; [key: string]: unknown }
