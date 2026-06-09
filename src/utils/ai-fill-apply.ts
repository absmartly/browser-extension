import type {
  Application,
  ExperimentCustomSectionField,
  ExperimentTag,
  Metric
} from "~src/types/absmartly"
import type { AIFillResponse } from "~src/types/ai-fill"

import { debugWarn } from "./debug"

/**
 * The shape of the inline ExperimentEditor draft that the AI fill flow
 * mutates. This mirrors what the now-removed FullScreenExperimentModal called
 * `FullScreenDraft` — keeping the fields stable means the AI prompt schema
 * keeps working without changes.
 */
export interface AIApplyDraft {
  name: string
  display_name: string
  percentage_of_traffic: number
  percentages: string
  audience_strict: boolean
  audience: string
  application_ids: number[]
  tag_ids: number[]
  primary_metric_id: number | null
  secondary_metric_ids: number[]
  customFieldValues: Record<string, unknown>
}

/**
 * Merge an LLM-produced fill response into the editor's draft. Returns a new
 * draft — never mutates the input. This is the pure-function port of the
 * implementation that lived inside FullScreenExperimentModal.tsx (FT-1905).
 *
 * Mapping rules (kept verbatim from the original):
 *  - String/number scalars overwrite directly when present.
 *  - applications/tags/primary_metrics/secondary_metrics are looked up by
 *    NAME against the workspace lists; unmatched names are dropped silently.
 *    We never invent ids.
 *  - custom_fields entries are admitted only if their `field_id` matches a
 *    workspace field id; unknown ids are logged via `debugWarn` and dropped.
 *  - hypothesis / prediction / description at the top level are mapped into
 *    customFieldValues under the workspace field whose `title` matches the
 *    key (case-insensitively). Workspaces are free to title those fields
 *    anything they like, so this is best-effort.
 */
export function applyAIResultToDraft<T extends AIApplyDraft>(
  draft: T,
  result: AIFillResponse,
  customFields: readonly ExperimentCustomSectionField[],
  applications: readonly Application[],
  tags: readonly ExperimentTag[],
  metrics: readonly Metric[]
): T {
  const next: T = { ...draft }

  if (result.display_name) next.display_name = result.display_name
  if (result.name) next.name = result.name
  if (typeof result.percentage_of_traffic === "number")
    next.percentage_of_traffic = result.percentage_of_traffic
  if (result.percentages) next.percentages = result.percentages
  if (result.audience) next.audience = result.audience
  if (typeof result.audience_strict === "boolean")
    next.audience_strict = result.audience_strict

  if (result.applications && Array.isArray(result.applications)) {
    const ids: number[] = []
    const seen = new Set<number>()
    for (const name of result.applications) {
      const match = applications.find((a) => a.name === name)
      const id = match?.application_id ?? match?.id
      if (typeof id === "number" && !seen.has(id)) {
        seen.add(id)
        ids.push(id)
      }
    }
    if (ids.length > 0) next.application_ids = ids
  }

  if (result.tags && Array.isArray(result.tags)) {
    const ids: number[] = []
    const seen = new Set<number>()
    for (const name of result.tags) {
      const match = tags.find((t) => t.name === name)
      const id = match?.experiment_tag_id
      if (typeof id === "number" && !seen.has(id)) {
        seen.add(id)
        ids.push(id)
      }
    }
    if (ids.length > 0) next.tag_ids = ids
  }

  if (result.primary_metrics && Array.isArray(result.primary_metrics)) {
    for (const name of result.primary_metrics) {
      const match = metrics.find((m) => m.name === name)
      if (match) {
        next.primary_metric_id = match.metric_id
        break // primary is single-valued; first match wins
      }
    }
  }
  if (result.secondary_metrics && Array.isArray(result.secondary_metrics)) {
    const ids: number[] = []
    const seen = new Set<number>()
    for (const name of result.secondary_metrics) {
      const match = metrics.find((m) => m.name === name)
      const id = match?.metric_id
      if (
        typeof id === "number" &&
        !seen.has(id) &&
        id !== next.primary_metric_id
      ) {
        seen.add(id)
        ids.push(id)
      }
    }
    if (ids.length > 0) next.secondary_metric_ids = ids
  }

  if (result.custom_fields) {
    const allowedIds = new Set(customFields.map((f) => f.id))
    const merged = { ...next.customFieldValues }
    const unknown: number[] = []
    for (const cf of result.custom_fields) {
      if (typeof cf.field_id === "number" && allowedIds.has(cf.field_id)) {
        merged[String(cf.field_id)] = cf.value
      } else if (typeof cf.field_id === "number") {
        unknown.push(cf.field_id)
      }
    }
    if (unknown.length > 0) {
      debugWarn(
        "[ai-fill-apply] AI returned custom_fields with unknown ids:",
        unknown.join(", "),
        "— workspace ids:",
        [...allowedIds].join(", ")
      )
    }
    next.customFieldValues = merged
  }

  // Top-level hypothesis / prediction / description → map into
  // customFieldValues by matching the workspace field's title to the key
  // (case-insensitive). Title is the only reliable display name the API
  // surfaces, and workspaces are free to name those fields anything.
  const titleToId = new Map<string, number>()
  for (const f of customFields) {
    if (typeof f.title === "string") {
      titleToId.set(f.title.toLowerCase(), f.id)
    }
  }
  for (const key of ["hypothesis", "prediction", "description"] as const) {
    const value = result[key]
    const id = titleToId.get(key)
    if (typeof value === "string" && typeof id === "number") {
      next.customFieldValues = {
        ...next.customFieldValues,
        [String(id)]: value
      }
    }
  }

  return next
}

/**
 * Overlay AI-suggested variant names onto the current variants array, by
 * positional index. Returns null if nothing changed (so callers can skip the
 * onVariantsChange call). The AI returns variants in order
 * `[Control, Variant 1, ...]` — we align by index rather than name because the
 * AI may rename Control. Extras beyond the current variant count are ignored
 * (variant count is user-controlled). Missing / empty / non-string names are
 * left as-is.
 */
export function applyAIVariantNames<V extends { name: string }>(
  currentVariants: readonly V[],
  aiVariants: readonly { name?: string; description?: string }[]
): V[] | null {
  let changed = false
  const next = currentVariants.map((v, i) => {
    const aiName = aiVariants[i]?.name
    if (typeof aiName === "string" && aiName.length > 0 && aiName !== v.name) {
      changed = true
      return { ...v, name: aiName }
    }
    return v
  })
  return changed ? next : null
}
