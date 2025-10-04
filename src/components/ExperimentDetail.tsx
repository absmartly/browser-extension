import React, { useState, useEffect } from 'react'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'

import { Storage } from '@plasmohq/storage'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'
import { Input } from './ui/Input'
import type { Experiment, ABsmartlyConfig } from '~src/types/absmartly'
import { Logo } from './Logo'
import type { DOMChange } from '~src/types/dom-changes'
import { ArrowLeftIcon, PencilIcon, CheckIcon, XMarkIcon, ExclamationTriangleIcon, ArrowTopRightOnSquareIcon, PencilSquareIcon, PlusIcon, TrashIcon, CodeBracketIcon, PlayIcon, StopIcon } from '@heroicons/react/24/outline'
import { DOMChangesJSONEditor } from './DOMChangesJSONEditor'
import { VariantList, type Variant } from './VariantList'
import { ExperimentMetadata } from './ExperimentMetadata'
import { getConfig } from '~src/utils/storage'

const storage = new Storage({ area: "local" })

interface ExperimentDetailProps {
  experiment: Experiment
  onBack: () => void
  onStart: (id: number) => void
  onStop: (id: number) => void
  onUpdate?: (id: number, updates: Partial<Experiment>) => void
  loading?: boolean
}

// Removed - now using Variant from VariantList

export function ExperimentDetail({ 
  experiment, 
  onBack, 
  onStart, 
  onStop,
  onUpdate,
  loading 
}: ExperimentDetailProps) {
  debugLog('🔍 ExperimentDetail render start - experiment:', experiment)
  debugLog('🔍 ExperimentDetail render start - experiment.variants:', experiment?.variants)
  debugLog('🔍 ExperimentDetail render start - loading:', loading)

  // Always in edit mode - removed isEditing state
  const [editingName, setEditingName] = useState(false)
  const [displayName, setDisplayName] = useState(experiment.display_name || experiment.name)
  // Convert experiment variants to VariantList format
  const [initialVariants] = useState<Variant[]>(() => {
    if (experiment?.variants) {
      return experiment.variants.map(v => {
        let dom_changes: DOMChange[] = []
        let variables: Record<string, any> = {}
        try {
          const config = JSON.parse(v.config || '{}')
          const fieldName = '__dom_changes'
          if (config[fieldName] && Array.isArray(config[fieldName])) {
            dom_changes = config[fieldName]
            const tempConfig = { ...config }
            delete tempConfig[fieldName]
            variables = tempConfig
          } else {
            variables = config
          }
        } catch (e) {
          debugError('Failed to parse variant config:', e)
        }
        return {
          name: v.name || `Variant ${v.variant}`,
          variables,
          dom_changes
        }
      })
    }
    return []
  })
  
  const [currentVariants, setCurrentVariants] = useState<Variant[]>(initialVariants)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isLoadingFullData, setIsLoadingFullData] = useState(false)
  const [domFieldName, setDomFieldName] = useState<string>('__dom_changes')
  const [metadata, setMetadata] = useState({
    percentage_of_traffic: experiment.percentage_of_traffic || 100,
    unit_type_id: experiment.unit_type?.unit_type_id || experiment.unit_type?.id || null,
    application_ids: experiment.applications?.map(a => a.application_id || a.id) || [],
    owner_ids: experiment.owners?.map(o => o.user_id || o.id) || [],
    team_ids: experiment.teams?.map(t => t.team_id || t.id) || [],
    tag_ids: experiment.experiment_tags?.map(t => t.experiment_tag_id || t.id || t.experiment_tag?.id).filter((id): id is number => id !== undefined) || []
  })

  debugLog('🔍 ExperimentDetail state - displayName:', displayName)
  debugLog('🔍 ExperimentDetail state - variants length:', experiment?.variants?.length)
  debugLog('🔍 ExperimentDetail state - should show variants section:', experiment.variants && experiment.variants.length > 0)

  // Load config on mount to get the DOM changes field name
  useEffect(() => {
    const loadConfig = async () => {
      const config = await getConfig()
      const fieldName = config?.domChangesFieldName || '__dom_changes'
      setDomFieldName(fieldName)
    }
    loadConfig()
  }, [])

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'running':
      case 'running_not_full_on':
        return 'success'
      case 'draft':
      case 'created':
      case 'ready':
        return 'default'
      case 'stopped':
      case 'scheduled':
        return 'warning'
      case 'archived':
        return 'danger'
      case 'development':
        return 'info'
      default:
        return 'default'
    }
  }

  const handleSaveDisplayName = () => {
    if (onUpdate && displayName !== experiment.display_name) {
      onUpdate(experiment.id, { display_name: displayName })
    }
    setEditingName(false)
  }

  const handleSaveChanges = async () => {
    if (!onUpdate) return
    
    try {
      // Get the configuration to check storage settings
      const config = await getConfig()
      const storageType = config?.domChangesStorageType || 'variable'
      const fieldName = config?.domChangesFieldName || '__dom_changes'
      
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
      
      // Extract experiment from response - GET returns {experiment: {...}}
      const fullExperiment = fullExperimentResponse.data.experiment || fullExperimentResponse.data
      
      // Check if custom field exists when using custom_field storage
      if (storageType === 'custom_field') {
        const hasCustomField = fullExperiment.custom_section_field_values && 
          Object.values(fullExperiment.custom_section_field_values).some((field: any) => 
            field.custom_section_field?.sdk_field_name === fieldName &&
            field.custom_section_field?.available_in_sdk === true
          )
        
        if (!hasCustomField) {
          alert(`Error: Custom field with SDK name "${fieldName}" not found or not available in SDK. Please check your experiment configuration.`)
          return
        }
      }
      
      // Prepare DOM changes payload
      const domChangesPayload: Record<string, DOMChange[]> = {}
      currentVariants.forEach((variant) => {
        if (variant.dom_changes && variant.dom_changes.length > 0) {
          domChangesPayload[variant.name] = variant.dom_changes
        }
      })
      
      // Create updated variants
      const updatedVariants = currentVariants.map((variant, index) => {
        // Find the existing experiment variant
        const existingVariant = fullExperiment.variants?.find((v: any) => {
          const expVariantKey = v.name || `Variant ${v.variant}`
          return expVariantKey === variant.name
        })
        
        let config = { ...variant.variables }
        
        // Add DOM changes to variant config if using variable storage
        if (storageType === 'variable') {
          config[fieldName] = variant.dom_changes || []
        }
        
        // Return clean variant object without nested data
        return {
          variant: existingVariant?.variant ?? index,
          name: variant.name,
          config: JSON.stringify(config)
        }
      })
      
      // Create PUT payload with correct structure: id, version, data at root level
      // Version should be the updated_at timestamp converted to milliseconds
      const putPayload: any = {
        id: fullExperiment.id,
        version: new Date(fullExperiment.updated_at).getTime(),
        data: {
          state: fullExperiment.state,
          name: fullExperiment.name,
          display_name: displayName,
          iteration: fullExperiment.iteration,
          percentage_of_traffic: metadata.percentage_of_traffic,
          unit_type: metadata.unit_type_id ? { unit_type_id: metadata.unit_type_id } : undefined,
          nr_variants: updatedVariants.length,
          percentages: fullExperiment.percentages,
          audience: fullExperiment.audience,
          audience_strict: fullExperiment.audience_strict,
          owners: metadata.owner_ids.map(id => ({ user_id: id })),
          teams: metadata.team_ids.map(id => ({ team_id: id })),
          experiment_tags: metadata.tag_ids.map(id => ({ experiment_tag_id: id })),
          applications: metadata.application_ids.map(id => ({
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
      
      // Convert custom_section_field_values to object format for PUT request (like ABSmartly website)
      if (fullExperiment.custom_section_field_values) {
        const customFieldsObj: any = {}
        
        // Handle both object and array formats from GET response
        const fieldsArray = Array.isArray(fullExperiment.custom_section_field_values) 
          ? fullExperiment.custom_section_field_values
          : Object.values(fullExperiment.custom_section_field_values)
        
        fieldsArray.forEach((field: any) => {
          const fieldId = field.experiment_custom_section_field_id || field.custom_section_field?.id || field.id
          
          // Create the full field object structure like in the working request
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
          
          // Update DOM changes field if using custom_field storage
          if (storageType === 'custom_field' && 
              field.custom_section_field?.sdk_field_name === fieldName) {
            customFieldsObj[fieldId].value = JSON.stringify(domChangesPayload)
          }
        })
        
        putPayload.data.custom_section_field_values = customFieldsObj
      }
      
      // Send the complete PUT payload (including id, version, data at root level)
      onUpdate(experiment.id, putPayload)
      
      // Mark as saved
      setHasUnsavedChanges(false)
      
    } catch (error) {
      debugError('Failed to save changes:', error)
      alert('Failed to save changes: ' + error.message)
    }
  }



  const canAddVariants = experiment.state !== 'running' &&
                         experiment.state !== 'development' &&
                         experiment.status !== 'running' &&
                         experiment.status !== 'development'

  return (
    <div className="p-4">
      {/* Header with logo, experiment name, status/traffic, and actions */}
      <div className="mb-4">
        {/* First line: logo + name on left, back button on right */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-start gap-3">
            <Logo />
            {editingName ? (
              <div className="flex-1">
                <div className="flex items-center gap-0.5">
                  <input
                    className="flex-1 text-lg font-semibold rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    autoFocus
                    title={`ID: ${experiment.id}`}
                  />
                  <button
                    onClick={handleSaveDisplayName}
                    className="p-0.5 text-green-600 hover:text-green-800"
                  >
                    <CheckIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setDisplayName(experiment.display_name || experiment.name)
                      setEditingName(false)
                    }}
                    className="p-0.5 text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
                {displayName !== experiment.name && (
                  <p className="text-sm text-gray-500 mt-1">{experiment.name}</p>
                )}
              </div>
            ) : (
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900" title={`ID: ${experiment.id}`}>{displayName}</h2>
                {displayName !== experiment.name && (
                  <p className="text-sm text-gray-500" title={`ID: ${experiment.id}`}>{experiment.name}</p>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              if (hasUnsavedChanges) {
                if (window.confirm('You have unsaved changes. Do you want to discard them?')) {
                  // User wants to discard changes - clear storage before navigating back
                  const storageKey = `experiment-${experiment.id}-variants`
                  debugLog('🧹 User chose to discard changes for experiment', experiment.id)
                  storage.remove(storageKey).then(() => {
                    debugLog('🧹 Cleared variant data from storage for experiment', experiment.id)
                    onBack()
                  }).catch(error => {
                    debugError('Failed to clear storage:', error)
                    onBack()
                  })
                }
                // If user cancels, do nothing (stay on the page)
              } else {
                onBack()
              }
            }}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            aria-label="Go back"
            title="Go back"
          >
            <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Second line: status + traffic on left, action icons on right */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {loading && (
              <div className="flex items-center text-sm text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Loading...
              </div>
            )}
            <Badge variant={getStatusVariant(experiment.state || experiment.status || 'created')}>
              {experiment.state || experiment.status || 'created'}
            </Badge>
          </div>
          {!editingName && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setEditingName(true)}
                className="p-1 text-gray-400 hover:text-gray-600"
                title="Edit name"
              >
                <PencilIcon className="h-4 w-4" />
              </button>

              {/* Open in ABsmartly */}
              <div className="relative group">
                <button
                  onClick={async () => {
                    const config = await getConfig()
                    if (config?.apiEndpoint) {
                      const baseUrl = config.apiEndpoint.replace(/\/+$/, '').replace(/\/v1$/, '')
                      const url = `${baseUrl}/experiments/${experiment.id}`
                      chrome.tabs.create({ url })
                    }
                  }}
                  className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  aria-label="Open in ABsmartly"
                >
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                </button>

                {/* Tooltip with high z-index */}
                <div className="absolute right-0 bottom-full mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                  Open in ABsmartly
                  <div className="absolute top-full right-2 w-0 h-0 border-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>

              {/* Edit in ABsmartly */}
              <div className="relative group">
                <button
                  onClick={async () => {
                    const config = await getConfig()
                    if (config?.apiEndpoint) {
                      const baseUrl = config.apiEndpoint.replace(/\/+$/, '').replace(/\/v1$/, '')
                      const url = `${baseUrl}/experiments/${experiment.id}/edit`
                      chrome.tabs.create({ url })
                    }
                  }}
                  className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                  aria-label="Edit in ABsmartly"
                >
                  <PencilSquareIcon className="h-4 w-4" />
                </button>

                {/* Tooltip with high z-index */}
                <div className="absolute right-0 bottom-full mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                  Edit in ABsmartly
                  <div className="absolute top-full right-2 w-0 h-0 border-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">

        {/* Metadata Section */}
        <ExperimentMetadata
          data={metadata}
          onChange={(newMetadata) => {
            setMetadata(newMetadata)
            setHasUnsavedChanges(true)
          }}
          canEdit={true}
        />

        {/* Variants Section */}
        {currentVariants.length > 0 && (
          <VariantList
            initialVariants={initialVariants}
            experimentId={experiment.id}
            experimentName={experiment.name}
            onVariantsChange={(variants, hasChanges) => {
              setCurrentVariants(variants)
              setHasUnsavedChanges(hasChanges)
            }}
            canEdit={true}
            canAddRemove={canAddVariants}
          />
        )}

        {/* Action Buttons */}
        <div className="pt-4 flex gap-2">
          <Button 
            onClick={handleSaveChanges}
            variant="primary"
            size="sm"
            disabled={loading}
            className={hasUnsavedChanges ? 'ring-2 ring-yellow-400' : ''}
          >
            {hasUnsavedChanges ? '• Save Changes' : 'Save Changes'}
          </Button>
          {(experiment.state === 'ready' || experiment.state === 'created' || experiment.status === 'draft') && (
            <Button 
              onClick={() => onStart(experiment.id)}
              variant="secondary"
              size="sm"
              disabled={loading}
            >
              <PlayIcon className="h-4 w-4 mr-1" />
              Start Experiment
            </Button>
          )}
          {(experiment.state === 'running' || experiment.state === 'running_not_full_on' || experiment.status === 'running') && (
            <Button 
              onClick={() => onStop(experiment.id)}
              variant="danger"
              size="sm"
              disabled={loading}
            >
              <StopIcon className="h-4 w-4 mr-1" />
              Stop Experiment
            </Button>
          )}
        </div>
      </div>
      

    </div>
  )
}
