/**
 * Type definitions for session storage state objects
 */

export interface DOMChangesInlineState {
  variantName: string
  editingChange: unknown
  pickingForField: string
  dragDropMode?: boolean
  changes?: unknown[]
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
  changes: unknown[]
}

export interface SidebarState {
  view: string
  selectedExperiment: number | null
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
