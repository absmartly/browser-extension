import type { DOMChange } from "~src/types/dom-changes"

/** Screenshots captured for a single variant (preview OFF vs ON). */
export interface VariantScreenshot {
  /** Variant index in the experiment (0 = control). */
  variantIndex: number
  variantName: string
  /** Full-page data URL with no DOM changes applied. */
  beforeDataUrl: string
  /** Full-page data URL with this variant's DOM changes applied. */
  afterDataUrl: string
  /** Captured at viewport. Width/height in CSS pixels. */
  width: number
  height: number
}

/** Custom field definition trimmed down to what the LLM needs. The numeric
 *  `id` is the canonical identifier we ask the LLM to echo back — it's the
 *  one stable, unambiguous handle the ABsmartly API exposes for a field.
 *  `title` is included for context only (so the LLM understands what the
 *  field means) but must NOT be reused in the response.
 */
export interface CustomFieldDescriptor {
  id: number
  title: string
  type:
    | "text"
    | "select"
    | "multiselect"
    | "single_select"
    | "multi_select"
    | "string"
    | "json"
    | "boolean"
    | "number"
    | "user"
  options?: readonly string[]
  helpText?: string
  required: boolean
}

/** Everything we hand to `fillExperimentFromAI`. */
export interface AIFillRequest {
  /** Whatever the user already typed in the form. */
  draft: AIFillDraft
  /** Available custom field definitions for the workspace. */
  customFields: readonly CustomFieldDescriptor[]
  /** Available applications (id + name) for the workspace. */
  applications?: readonly { id: number; name: string }[]
  /** Available experiment tags (id + name) for the workspace. */
  tags?: readonly { id: number; name: string }[]
  /** Available metrics (id + name + description) for the workspace. */
  metrics?: readonly { id: number; name: string; description?: string }[]
  /** Page context. */
  pageUrl: string
  pageTitle: string
  /** Visible text on the page (compressed). */
  pageVisibleText: string
  /** Per-variant DOM changes already authored. May be empty. */
  variantDomChanges: readonly {
    variantIndex: number
    variantName: string
    changes: DOMChange[]
  }[]
  /** Per-variant before/after screenshots (only for variants with DOM changes). */
  variantScreenshots: readonly VariantScreenshot[]
  /** Optional free-text user prompt. */
  userPrompt?: string
}

/** Subset of the form draft the AI is allowed to read/fill. */
export interface AIFillDraft {
  name: string
  display_name: string
  percentage_of_traffic: number
  percentages: string
  audience: string
  audience_strict: boolean
  application_ids: number[]
  tag_ids: number[]
  variantNames: string[]
  customFieldValues: Record<string, unknown>
}

/** What the LLM returns. Every field is optional — missing means "leave alone". */
export interface AIFillResponse {
  display_name?: string
  name?: string
  hypothesis?: string
  prediction?: string
  description?: string
  percentage_of_traffic?: number
  percentages?: string
  audience?: string
  audience_strict?: boolean
  applications?: string[]
  tags?: string[]
  /** Single primary metric name (first match wins; extras are ignored). */
  primary_metrics?: string[]
  /** Names of secondary metrics — must match metricDefinitions entries. */
  secondary_metrics?: string[]
  variants?: { name: string; description?: string }[]
  custom_fields?: { field_id: number; value: unknown }[]
}
