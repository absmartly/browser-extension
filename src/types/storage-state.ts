/**
 * Type definitions for session storage state objects
 */

import type { EditingDOMChange } from '~src/components/DOMChangeEditor'
import type { DOMChange, AIDOMContext } from '~src/types/dom-changes'

export interface DOMChangesInlineState {
  variantName: string
  editingChange: EditingDOMChange | null
  pickingForField: string | null
  dragDropMode?: boolean
  changes?: DOMChange[]
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
  position: 'before' | 'after' | 'firstChild' | 'lastChild'
}

export interface VisualEditorChanges {
  variantName: string
  changes: DOMChange[]
}

export interface SidebarState {
  view: string
  selectedExperiment: number | null
  aiVariantName?: string
  aiDomContext?: AIDOMContext | null
  timestamp?: number
}

export interface ExperimentFilters {
  search?: string
  state?: string[]
  significance?: string[]
  owners?: number[]
  teams?: number[]
  tags?: number[]
  applications?: number[]
  sample_ratio_mismatch?: boolean
  cleanup_needed?: boolean
  audience_mismatch?: boolean
  sample_size_reached?: boolean
  experiments_interact?: boolean
  assignment_conflict?: boolean
}
