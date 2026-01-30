import { debugError, debugLog } from '~src/utils/debug'
import { getConfig } from '~src/utils/storage'
import type { Experiment, ExperimentCustomSectionField } from '~src/types/absmartly'
import type { VariantData } from './useExperimentVariants'
import { BackgroundAPIClient } from '~src/lib/background-api-client'

export interface ExperimentFormData {
  display_name?: string
  unit_type_id?: number
  percentage_of_traffic?: number
  application_ids: number[]
  tag_ids: number[]
  owner_ids: number[]
  team_ids: number[]
}

interface UseExperimentSaveOptions {
  experiment?: Experiment | null
  domFieldName: string
  onError?: (message: string) => void
}

export function useExperimentSave({ experiment, domFieldName, onError }: UseExperimentSaveOptions) {

  const save = async (
    formData: ExperimentFormData,
    currentVariants: VariantData[],
    onUpdate?: (id: number, updates: Partial<Experiment>) => void,
    onSave?: (experiment: Partial<Experiment>) => Promise<void>
  ) => {
    const config = await getConfig()
    const fieldName = config?.domChangesFieldName || '__dom_changes'

    if (experiment?.id && onUpdate) {
      return await saveExistingExperiment(
        experiment,
        formData,
        currentVariants,
        fieldName,
        onUpdate,
        onError
      )
    }

    if (onSave) {
      return await createNewExperiment(
        formData,
        currentVariants,
        fieldName,
        onSave
      )
    }
  }

  return { save }
}

async function createNewExperiment(
  formData: ExperimentFormData,
  currentVariants: VariantData[],
  domFieldName: string,
  onSave: (experiment: Partial<Experiment>) => Promise<void>
) {
  const client = new BackgroundAPIClient()
  let customFields: ExperimentCustomSectionField[] = []

  try {
    debugLog('[createNewExperiment] Fetching custom section fields...')
    customFields = await client.getCustomSectionFields()
    debugLog('[createNewExperiment] Fetched custom section fields:', customFields)
  } catch (error) {
    debugError('[createNewExperiment] Failed to fetch custom fields:', error)
  }

  const custom_section_field_values: Record<string, {
    value: string
    type: string
    id: number
  }> = {}

  for (const field of customFields) {
    custom_section_field_values[String(field.id)] = {
      value: field.default_value || "",
      type: field.type,
      id: field.id
    }
  }

  const preparedVariants = currentVariants.map((v, index) => ({
    variant: index,
    name: v.name,
    config: JSON.stringify(v.config)
  }))

  const experimentData: Omit<Partial<Experiment>, 'applications' | 'experiment_tags' | 'variants' | 'owners' | 'teams' | 'type' | 'secondary_metrics'> & {
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
    custom_section_field_values: Record<string, { value: string; type: string; id: number }>
  } = {
    ...formData,
    state: 'created',
    iteration: 1,
    unit_type: formData.unit_type_id ? { unit_type_id: formData.unit_type_id } : undefined,
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
    type: 'test',
    analysis_type: 'group_sequential',
    baseline_participants_per_day: '33',
    required_alpha: '0.100',
    required_power: '0.800',
    group_sequential_futility_type: 'binding',
    group_sequential_analysis_count: null,
    group_sequential_min_analysis_interval: '1d',
    group_sequential_first_analysis_interval: '7d',
    minimum_detectable_effect: null,
    group_sequential_max_duration_interval: '6w',
    parent_experiment: null,
    template_permission: {},
    template_name: '',
    template_description: '',
    custom_section_field_values
  }

  debugLog('[createNewExperiment] Experiment data with custom fields:', experimentData)
  await onSave(experimentData as unknown as Partial<Experiment>)
}

interface FullExperiment extends Omit<Experiment, 'type'> {
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
  custom_section_field_values?: Array<{
    experiment_custom_section_field_id?: number
    custom_section_field?: { id: number }
    id?: number
    type: string
    value: string
    updated_at?: string
    updated_by_user_id?: number
    default_value?: string
  }> | Record<string, unknown>
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
  onError?: (message: string) => void
) {
  try {
    const fullExperimentResponse = await chrome.runtime.sendMessage({
      type: 'API_REQUEST',
      method: 'GET',
      path: `/experiments/${experiment.id}`
    })

    if (!fullExperimentResponse.success) {
      const errorMessage = 'Failed to fetch experiment data: ' + fullExperimentResponse.error
      debugError(errorMessage)
      if (onError) {
        onError(errorMessage)
      }
      return
    }

    const fullExperiment: FullExperiment = fullExperimentResponse.data.experiment || fullExperimentResponse.data

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

    const putPayload = {
      id: fullExperiment.id,
      version: new Date(fullExperiment.updated_at || Date.now()).getTime(),
      data: {
        state: fullExperiment.state,
        name: fullExperiment.name,
        display_name: formData.display_name || experiment.display_name,
        iteration: fullExperiment.iteration,
        percentage_of_traffic: formData.percentage_of_traffic,
        unit_type: formData.unit_type_id ? { unit_type_id: formData.unit_type_id } : undefined,
        nr_variants: updatedVariants.length,
        percentages: fullExperiment.percentages,
        audience: fullExperiment.audience,
        audience_strict: fullExperiment.audience_strict,
        owners: formData.owner_ids.map((id) => ({ user_id: id })),
        teams: formData.team_ids.map((id) => ({ team_id: id })),
        experiment_tags: formData.tag_ids.map((id) => ({ experiment_tag_id: id })),
        applications: formData.application_ids.map((id) => ({
          application_id: id,
          application_version: "0"
        })),
        primary_metric: fullExperiment.primary_metric ? { metric_id: fullExperiment.primary_metric.metric_id || fullExperiment.primary_metric.id } : undefined,
        secondary_metrics: fullExperiment.secondary_metrics?.map((m) => ({
          metric_id: m.metric_id || m.metric?.id || m.id,
          type: "secondary",
          order_index: m.order_index || 0
        })) || [],
        variants: updatedVariants,
        variant_screenshots: (fullExperiment.variant_screenshots || []).map((screenshot: any) => ({
          variant: screenshot.variant,
          screenshot_file_upload_id: screenshot.screenshot_file_upload_id,
          label: screenshot.label
        })),
        custom_section_field_values: {},
        parent_experiment: fullExperiment.parent_experiment || null,
        template_permission: fullExperiment.template_permission || {},
        template_name: fullExperiment.template_name || fullExperiment.name,
        template_description: fullExperiment.template_description || "",
        type: fullExperiment.type || "test",
        analysis_type: fullExperiment.analysis_type || "group_sequential",
        baseline_participants_per_day: fullExperiment.baseline_participants_per_day,
        required_alpha: fullExperiment.required_alpha ? String(parseFloat(fullExperiment.required_alpha).toFixed(3)) : null,
        required_power: fullExperiment.required_power ? String(parseFloat(fullExperiment.required_power).toFixed(3)) : null,
        group_sequential_futility_type: fullExperiment.group_sequential_futility_type,
        group_sequential_analysis_count: fullExperiment.group_sequential_analysis_count,
        group_sequential_min_analysis_interval: fullExperiment.group_sequential_min_analysis_interval,
        group_sequential_first_analysis_interval: fullExperiment.group_sequential_first_analysis_interval,
        minimum_detectable_effect: fullExperiment.minimum_detectable_effect,
        group_sequential_max_duration_interval: fullExperiment.group_sequential_max_duration_interval
      }
    }

    if (fullExperiment.custom_section_field_values) {
      const customFieldsObj: Record<string, {
        experiment_id: number
        experiment_custom_section_field_id: number
        type: string
        value: string
        updated_at?: string
        updated_by_user_id?: number
        custom_section_field?: unknown
        id: number
        default_value: string
      }> = {}

      const fieldsArray = Array.isArray(fullExperiment.custom_section_field_values)
        ? fullExperiment.custom_section_field_values
        : Object.values(fullExperiment.custom_section_field_values)

      for (const field of fieldsArray) {
        if (typeof field !== 'object' || field === null) continue

        const typedField = field as {
          experiment_custom_section_field_id?: number
          custom_section_field?: { id: number }
          id?: number
          type: string
          value: string
          updated_at?: string
          updated_by_user_id?: number
          default_value?: string
        }

        const fieldId = typedField.experiment_custom_section_field_id || typedField.custom_section_field?.id || typedField.id

        if (fieldId === undefined) continue

        customFieldsObj[fieldId] = {
          experiment_id: fullExperiment.id,
          experiment_custom_section_field_id: fieldId,
          type: typedField.type,
          value: typedField.value,
          updated_at: typedField.updated_at,
          updated_by_user_id: typedField.updated_by_user_id || fullExperiment.updated_by_user_id,
          custom_section_field: typedField.custom_section_field,
          id: fieldId,
          default_value: typedField.default_value || typedField.value
        }
      }

      putPayload.data.custom_section_field_values = customFieldsObj
    }

    await onUpdate(experiment.id, putPayload)

  } catch (error) {
    const errorMessage = 'Failed to save changes: ' + (error as Error).message
    debugError(errorMessage, error)
    if (onError) {
      onError(errorMessage)
    }
  }
}
