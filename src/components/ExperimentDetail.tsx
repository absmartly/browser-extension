import React, { useState, useEffect, useRef } from 'react'
import { Storage } from '@plasmohq/storage'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'
import { Input } from './ui/Input'
import type { Experiment, ABSmartlyConfig } from '~src/types/absmartly'
import type { DOMChange } from '~src/types/dom-changes'
import { ArrowLeftIcon, PlayIcon, StopIcon, PencilIcon, CheckIcon, XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { DOMChangesInlineEditor } from './DOMChangesInlineEditor'
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

interface VariantData {
  variables: Record<string, any>
  dom_changes: DOMChange[]
}

export function ExperimentDetail({ 
  experiment, 
  onBack, 
  onStart, 
  onStop,
  onUpdate,
  loading 
}: ExperimentDetailProps) {
  console.log('🔍 ExperimentDetail render start - experiment:', experiment)
  console.log('🔍 ExperimentDetail render start - experiment.variants:', experiment?.variants)
  console.log('🔍 ExperimentDetail render start - loading:', loading)

  // Always in edit mode - removed isEditing state
  const [editingName, setEditingName] = useState(false)
  const [displayName, setDisplayName] = useState(experiment.display_name || experiment.name)
  const [variantData, setVariantData] = useState<Record<string, VariantData>>({})
  const [previewEnabled, setPreviewEnabled] = useState(false)
  const [activePreviewVariant, setActivePreviewVariant] = useState<string | null>(null)
  const [isLoadingFullData, setIsLoadingFullData] = useState(false)
  const lastExperimentIdRef = useRef<number | null>(null)

  console.log('🔍 ExperimentDetail state - variantData:', variantData)
  console.log('🔍 ExperimentDetail state - displayName:', displayName)
  console.log('🔍 ExperimentDetail state - variants length:', experiment?.variants?.length)
  console.log('🔍 ExperimentDetail state - should show variants section:', experiment.variants && experiment.variants.length > 0)

  // Effect to restore saved variant data on mount
  useEffect(() => {
    const restoreData = async () => {
      const storageKey = `experiment-${experiment.id}-variants`
      try {
        const savedData = await storage.get(storageKey)
        if (savedData) {
          console.log('📦 Restoring saved variant data for experiment', experiment.id)
          setVariantData(savedData)
        }
      } catch (error) {
        console.error('Failed to restore variant data:', error)
      }
    }
    restoreData()
  }, [experiment.id])

  // Effect to handle experiment data changes and variant parsing
  useEffect(() => {
    const currentExperimentId = experiment.id
    const currentVariants = experiment.variants || []
    
    // Check if this is a new experiment
    const isNewExperiment = lastExperimentIdRef.current !== currentExperimentId
    
    console.log('🔄 useEffect triggered for experiment', currentExperimentId, {
      isNewExperiment,
      lastExperimentId: lastExperimentIdRef.current,
      currentVariantsLength: currentVariants.length,
      existingVariantDataKeys: Object.keys(variantData)
    })
    
    if (isNewExperiment) {
      // New experiment - always update the ref immediately
      lastExperimentIdRef.current = currentExperimentId
      
      // Clear existing data to prevent showing old experiment's data
      console.log('🔄 New experiment detected, clearing variant data')
      setVariantData({})
      
      // If we have variants, parse and set them
      if (currentVariants.length > 0) {
        const data: Record<string, VariantData> = {}
        
        currentVariants.forEach((variant) => {
          const variantKey = variant.name || `Variant ${variant.variant}`
          data[variantKey] = parseVariantConfig(variant, variantKey)
        })
        
        console.log('✅ Setting variant data for new experiment', currentExperimentId, ':', data)
        setVariantData(data)
      } else {
        console.log('⚠️ New experiment has no variants yet')
      }
    } else {
      // Same experiment - check if variants were added/updated
      if (currentVariants.length > 0 && Object.keys(variantData).length === 0) {
        // Variants just loaded for current experiment
        const data: Record<string, VariantData> = {}
        
        currentVariants.forEach((variant) => {
          const variantKey = variant.name || `Variant ${variant.variant}`
          data[variantKey] = parseVariantConfig(variant, variantKey)
        })
        
        console.log('✅ Setting variant data for current experiment', currentExperimentId, ':', data)
        setVariantData(data)
      } else if (currentVariants.length > 0) {
        // Update existing variant data while preserving user edits
        setVariantData(prev => {
          const updated = { ...prev }
          let hasChanges = false
          
          currentVariants.forEach((variant) => {
            const variantKey = variant.name || `Variant ${variant.variant}`
            
            // Only update if we don't have this variant yet, or if the config has changed
            if (!updated[variantKey] || shouldUpdateVariantConfig(variant, updated[variantKey])) {
              updated[variantKey] = parseVariantConfig(variant, variantKey)
              hasChanges = true
            }
          })
          
          if (hasChanges) {
            console.log('🔄 Updated variant data with new configs')
            return updated
          }
          
          return prev
        })
      }
    }
  }, [experiment.id, experiment.variants]) // Only re-run when ID or variants change
  
  // Helper function to parse variant configuration safely
  const parseVariantConfig = (variant: any, variantKey: string): VariantData => {
    try {
      // Check if variant has config data
      if (variant.config !== undefined && variant.config !== null) {
        let config = {}
        
        // Safe JSON parsing with validation
        if (typeof variant.config === 'string') {
          try {
            config = JSON.parse(variant.config)
          } catch (parseError) {
            console.warn('Invalid JSON in variant config for', variantKey, ':', parseError)
            config = {}
          }
        } else if (typeof variant.config === 'object') {
          config = variant.config
        }
        
        // Ensure config is an object
        if (!config || typeof config !== 'object') {
          config = {}
        }
        
        const { dom_changes, ...variables } = config
        
        // Validate dom_changes is an array
        const validDomChanges = Array.isArray(dom_changes) ? dom_changes : []
        
        // Ensure variables is an object
        const validVariables = variables && typeof variables === 'object' ? variables : {}
        
        return {
          variables: validVariables,
          dom_changes: validDomChanges
        }
      } else {
        // No config data yet (minimal cache), initialize empty
        return {
          variables: {},
          dom_changes: []
        }
      }
    } catch (e) {
      console.error('Failed to parse variant config for', variantKey, ':', e, 'config:', variant.config)
      // Always provide fallback data to prevent UI breaks
      return {
        variables: {},
        dom_changes: []
      }
    }
  }
  
  // Helper function to determine if variant config should be updated
  const shouldUpdateVariantConfig = (variant: any, existingData: VariantData): boolean => {
    // If variant has no config, don't overwrite existing data (preserve user edits)
    if (!variant.config) return false
    
    try {
      const newConfig = typeof variant.config === 'string' 
        ? JSON.parse(variant.config) 
        : variant.config
      
      // Simple check - if existing data is empty, update it
      const hasExistingVariables = Object.keys(existingData.variables).length > 0
      const hasExistingDomChanges = existingData.dom_changes.length > 0
      
      return !hasExistingVariables && !hasExistingDomChanges
    } catch {
      return false
    }
  }

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

  const handleDOMChangesUpdate = (variantName: string, changes: DOMChange[]) => {
    setVariantData(prev => {
      const updated = {
        ...prev,
        [variantName]: {
          ...prev[variantName],
          dom_changes: changes
        }
      }
      
      // Save to storage
      const storageKey = `experiment-${experiment.id}-variants`
      storage.set(storageKey, updated).catch(error => {
        console.error('Failed to save variant data:', error)
      })
      
      return updated
    })
  }

  const handleVariableUpdate = (variantName: string, key: string, value: string) => {
    setVariantData(prev => {
      const updated = {
        ...prev,
        [variantName]: {
          ...prev[variantName],
          variables: {
            ...prev[variantName].variables,
            [key]: value
          }
        }
      }
      
      // Save to storage
      const storageKey = `experiment-${experiment.id}-variants`
      storage.set(storageKey, updated).catch(error => {
        console.error('Failed to save variant data:', error)
      })
      
      return updated
    })
  }

  const handleAddVariable = (variantName: string) => {
    const key = prompt('Enter variable name:')
    if (key) {
      handleVariableUpdate(variantName, key, '')
    }
  }

  const handleDeleteVariable = (variantName: string, key: string) => {
    setVariantData(prev => {
      const newData = { ...prev }
      delete newData[variantName].variables[key]
      
      // Save to storage
      const storageKey = `experiment-${experiment.id}-variants`
      storage.set(storageKey, newData).catch(error => {
        console.error('Failed to save variant data:', error)
      })
      
      return newData
    })
  }

  const handleSaveChanges = async () => {
    if (!onUpdate) return
    
    try {
      // Get the configuration to check storage settings
      const config = await getConfig()
      const storageType = config?.domChangesStorageType || 'variable'
      const fieldName = config?.domChangesFieldName || 'dom_changes'
      
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
      Object.keys(variantData).forEach((variantKey) => {
        const data = variantData[variantKey]
        if (data.dom_changes && data.dom_changes.length > 0) {
          domChangesPayload[variantKey] = data.dom_changes
        }
      })
      
      // Create updated variants
      const updatedVariants = Object.keys(variantData).map((variantKey, index) => {
        const data = variantData[variantKey]
        
        // Find the existing experiment variant
        const existingVariant = fullExperiment.variants?.find((v: any) => {
          const expVariantKey = v.name || `Variant ${v.variant}`
          return expVariantKey === variantKey
        })
        
        let config = { ...data.variables }
        
        // Add DOM changes to variant config if using variable storage
        if (storageType === 'variable') {
          config[fieldName] = data.dom_changes || []
        }
        
        // Return clean variant object without nested data
        return {
          variant: existingVariant?.variant ?? index,
          name: variantKey,
          config: JSON.stringify(config)
        }
      })
      
      // Create PUT payload with correct structure: id, version, data at root level
      const putPayload: any = {
        id: fullExperiment.id,
        version: fullExperiment.version || 0,
        data: {
          state: fullExperiment.state,
          name: fullExperiment.name,
          display_name: displayName,
          iteration: fullExperiment.iteration,
          percentage_of_traffic: fullExperiment.percentage_of_traffic,
          unit_type: fullExperiment.unit_type ? { unit_type_id: fullExperiment.unit_type.unit_type_id || fullExperiment.unit_type.id } : undefined,
          nr_variants: updatedVariants.length,
          percentages: fullExperiment.percentages,
          audience: fullExperiment.audience,
          audience_strict: fullExperiment.audience_strict,
          owners: fullExperiment.owners?.map((o: any) => ({ user_id: o.user_id || o.user?.id || o.id })) || [],
          teams: fullExperiment.teams?.map((t: any) => ({ team_id: t.team_id || t.id })) || [],
          experiment_tags: fullExperiment.experiment_tags || [],
          applications: fullExperiment.applications?.map((app: any) => ({
            application_id: app.application_id || app.id,
            application_version: app.application_version || "0"
          })) || [],
          primary_metric: fullExperiment.primary_metric ? { metric_id: fullExperiment.primary_metric.metric_id || fullExperiment.primary_metric.id } : undefined,
          secondary_metrics: fullExperiment.secondary_metrics?.map((m: any) => ({
            metric_id: m.metric_id || m.metric?.id || m.id,
            type: "secondary",
            order_index: m.order_index || 0
          })) || [],
          variants: updatedVariants,
          variant_screenshots: fullExperiment.variant_screenshots || [],
          custom_section_field_values: [],
          parent_experiment: fullExperiment.parent_experiment || null,
          template_permission: fullExperiment.template_permission || {},
          template_name: fullExperiment.template_name || fullExperiment.name,
          template_description: fullExperiment.template_description || "",
          type: fullExperiment.type || "test",
          analysis_type: fullExperiment.analysis_type || "group_sequential",
          baseline_participants_per_day: fullExperiment.baseline_participants_per_day,
          required_alpha: fullExperiment.required_alpha,
          required_power: fullExperiment.required_power,
          group_sequential_futility_type: fullExperiment.group_sequential_futility_type,
          group_sequential_analysis_count: fullExperiment.group_sequential_analysis_count,
          group_sequential_min_analysis_interval: fullExperiment.group_sequential_min_analysis_interval,
          group_sequential_first_analysis_interval: fullExperiment.group_sequential_first_analysis_interval,
          minimum_detectable_effect: fullExperiment.minimum_detectable_effect,
          group_sequential_max_duration_interval: fullExperiment.group_sequential_max_duration_interval
        }
      }
      
      // Convert custom_section_field_values to array format for PUT request
      if (fullExperiment.custom_section_field_values) {
        const customFieldsArray: any[] = []
        
        // Handle both object and array formats from GET response
        const fieldsArray = Array.isArray(fullExperiment.custom_section_field_values) 
          ? fullExperiment.custom_section_field_values
          : Object.values(fullExperiment.custom_section_field_values)
        
        fieldsArray.forEach((field: any) => {
          const fieldId = field.experiment_custom_section_field_id || field.custom_section_field?.id || field.id
          
          // Update DOM changes field if using custom_field storage
          if (storageType === 'custom_field' && 
              field.custom_section_field?.sdk_field_name === fieldName) {
            customFieldsArray.push({
              experiment_custom_section_field_id: fieldId,
              value: JSON.stringify(domChangesPayload)
            })
          } else {
            // Keep other fields with simplified format (only id and value)
            customFieldsArray.push({
              experiment_custom_section_field_id: fieldId,
              value: field.value
            })
          }
        })
        
        putPayload.data.custom_section_field_values = customFieldsArray
      }
      
      // Send the complete PUT payload (including id, version, data at root level)
      onUpdate(experiment.id, putPayload)
      
    } catch (error) {
      console.error('Failed to save changes:', error)
      alert('Failed to save changes: ' + error.message)
    }
  }

  const handlePreviewToggle = (enabled: boolean) => {
    setPreviewEnabled(enabled)
    if (enabled && activePreviewVariant) {
      // Send preview message through content script to SDK
      const changes = variantData[activePreviewVariant]?.dom_changes || []
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          // First inject the content script if needed
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content.js']
          }).then(() => {
            // Then send the preview message
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'ABSMARTLY_PREVIEW',
              action: 'apply',
              changes: changes.filter(c => c.enabled !== false)
            })
          }).catch(error => {
            console.error('Error injecting content script:', error)
            // Try sending anyway in case it's already injected
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'ABSMARTLY_PREVIEW',
              action: 'apply',
              changes: changes.filter(c => c.enabled !== false)
            })
          })
        }
      })
    } else if (!enabled) {
      // Remove preview
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'ABSMARTLY_PREVIEW',
            action: 'remove'
          })
        }
      })
    }
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to experiments
        </button>
        {loading && (
          <div className="flex items-center text-sm text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            Loading full data...
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Header Section */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            {editingName ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="text-lg font-semibold"
                  autoFocus
                />
                <button
                  onClick={handleSaveDisplayName}
                  className="p-1 text-green-600 hover:text-green-800"
                >
                  <CheckIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => {
                    setDisplayName(experiment.display_name || experiment.name)
                    setEditingName(false)
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-gray-900">{displayName}</h2>
                <button
                  onClick={() => setEditingName(true)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getStatusVariant(experiment.state || experiment.status || 'created')}>
              {experiment.state || experiment.status || 'created'}
            </Badge>
            {(experiment.percentage_of_traffic !== undefined ? experiment.percentage_of_traffic : experiment.traffic_split) && (
              <span className="text-sm text-gray-500">
                {experiment.percentage_of_traffic !== undefined ? experiment.percentage_of_traffic : experiment.traffic_split}% traffic
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">ID: {experiment.id} | Name: {experiment.name}</p>
        </div>

        {/* Variants Section - Show if we have any variant data to display */}
        {Object.keys(variantData).length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">Variants</h3>
            </div>
            {Object.keys(variantData).map((variantKey, index) => {
              const data = variantData[variantKey]
              
              // Find the corresponding experiment variant for additional metadata
              const experimentVariant = experiment.variants?.find(v => {
                const expVariantKey = v.name || `Variant ${v.variant}`
                return expVariantKey === variantKey
              })
              
              console.log('🔍 Rendering variant:', {
                variantKey,
                hasData: !!data,
                variablesCount: Object.keys(data.variables).length,
                domChangesCount: data.dom_changes.length,
                hasExperimentVariant: !!experimentVariant
              })
              
              return (
                <div key={variantKey} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900">
                      {variantKey}
                      {(experimentVariant?.is_control || experimentVariant?.variant === 0 || index === 0) && (
                        <span className="ml-2 text-xs text-gray-500">(Control)</span>
                      )}
                    </h4>
                  </div>

                  {/* Variables Section */}
                  <div className="space-y-3">
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Variables</h5>
                      <div className="space-y-2">
                        {Object.entries(data.variables).map(([key, value]) => (
                          <div key={key} className="flex items-center gap-2">
                            <Input
                              value={key}
                              disabled
                              className="flex-1 text-sm"
                            />
                            <Input
                              value={typeof value === 'object' ? JSON.stringify(value) : value}
                              onChange={(e) => handleVariableUpdate(variantKey, key, e.target.value)}
                              className="flex-1 text-sm"
                            />
                            <button
                              onClick={() => handleDeleteVariable(variantKey, key)}
                              className="p-1 text-red-600 hover:text-red-800"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        <Button
                          onClick={() => handleAddVariable(variantKey)}
                          size="sm"
                          variant="secondary"
                          className="w-full"
                        >
                          Add Variable
                        </Button>
                      </div>
                    </div>

                    {/* DOM Changes Section */}
                    <DOMChangesInlineEditor
                      variantName={variantKey}
                      changes={data.dom_changes}
                      onChange={(changes) => handleDOMChangesUpdate(variantKey, changes)}
                      previewEnabled={previewEnabled && activePreviewVariant === variantKey}
                      onPreviewToggle={(enabled) => {
                        setActivePreviewVariant(variantKey)
                        handlePreviewToggle(enabled)
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Applications */}
        {experiment.applications && experiment.applications.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700">Applications</h3>
            <div className="flex flex-wrap gap-2">
              {experiment.applications.map((app) => (
                <Badge key={app.application_id ?? app.id} variant="info">
                  {app.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-4 flex gap-2">
          <Button 
            onClick={handleSaveChanges}
            variant="primary"
            size="sm"
            disabled={loading}
          >
            Save Changes
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