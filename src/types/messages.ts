import type { DOMChange } from './dom-changes'

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
  changes: DOMChange[]
  variantName: string
  experimentId?: number
}

export interface VisualEditorCompleteMessage {
  type: 'VISUAL_EDITOR_CHANGES_COMPLETE'
  changes: DOMChange[]
  variantName: string
}

export interface VisualEditorStoppedMessage {
  type: 'VISUAL_EDITOR_STOPPED'
}

export type ChromeMessage =
  | ElementSelectedMessage
  | DragDropCompleteMessage
  | VisualEditorMessage
  | VisualEditorCompleteMessage
  | VisualEditorStoppedMessage

export function isElementSelectedMessage(msg: ChromeMessage): msg is ElementSelectedMessage {
  return msg.type === 'ELEMENT_SELECTED'
}

export function isDragDropCompleteMessage(msg: ChromeMessage): msg is DragDropCompleteMessage {
  return msg.type === 'DRAG_DROP_COMPLETE'
}

export function isVisualEditorMessage(msg: ChromeMessage): msg is VisualEditorMessage {
  return msg.type === 'VISUAL_EDITOR_CHANGES'
}
