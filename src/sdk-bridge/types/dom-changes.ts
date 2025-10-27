/**
 * DOM Changes Type Definitions
 *
 * Types for DOM manipulation and changes
 */

export type DOMChangeType = 'text' | 'html' | 'style' | 'styles' | 'class' | 'attribute' | 'delete' | 'javascript'

export interface DOMChange {
  selector: string
  type: DOMChangeType
  value?: any
  enabled?: boolean

  // Text/HTML changes
  textValue?: string

  // Style changes
  styles?: Record<string, string>

  // Class changes
  className?: string
  action?: 'add' | 'remove' | 'toggle'

  // Attribute changes
  attribute?: string
  attributeName?: string
}

export interface ElementState {
  textContent: string
  innerHTML: string
  attributes: Record<string, string>
  styles: Record<string, string>
  classList: string[]
}

export interface PreviewState {
  experimentName: string
  originalState: ElementState
  selector: string
  changeType: DOMChangeType
}

export interface OriginalDataAttributes {
  textContent?: string
  innerHTML?: string
  attributes?: Record<string, string | null>
  styles?: Record<string, string>
  originalStyleAttribute?: string
}
