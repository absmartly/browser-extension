/**
 * DOM Changes Type Definitions
 *
 * Types for DOM manipulation and changes
 */

export type DOMChangeType = 'text' | 'html' | 'style' | 'styles' | 'styleRules' | 'class' | 'attribute' | 'delete' | 'javascript'

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

export interface DOMChangeStyleRules {
  selector: string
  type: 'styleRules'
  value?: string
  states?: {
    normal?: Record<string, string>
    hover?: Record<string, string>
    active?: Record<string, string>
    focus?: Record<string, string>
  }
  important?: boolean
  disabled?: boolean
  waitForElement?: boolean
  persistStyle?: boolean
  observerRoot?: string
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
