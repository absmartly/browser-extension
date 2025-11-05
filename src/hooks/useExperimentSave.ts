import { debugError, debugLog } from '~src/utils/debug'
import { getConfig } from '~src/utils/storage'
import type { Experiment, ExperimentCustomSectionField } from '~src/types/absmartly'
import type { VariantData } from './useExperimentVariants'
import { BackgroundAPIClient } from '~src/lib/background-api-client'

interface UseExperimentSaveOptions {
  experiment?: Experiment | null
  domFieldName: string
}

export function useExperimentSave({ experiment, domFieldName }: UseExperimentSaveOptions) {

  /**
   * Save experiment - handles both create (POST) and update (PUT)
   */
  const save = async (
    formData: any,
    currentVariants: VariantData[],
    onUpdate?: (id: number, updates: Partial<Experiment>) => void,
    onSave?: (experiment: Partial<Experiment>) => Promise<void>
  ) => {
    const config = await getConfig()
    const fieldName = config?.domChangesFieldName || '__dom_changes'

    // If editing existing experiment
    if (experiment?.id && onUpdate) {
      return await saveExistingExperiment(
        experiment,
        formData,
        currentVariants,
        fieldName,
        onUpdate
      )
    }

    // If creating new experiment
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

/**
 * Create new experiment (POST)
 */
async function createNewExperiment(
  formData: any,
  currentVariants: VariantData[],
  domFieldName: string,
  onSave: (experiment: Partial<Experiment>) => Promise<void>
) {
  // Fetch custom fields dynamically
  const client = new BackgroundAPIClient()
  let customFields: ExperimentCustomSectionField[] = []

  try {
    debugLog('[createNewExperiment] Fetching custom section fields...')
    customFields = await client.getCustomSectionFields()
    debugLog('[createNewExperiment] Fetched custom section fields:', customFields)
  } catch (error) {
    debugError('[createNewExperiment] Failed to fetch custom fields:', error)
  }

  // Build custom_section_field_values dynamically from fetched fields
  const custom_section_field_values: Record<string, any> = {}

  customFields.forEach(field => {
    custom_section_field_values[String(field.id)] = {
      value: field.default_value || "",
      type: field.type,
      id: field.id
    }
  })

  // Prepare variants - use full config as-is
  const preparedVariants = currentVariants.map((v, index) => ({
    variant: index,
    name: v.name,
    config: JSON.stringify(v.config)
  }))

  const experimentData: any = {
    ...formData,
    state: 'created',
    iteration: 1,
    unit_type: { unit_type_id: formData.unit_type_id },
    primary_metric: { metric_id: null },
    secondary_metrics: [],
    applications: formData.application_ids.map((id: number) => ({
      application_id: id,
      application_version: "0"
    })),
    experiment_tags: formData.tag_ids.map((id: number) => ({ experiment_tag_id: id })),
    variants: preparedVariants,
    variant_screenshots: [],
    owners: formData.owner_ids.map((id: number) => ({ user_id: id })),
    teams: formData.team_ids.map((id: number) => ({ team_id: id })),
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
  await onSave(experimentData)
}

/**
 * Update existing experiment (PUT)
 */
async function saveExistingExperiment(
  experiment: Experiment,
  formData: any,
  currentVariants: VariantData[],
  fieldName: string,
  onUpdate: (id: number, updates: Partial<Experiment>) => void
) {
  try {
    // Fetch full experiment data first
    const fullExperimentResponse = await chrome.runtime.sendMessage({
      type: 'API_REQUEST',
      method: 'GET',
      path: `/experiments/${experiment.id}`
    })

    if (!fullExperimentResponse.success) {
      alert('Failed to fetch experiment data: ' + fullExperimentResponse.error)
      return
    }

    const fullExperiment = fullExperimentResponse.data.experiment || fullExperimentResponse.data

    // Create updated variants - use full config as-is
    const updatedVariants = currentVariants.map((variant, index) => {
      const existingVariant = fullExperiment.variants?.find((v: any) => {
        const expVariantKey = v.name || `Variant ${v.variant}`
        return expVariantKey === variant.name
      })

      return {
        variant: existingVariant?.variant ?? index,
        name: variant.name,
        config: JSON.stringify(variant.config)
      }
    })

    // Create PUT payload
    const putPayload: any = {
      id: fullExperiment.id,
      version: new Date(fullExperiment.updated_at).getTime(),
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
        owners: formData.owner_ids.map((id: number) => ({ user_id: id })),
        teams: formData.team_ids.map((id: number) => ({ team_id: id })),
        experiment_tags: formData.tag_ids.map((id: number) => ({ experiment_tag_id: id })),
        applications: formData.application_ids.map((id: number) => ({
          application_id: id,
          application_version: "0"
        })),
        primary_metric: fullExperiment.primary_metric ? { metric_id: fullExperiment.primary_metric.metric_id || fullExperiment.primary_metric.id } : undefined,
        secondary_metrics: fullExperiment.secondary_metrics?.map((m: any) => ({
          metric_id: m.metric_id || m.metric?.id || m.id,
          type: "secondary",
          order_index: m.order_index || 0
        })) || [],
        variants: updatedVariants,
        variant_screenshots: fullExperiment.variant_screenshots || [],
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

    // Handle custom_section_field_values
    if (fullExperiment.custom_section_field_values) {
      const customFieldsObj: any = {}

      const fieldsArray = Array.isArray(fullExperiment.custom_section_field_values)
        ? fullExperiment.custom_section_field_values
        : Object.values(fullExperiment.custom_section_field_values)

      fieldsArray.forEach((field: any) => {
        const fieldId = field.experiment_custom_section_field_id || field.custom_section_field?.id || field.id

        customFieldsObj[fieldId] = {
          experiment_id: fullExperiment.id,
          experiment_custom_section_field_id: fieldId,
          type: field.type,
          value: field.value,
          updated_at: field.updated_at,
          updated_by_user_id: field.updated_by_user_id || fullExperiment.updated_by_user_id,
          custom_section_field: field.custom_section_field,
          id: fieldId,
          default_value: field.default_value || field.value
        }
      })

      putPayload.data.custom_section_field_values = customFieldsObj
    }

    onUpdate(experiment.id, putPayload)

  } catch (error) {
    debugError('Failed to save changes:', error)
    alert('Failed to save changes: ' + (error as Error).message)
  }
}
