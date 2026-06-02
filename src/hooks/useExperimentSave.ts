import { useRef, useState } from "react"

import { BackgroundAPIClient } from "~src/lib/background-api-client"
import type {
  Experiment,
  ExperimentCustomSectionField
} from "~src/types/absmartly"
import { debugError, debugLog } from "~src/utils/debug"
import {
  notifyError,
  notifySuccess,
  notifyWarning
} from "~src/utils/notifications"
import { getConfig } from "~src/utils/storage"

import type { VariantData } from "./useExperimentVariants"

export interface ExperimentFormData {
  name?: string
  display_name?: string
  unit_type_id?: number
  percentage_of_traffic?: number
  nr_variants?: number
  percentages?: string
  audience?: string
  audience_strict?: boolean
  application_ids: number[]
  tag_ids: number[]
  owner_ids: number[]
  team_ids: number[]
  /**
   * Map of custom-section field id (as a String) → user-edited (or AI-filled)
   * value. Optional; absent means "no overrides — fall back to defaults /
   * server values".
   */
  customFieldValues?: Record<string, unknown>
}

interface UseExperimentSaveOptions {
  experiment?: Experiment | null
  domFieldName: string
  onError?: (message: string) => void
}

export interface SaveStatus {
  step:
    | "idle"
    | "validating"
    | "saving"
    | "updating-cache"
    | "complete"
    | "error"
  message?: string
}

export function useExperimentSave({
  experiment,
  domFieldName,
  onError
}: UseExperimentSaveOptions) {
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ step: "idle" })

  const save = async (
    formData: ExperimentFormData,
    currentVariants: VariantData[],
    onUpdate?: (id: number, updates: Partial<Experiment>) => void,
    onSave?: (experiment: Partial<Experiment>) => Promise<void>
  ) => {
    if (savingRef.current) return

    try {
      savingRef.current = true
      setSaving(true)
      setSaveStatus({
        step: "validating",
        message: "Validating experiment data..."
      })

      const config = await getConfig()
      const fieldName = config?.domChangesFieldName || "__dom_changes"

      if (experiment?.id && onUpdate) {
        return await saveExistingExperiment(
          experiment,
          formData,
          currentVariants,
          fieldName,
          onUpdate,
          onError,
          setSaveStatus
        )
      }

      if (onSave) {
        return await createNewExperiment(
          formData,
          currentVariants,
          fieldName,
          onSave,
          setSaveStatus
        )
      }

      setSaveStatus({ step: "complete" })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred"
      setSaveStatus({ step: "error", message: errorMessage })
      throw error
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return { save, saving, saveStatus }
}

/**
 * Coerce a JS value into the `value: string` shape the ABsmartly API expects
 * for custom-section fields. Booleans and numbers are stringified directly so
 * "false" / "0" round-trip without ambiguity; arrays / objects are JSON-encoded;
 * null / undefined collapse to the empty string.
 */
function coerceCustomFieldValue(value: unknown, type: string): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "boolean") return String(value)
  if (typeof value === "number") return String(value)
  // multiselect / json / object / array values
  if (type === "multiselect" || type === "json" || typeof value === "object") {
    try {
      return JSON.stringify(value)
    } catch {
      return ""
    }
  }
  return String(value)
}

async function createNewExperiment(
  formData: ExperimentFormData,
  currentVariants: VariantData[],
  domFieldName: string,
  onSave: (experiment: Partial<Experiment>) => Promise<void>,
  setSaveStatus?: (status: SaveStatus) => void
) {
  const client = new BackgroundAPIClient()
  let customFields: ExperimentCustomSectionField[] = []

  try {
    setSaveStatus?.({
      step: "validating",
      message: "Fetching custom fields..."
    })
    debugLog("[createNewExperiment] Fetching custom section fields...")
    customFields = await client.getCustomSectionFields()
    debugLog(
      "[createNewExperiment] Fetched custom section fields:",
      customFields
    )
  } catch (error) {
    debugError("[createNewExperiment] Failed to fetch custom fields:", error)
    await notifyWarning("Failed to fetch custom fields. Using defaults.")
  }

  const custom_section_field_values: Record<
    string,
    {
      value: string
      type: string
      id: number
    }
  > = {}

  for (const field of customFields) {
    const key = String(field.id)
    const override = formData.customFieldValues?.[key]
    const hasOverride =
      formData.customFieldValues !== undefined &&
      Object.prototype.hasOwnProperty.call(formData.customFieldValues, key)
    custom_section_field_values[key] = {
      value: hasOverride
        ? coerceCustomFieldValue(override, field.type)
        : field.default_value || "",
      type: field.type,
      id: field.id
    }
  }

  const preparedVariants = currentVariants.map((v, index) => ({
    variant: index,
    name: v.name,
    config: JSON.stringify(v.config)
  }))

  const experimentData: Omit<
    Partial<Experiment>,
    | "applications"
    | "experiment_tags"
    | "variants"
    | "owners"
    | "teams"
    | "type"
    | "secondary_metrics"
  > & {
    iteration: number
    applications: Array<{ application_id: number; application_version: string }>
    experiment_tags: Array<{ experiment_tag_id: number }>
    variants: Array<{ variant: number; name: string; config: string }>
    variant_screenshots: unknown[]
    owners: Array<{ user_id: number }>
    teams: Array<{ team_id: number }>
    type: string
    secondary_metrics: unknown[]
    analysis_type: string
    baseline_participants_per_day: string
    required_alpha: string
    required_power: string
    group_sequential_futility_type: string
    group_sequential_analysis_count: null
    group_sequential_min_analysis_interval: string
    group_sequential_first_analysis_interval: string
    minimum_detectable_effect: null
    group_sequential_max_duration_interval: string
    parent_experiment: null
    template_permission: Record<string, unknown>
    template_name: string
    template_description: string
    custom_section_field_values: Record<
      string,
      { value: string; type: string; id: number }
    >
  } = {
    name: formData.name,
    display_name: formData.display_name,
    percentage_of_traffic: formData.percentage_of_traffic,
    nr_variants: formData.nr_variants || 2,
    percentages: formData.percentages || "50/50",
    audience: formData.audience || '{"filter":[{"and":[]}]}',
    audience_strict: formData.audience_strict ?? false,
    state: "created",
    iteration: 1,
    unit_type: formData.unit_type_id
      ? { unit_type_id: formData.unit_type_id }
      : undefined,
    primary_metric: { metric_id: null },
    secondary_metrics: [],
    applications: formData.application_ids.map((id) => ({
      application_id: id,
      application_version: "0"
    })),
    experiment_tags: formData.tag_ids.map((id) => ({ experiment_tag_id: id })),
    variants: preparedVariants,
    variant_screenshots: [],
    owners: formData.owner_ids.map((id) => ({ user_id: id })),
    teams: formData.team_ids.map((id) => ({ team_id: id })),
    type: "test",
    analysis_type: "group_sequential",
    baseline_participants_per_day: "33",
    required_alpha: "0.100",
    required_power: "0.800",
    group_sequential_futility_type: "binding",
    group_sequential_analysis_count: null,
    group_sequential_min_analysis_interval: "1d",
    group_sequential_first_analysis_interval: "7d",
    minimum_detectable_effect: null,
    group_sequential_max_duration_interval: "6w",
    parent_experiment: null,
    template_permission: {},
    template_name: "",
    template_description: "",
    custom_section_field_values
  }

  debugLog(
    "[createNewExperiment] Experiment data with custom fields:",
    experimentData
  )

  try {
    setSaveStatus?.({
      step: "saving",
      message: "Creating experiment in ABsmartly..."
    })
    await onSave(experimentData as unknown as Partial<Experiment>)
    setSaveStatus?.({
      step: "complete",
      message: "Experiment created successfully"
    })
    await notifySuccess("Experiment created successfully")
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"
    debugError("[createNewExperiment] Failed to create experiment:", error)
    setSaveStatus?.({
      step: "error",
      message: `Failed to create experiment: ${errorMessage}`
    })
    await notifyError(`Failed to create experiment: ${errorMessage}`)
    throw error
  }
}

interface FullExperiment extends Omit<Experiment, "type"> {
  iteration: number
  percentages: string
  audience: string
  audience_strict: boolean
  secondary_metrics?: Array<{
    metric_id?: number
    metric?: { id: number }
    id?: number
    type?: string
    order_index: number
  }>
  variant_screenshots?: unknown[]
  custom_section_field_values?:
    | Array<{
        experiment_custom_section_field_id?: number
        custom_section_field?: { id: number }
        id?: number
        type: string
        value: string
        updated_at?: string
        updated_by_user_id?: number
        default_value?: string
      }>
    | Record<string, unknown>
  parent_experiment?: unknown
  template_permission?: Record<string, unknown>
  template_name?: string
  template_description?: string
  type?: string
  analysis_type?: string
  baseline_participants_per_day?: string
  required_alpha?: string
  required_power?: string
  group_sequential_futility_type?: string
  group_sequential_analysis_count?: number | null
  group_sequential_min_analysis_interval?: string
  group_sequential_first_analysis_interval?: string
  minimum_detectable_effect?: string | null
  group_sequential_max_duration_interval?: string
  updated_by_user_id?: number
}

async function saveExistingExperiment(
  experiment: Experiment,
  formData: ExperimentFormData,
  currentVariants: VariantData[],
  fieldName: string,
  onUpdate: (id: number, updates: Partial<Experiment>) => void,
  onError?: (message: string) => void,
  setSaveStatus?: (status: SaveStatus) => void
) {
  try {
    setSaveStatus?.({
      step: "validating",
      message: "Fetching full experiment data..."
    })
    const fullExperimentResponse = await chrome.runtime.sendMessage({
      type: "API_REQUEST",
      method: "GET",
      path: `/experiments/${experiment.id}`
    })

    if (!fullExperimentResponse.success) {
      const errorMessage =
        "Failed to fetch experiment data: " + fullExperimentResponse.error
      debugError(errorMessage)
      setSaveStatus?.({ step: "error", message: errorMessage })
      await notifyError(
        `Failed to load experiment: ${fullExperimentResponse.error}`
      )
      if (onError) {
        onError(errorMessage)
      }
      return
    }

    const fullExperiment: FullExperiment =
      fullExperimentResponse.data.experiment || fullExperimentResponse.data

    // Fetch workspace custom-field definitions so we can look up the type and
    // default value when applying overrides for fields that aren't already on
    // the experiment. We tolerate failure here — without the workspace defs we
    // just can't add brand-new field entries.
    let workspaceCustomFields: ExperimentCustomSectionField[] = []
    try {
      const client = new BackgroundAPIClient()
      const fetched = await client.getCustomSectionFields()
      if (Array.isArray(fetched)) workspaceCustomFields = fetched
    } catch (error) {
      debugError(
        "[saveExistingExperiment] Failed to fetch workspace custom fields:",
        error
      )
    }
    const workspaceFieldsById = new Map<number, ExperimentCustomSectionField>()
    for (const field of workspaceCustomFields) {
      workspaceFieldsById.set(field.id, field)
    }

    setSaveStatus?.({
      step: "validating",
      message: "Validating variant data..."
    })
    const updatedVariants = currentVariants.map((variant, index) => {
      const existingVariant = fullExperiment.variants?.find((v) => {
        const expVariantKey = v.name || `Variant ${v.variant}`
        return expVariantKey === variant.name
      })

      return {
        variant: existingVariant?.variant ?? index,
        name: variant.name,
        config: JSON.stringify(variant.config)
      }
    })

    const changes: Record<string, unknown> = {
      display_name: formData.display_name || experiment.display_name,
      percentage_of_traffic: formData.percentage_of_traffic,
      unit_type: formData.unit_type_id
        ? { unit_type_id: formData.unit_type_id }
        : undefined,
      owners: formData.owner_ids.map((id) => ({ user_id: id })),
      teams: formData.team_ids.map((id) => ({ team_id: id })),
      experiment_tags: formData.tag_ids.map((id) => ({
        experiment_tag_id: id
      })),
      applications: formData.application_ids.map((id) => ({
        application_id: id,
        application_version: "0"
      })),
      variants: updatedVariants
    }

    if (
      fullExperiment.custom_section_field_values ||
      (formData.customFieldValues &&
        Object.keys(formData.customFieldValues).length > 0)
    ) {
      const customFieldsObj: Record<
        string,
        {
          experiment_id: number
          experiment_custom_section_field_id: number
          type: string
          value: string
          updated_at?: string
          updated_by_user_id?: number
          custom_section_field?: unknown
          id: number
          default_value: string
        }
      > = {}

      const fieldsArray = fullExperiment.custom_section_field_values
        ? Array.isArray(fullExperiment.custom_section_field_values)
          ? fullExperiment.custom_section_field_values
          : Object.values(fullExperiment.custom_section_field_values)
        : []

      for (const field of fieldsArray) {
        if (typeof field !== "object" || field === null) continue

        const typedField = field as {
          experiment_custom_section_field_id?: number
          custom_section_field?: { id: number; name?: string }
          id?: number
          type: string
          value: string
          updated_at?: string
          updated_by_user_id?: number
          default_value?: string
        }

        const fieldId =
          typedField.experiment_custom_section_field_id ||
          typedField.custom_section_field?.id ||
          typedField.id

        if (fieldId === undefined) continue

        customFieldsObj[fieldId] = {
          experiment_id: fullExperiment.id,
          experiment_custom_section_field_id: fieldId,
          type: typedField.type,
          value: typedField.value,
          updated_at: typedField.updated_at,
          updated_by_user_id:
            typedField.updated_by_user_id || fullExperiment.updated_by_user_id,
          custom_section_field: typedField.custom_section_field,
          id: fieldId,
          default_value: typedField.default_value || typedField.value
        }
      }

      // Layer user / AI overrides keyed by field id (as String) on top of the
      // server values. Keys that don't parse as numbers or that name a field
      // unknown to the workspace are dropped (we never invent ids). For ids
      // already on the experiment we update value/type in place; for ids the
      // experiment didn't have yet, we use the workspace defs to fill in the
      // type / default_value.
      if (formData.customFieldValues) {
        for (const [key, value] of Object.entries(formData.customFieldValues)) {
          const id = Number(key)
          if (!Number.isFinite(id)) continue
          const existing = customFieldsObj[id]
          if (existing) {
            existing.value = coerceCustomFieldValue(value, existing.type)
          } else {
            const def = workspaceFieldsById.get(id)
            if (!def) continue
            customFieldsObj[id] = {
              experiment_id: fullExperiment.id,
              experiment_custom_section_field_id: id,
              type: def.type,
              value: coerceCustomFieldValue(value, def.type),
              updated_at: undefined,
              updated_by_user_id: fullExperiment.updated_by_user_id,
              custom_section_field: undefined,
              id,
              default_value: def.default_value || ""
            }
          }
        }
      }

      changes.custom_section_field_values = customFieldsObj
    }

    try {
      setSaveStatus?.({ step: "saving", message: "Saving to ABsmartly..." })
      await onUpdate(experiment.id, changes)
      setSaveStatus?.({
        step: "complete",
        message: "Experiment saved successfully"
      })
      await notifySuccess("Experiment saved successfully")
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error"
      debugError("[saveExistingExperiment] Failed to save to ABsmartly:", error)
      setSaveStatus?.({
        step: "error",
        message: `Failed to save to ABsmartly: ${errorMessage}`
      })
      await notifyError(`Failed to save to ABsmartly: ${errorMessage}`)
      if (onError) {
        onError(`Failed to save to ABsmartly: ${errorMessage}`)
      }
      throw error
    }
  } catch (error) {
    const errorMessage = "Failed to save changes: " + (error as Error).message
    debugError(errorMessage, error)
    setSaveStatus?.({ step: "error", message: errorMessage })
    await notifyError(errorMessage)
    if (onError) {
      onError(errorMessage)
    }
    throw error
  }
}
