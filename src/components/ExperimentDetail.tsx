import React, { useState, useEffect, useRef } from 'react'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'

import { Storage } from '@plasmohq/storage'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'
import { Input } from './ui/Input'
import type { Experiment, ABsmartlyConfig } from '~src/types/absmartly'
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
  debugLog('🔍 ExperimentDetail render start - experiment:', experiment)
  debugLog('🔍 ExperimentDetail render start - experiment.variants:', experiment?.variants)
  debugLog('🔍 ExperimentDetail render start - loading:', loading)

  // Always in edit mode - removed isEditing state
  const [editingName, setEditingName] = useState(false)
  const [displayName, setDisplayName] = useState(experiment.display_name || experiment.name)
  const [variantData, setVariantData] = useState<Record<string, VariantData>>({})
  const [previewEnabled, setPreviewEnabled] = useState(false)
  const [activePreviewVariant, setActivePreviewVariant] = useState<string | null>(null)
  const [isLoadingFullData, setIsLoadingFullData] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const lastExperimentIdRef = useRef<number | null>(null)

  debugLog('🔍 ExperimentDetail state - variantData:', variantData)
  debugLog('🔍 ExperimentDetail state - displayName:', displayName)
  debugLog('🔍 ExperimentDetail state - variants length:', experiment?.variants?.length)
  debugLog('🔍 ExperimentDetail state - should show variants section:', experiment.variants && experiment.variants.length > 0)

  // Effect to restore saved variant data on mount
  useEffect(() => {
    const restoreData = async () => {
      const storageKey = `experiment-${experiment.id}-variants`
      try {
        const savedData = await storage.get(storageKey)
        if (savedData) {
          debugLog('📦 Restoring saved variant data for experiment', experiment.id)
          setVariantData(savedData)
        }
      } catch (error) {
        debugError('Failed to restore variant data:', error)
      }
    }
    restoreData()
  }, [experiment.id])
  
  // Effect to cleanup preview when component unmounts or experiment changes
  useEffect(() => {
    // Store the current experiment ID for cleanup
    const currentExperimentId = experiment.id
    
    // Cleanup function runs when component unmounts or experiment.id changes
    return () => {
      debugLog('🧹 Component unmounting or experiment changing, cleaning up DOM changes and preview')
      
      // Always discard unsaved DOM changes when leaving the page (unless saved)
      // Use the captured experiment ID to ensure we clear the right storage key
      const storageKey = `experiment-${currentExperimentId}-variants`
      debugLog('🧹 Clearing storage for experiment', currentExperimentId, 'with key:', storageKey)
      
      storage.remove(storageKey).then(() => {
        debugLog('✅ Successfully cleared variant data from storage for experiment', currentExperimentId)
      }).catch(error => {
        debugError('❌ Failed to clear variant data from storage:', error)
      })
      
      // Clear stored DOM changes to prevent leaking between experiments
      chrome.runtime.sendMessage({
        type: 'CLEAR_STORED_DOM_CHANGES'
      }, (response) => {
        debugLog('🧹 Cleared stored DOM changes:', response)
      })
      
      // Always send remove preview message when cleaning up
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'ABSMARTLY_PREVIEW',
            action: 'remove',
            experimentName: experiment.name
          }, (response) => {
            debugLog('🧹 Cleanup preview response:', response)
          })
        }
      })
    }
  }, [experiment.id]) // Only re-run when experiment ID changes

  // Effect to handle experiment data changes and variant parsing
  useEffect(() => {
    const currentExperimentId = experiment.id
    const currentVariants = experiment.variants || []
    
    // Check if this is a new experiment
    const isNewExperiment = lastExperimentIdRef.current !== currentExperimentId
    
    debugLog('🔄 useEffect triggered for experiment', currentExperimentId, {
      isNewExperiment,
      lastExperimentId: lastExperimentIdRef.current,
      currentVariantsLength: currentVariants.length,
      existingVariantDataKeys: Object.keys(variantData)
    })
    
    if (isNewExperiment) {
      // New experiment - always update the ref immediately
      lastExperimentIdRef.current = currentExperimentId
      
      // Clear existing data to prevent showing old experiment's data
      debugLog('🔄 New experiment detected, clearing variant data')
      setVariantData({})
      
      // If we have variants, parse and set them
      if (currentVariants.length > 0) {
        const data: Record<string, VariantData> = {}
        
        currentVariants.forEach((variant) => {
          const variantKey = variant.name || `Variant ${variant.variant}`
          data[variantKey] = parseVariantConfig(variant, variantKey)
        })
        
        // Load saved DOM changes from storage
        const storageKey = `experiment-${currentExperimentId}-variants`
        debugLog('🔍 Checking storage for key:', storageKey)
        
        storage.get(storageKey).then(savedData => {
          debugLog('🔍 Raw storage result:', savedData)
          
          if (savedData) {
            debugLog('📦 Found saved variant data in storage:', savedData)
            // Merge saved DOM changes with parsed config
            Object.keys(savedData).forEach(key => {
              if (data[key] && savedData[key].dom_changes) {
                // Use saved DOM changes as source of truth (they're the latest user edits)
                data[key].dom_changes = savedData[key].dom_changes
                debugLog(`Applied saved DOM changes for variant ${key}:`, savedData[key].dom_changes)
              }
              // Also preserve variables if they were edited
              if (data[key] && savedData[key].variables) {
                // Merge variables, preferring saved ones
                data[key].variables = { ...data[key].variables, ...savedData[key].variables }
              }
            })
          }
          debugLog('✅ Setting variant data for new experiment', currentExperimentId, ':', data)
          setVariantData(data)
        }).catch(error => {
          debugError('Failed to load saved variant data:', error)
          debugLog('✅ Setting variant data for new experiment', currentExperimentId, ':', data)
          setVariantData(data)
        })
      } else {
        debugLog('⚠️ New experiment has no variants yet')
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
        
        // Load saved DOM changes from storage
        const storageKey = `experiment-${currentExperimentId}-variants`
        storage.get(storageKey).then(savedData => {
          if (savedData) {
            debugLog('📦 Found saved variant data in storage (same experiment):', savedData)
            // Merge saved DOM changes with parsed config
            Object.keys(savedData).forEach(key => {
              if (data[key] && savedData[key].dom_changes) {
                // Use saved DOM changes as source of truth (they're the latest user edits)
                data[key].dom_changes = savedData[key].dom_changes
                debugLog(`Applied saved DOM changes for variant ${key}:`, savedData[key].dom_changes)
              }
              // Also preserve variables if they were edited
              if (data[key] && savedData[key].variables) {
                // Merge variables, preferring saved ones
                data[key].variables = { ...data[key].variables, ...savedData[key].variables }
              }
            })
          }
          debugLog('✅ Setting variant data for current experiment', currentExperimentId, ':', data)
          setVariantData(data)
        }).catch(error => {
          debugError('Failed to load saved variant data:', error)
          debugLog('✅ Setting variant data for current experiment', currentExperimentId, ':', data)
          setVariantData(data)
        })
      } else if (currentVariants.length > 0) {
        // Update existing variant data while preserving user edits
        setVariantData(prev => {
          const updated = { ...prev }
          let hasChanges = false
          
          currentVariants.forEach((variant) => {
            const variantKey = variant.name || `Variant ${variant.variant}`
            
            // Only update if we don't have this variant yet, or if the config has changed
            if (!updated[variantKey]) {
              // New variant, parse it
              updated[variantKey] = parseVariantConfig(variant, variantKey)
              hasChanges = true
            } else if (shouldUpdateVariantConfig(variant, updated[variantKey])) {
              // Update variant but preserve DOM changes if any
              const parsedConfig = parseVariantConfig(variant, variantKey)
              // Keep existing DOM changes if we have any
              if (updated[variantKey].dom_changes && updated[variantKey].dom_changes.length > 0) {
                parsedConfig.dom_changes = updated[variantKey].dom_changes
              }
              updated[variantKey] = parsedConfig
              hasChanges = true
            }
          })
          
          if (hasChanges) {
            debugLog('🔄 Updated variant data with new configs')
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
            debugWarn('Invalid JSON in variant config for', variantKey, ':', parseError)
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
      debugError('Failed to parse variant config for', variantKey, ':', e, 'config:', variant.config)
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
    debugLog('🔄 handleDOMChangesUpdate called:', { variantName, changes })
    debugLog('🔄 Current experiment ID:', experiment.id)
    
    setVariantData(prev => {
      debugLog('🔄 Previous variant data:', prev)
      
      const updated = {
        ...prev,
        [variantName]: {
          ...prev[variantName],
          dom_changes: changes
        }
      }
      
      debugLog('🔄 Updated variant data:', updated)
      
      // Mark as having unsaved changes
      setHasUnsavedChanges(true)
      
      // Save to storage
      const storageKey = `experiment-${experiment.id}-variants`
      debugLog('🔄 Saving to storage with key:', storageKey)
      
      storage.set(storageKey, updated).then(() => {
        debugLog('✅ Successfully saved variant data to storage')
      }).catch(error => {
        debugError('❌ Failed to save variant data:', error)
      })
      
      // If preview is currently enabled for this variant, re-apply with updated changes
      if (previewEnabled && activePreviewVariant === variantName) {
        debugLog('🔄 Re-applying preview with updated changes')
        const enabledChanges = changes.filter(c => c.enabled !== false)
        debugLog('🔄 Changes being sent:', {
          allChanges: changes,
          enabledChanges: enabledChanges,
          disabledChanges: changes.filter(c => c.enabled === false)
        })
        
        // First remove the current preview, then apply the new one
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            // Remove current preview
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'ABSMARTLY_PREVIEW',
              action: 'remove'
            }, () => {
              // Then apply new preview with only enabled changes
              setTimeout(() => {
                chrome.tabs.sendMessage(tabs[0].id, {
                  type: 'ABSMARTLY_PREVIEW',
                  action: 'apply',
                  changes: enabledChanges,
                  experimentName: experiment.name,
                  variantName: variantName
                }, (response) => {
                  if (chrome.runtime.lastError) {
                    debugError('Failed to re-apply preview:', chrome.runtime.lastError)
                  } else {
                    debugLog('Preview re-applied with enabled changes only:', {
                      enabledCount: enabledChanges.length,
                      totalCount: changes.length,
                      enabledChanges
                    })
                  }
                })
              }, 100) // Small delay to ensure removal completes
            })
          }
        })
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'ABSMARTLY_PREVIEW',
              action: 'apply',
              changes: enabledChanges,
              experimentName: experiment.name,
              variantName: variantName
            }, (response) => {
              if (chrome.runtime.lastError) {
                debugError('Failed to re-apply preview:', chrome.runtime.lastError)
              } else {
                debugLog('Preview re-applied with updated changes:', response)
              }
            })
          }
        })
      }
      
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
        debugError('Failed to save variant data:', error)
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
        debugError('Failed to save variant data:', error)
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
      // Version should be the updated_at timestamp converted to milliseconds
      const putPayload: any = {
        id: fullExperiment.id,
        version: new Date(fullExperiment.updated_at).getTime(),
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

  const handlePreviewToggleForVariant = (enabled: boolean, variantKey: string) => {
    debugLog('🎯 handlePreviewToggleForVariant called:', { enabled, variantKey, hasExperiment: !!experiment })
    setPreviewEnabled(enabled)
    if (enabled && variantKey && experiment) {
      // Send preview message through content script to SDK
      const changes = variantData[variantKey]?.dom_changes || []
      const variantName = experiment.variants?.find(v => v.name === variantKey)?.name || variantKey
      
      debugLog('🎯 Sending preview message:', {
        variantName,
        changesCount: changes.length,
        changes: changes,
        enabledChanges: changes.filter(c => c.enabled !== false)
      })
      
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          debugLog('🎯 Sending to tab:', tabs[0].id, tabs[0].url)
          // Content script is already injected by the manifest, just send the message
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'ABSMARTLY_PREVIEW',
            action: 'apply',
            changes: changes.filter(c => c.enabled !== false),
            experimentName: experiment.name,
            variantName: variantName,
            experimentId: experiment.id
          }, (response) => {
            if (chrome.runtime.lastError) {
              debugError('❌ Error sending preview message:', chrome.runtime.lastError)
            } else {
              debugLog('✅ Preview message sent, response:', response)
            }
          })
        } else {
          debugError('❌ No active tab found')
        }
      })
    } else if (!enabled) {
      debugLog('🎯 Removing preview')
      // Remove preview
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'ABSMARTLY_PREVIEW',
            action: 'remove',
            experimentName: experiment.name
          }, (response) => {
            debugLog('🎯 Remove preview response:', response)
          })
        }
      })
    }
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
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
          <div className="mb-2">
            {editingName ? (
              <div>
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
              <div className="flex items-center gap-2 flex-1">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-gray-900" title={`ID: ${experiment.id}`}>{displayName}</h2>
                  {displayName !== experiment.name && (
                    <p className="text-sm text-gray-500" title={`ID: ${experiment.id}`}>{experiment.name}</p>
                  )}
                </div>
                <button
                  onClick={() => setEditingName(true)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
              </div>
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
              
              debugLog('🔍 Rendering variant:', {
                variantKey,
                hasData: !!data,
                variablesCount: Object.keys(data.variables).length,
                domChangesCount: data.dom_changes.length,
                hasExperimentVariant: !!experimentVariant
              })
              
              return (
                <div key={variantKey} className="border border-gray-200 rounded-lg p-4">
                  <div className="mb-3">
                    <Input
                        value={variantKey}
                        onChange={(e) => {
                          const newName = e.target.value
                          if (newName && newName !== variantKey) {
                            // Update the variant name in variantData
                            setVariantData(prev => {
                              const newData = { ...prev }
                              // Copy data from old key to new key
                              newData[newName] = { ...prev[variantKey] }
                              // Delete old key
                              delete newData[variantKey]
                              
                              // Save to storage
                              const storageKey = `experiment-${experiment.id}-variants`
                              storage.set(storageKey, newData).catch(error => {
                                debugError('Failed to save variant data:', error)
                              })
                              
                              return newData
                            })
                          }
                        }}
                        placeholder="Variant name"
                        className="font-medium w-full"
                      />
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
                        // Use the variantKey directly instead of waiting for state update
                        handlePreviewToggleForVariant(enabled, variantKey)
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
                <span 
                  key={app.application_id ?? app.id} 
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 cursor-default"
                  title={app.application?.description || app.description || ''}
                >
                  {app.application?.name || app.name || `App ${app.application_id || app.id}`}
                </span>
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
