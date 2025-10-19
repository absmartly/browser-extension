import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { debugLog, debugError } from '~src/utils/debug'
import { Storage } from '@plasmohq/storage'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { PlusIcon, TrashIcon, CodeBracketIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { DOMChangesInlineEditor } from './DOMChangesInlineEditor'
import { VariantConfigJSONEditor } from './VariantConfigJSONEditor'
import { DOMChangeOptions } from './DOMChangeOptions'
import type { DOMChange, DOMChangesData, DOMChangesConfig, URLFilter } from '~src/types/dom-changes'

const storage = new Storage({ area: "local" })

export type VariantConfig = Record<string, unknown>

export interface Variant {
  name: string
  config: VariantConfig  // Full variables payload including __dom_changes, __inject_html, etc.
}

// Helper to get DOM changes from config
function getDOMChangesFromConfig(config: VariantConfig | undefined, domFieldName: string = '__dom_changes'): DOMChangesData {
  if (!config) return { changes: [] }
  const domData = config[domFieldName]
  if (!domData) return { changes: [] }
  // Handle both legacy array and new config format
  if (Array.isArray(domData)) return { changes: domData }
  return domData
}

// Helper to update config with DOM changes
function setDOMChangesInConfig(config: VariantConfig, domChanges: DOMChangesData, domFieldName: string = '__dom_changes'): VariantConfig {
  const newConfig = { ...config }
  // Only include DOM changes if not empty
  if (Array.isArray(domChanges.changes) && domChanges.changes.length > 0) {
    newConfig[domFieldName] = domChanges
  } else if (!Array.isArray(domChanges.changes)) {
    // If it's already an object with changes, include it
    newConfig[domFieldName] = domChanges
  } else {
    // Remove if empty
    delete newConfig[domFieldName]
  }
  return newConfig
}

// Helper to filter out special fields for Variables display
function getVariablesForDisplay(config: VariantConfig, domFieldName: string, fieldsToExclude: string[] = ['__inject_html']): VariantConfig {
  const filtered = { ...config }
  // Add the configurable DOM field name to exclusions
  const allExclusions = [...fieldsToExclude, domFieldName]
  allExclusions.forEach(field => delete filtered[field])
  return filtered
}

// Helper to get changes array from DOMChangesData
function getChangesArray(data: DOMChangesData): DOMChange[] {
  return Array.isArray(data) ? data : data.changes
}

// Helper to get config from DOMChangesData (or create default)
function getChangesConfig(data: DOMChangesData): DOMChangesConfig {
  if (Array.isArray(data)) {
    return { changes: data }
  }
  return data
}

interface VariantListProps {
  // Initial variants from parent (experiment data)
  initialVariants: Variant[]
  // Experiment context
  experimentId: number
  experimentName: string
  // Callback when variants change (for parent to know when to enable save)
  onVariantsChange: (variants: Variant[], hasChanges: boolean) => void
  // Can edit (read-only mode for running experiments)
  canEdit?: boolean
  // Can add/remove variants (disabled for running experiments)
  canAddRemove?: boolean
  // DOM changes field name from config (required)
  domFieldName: string
}

export function VariantList({
  initialVariants,
  experimentId,
  experimentName,
  onVariantsChange,
  canEdit = true,
  canAddRemove = true,
  domFieldName
}: VariantListProps) {
  const [variants, setVariants] = useState<Variant[]>(initialVariants)
  const [previewEnabled, setPreviewEnabled] = useState(false)
  const [activePreviewVariant, setActivePreviewVariant] = useState<number | null>(null)
  const [activeVEVariant, setActiveVEVariant] = useState<string | null>(null)
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false)
  const [jsonEditorVariant, setJsonEditorVariant] = useState<number | null>(null)
  const [addingVariableForVariant, setAddingVariableForVariant] = useState<number | null>(null)
  const [newVariableName, setNewVariableName] = useState('')
  const [newVariableValue, setNewVariableValue] = useState('')
  const [expandedVariants, setExpandedVariants] = useState<Set<number>>(() => {
    // Keep Control variant (index 0) collapsed by default, expand all others
    const expanded = new Set<number>()
    for (let i = 1; i < initialVariants.length; i++) {
      expanded.add(i)
    }
    return expanded
  })
  const newVarNameInputRef = useRef<HTMLInputElement>(null)
  const newVarValueInputRef = useRef<HTMLInputElement>(null)
  const justUpdatedRef = useRef(false)

  // Reset flag on mount (clean slate for each experiment)
  useEffect(() => {
    justUpdatedRef.current = false
  }, [experimentId])

  // Load saved changes from storage on mount ONLY if not already provided by parent
  useEffect(() => {
    const loadSavedChanges = async () => {
      // If parent already provided initialVariants, check storage for changes
      if (initialVariants.length > 0) {
        const storageKey = `experiment-${experimentId}-variants`
        try {
          const savedVariants = await storage.get(storageKey)
          if (savedVariants && Array.isArray(savedVariants)) {
            // Compare saved variants with initial variants to detect actual changes
            const hasActualChanges = JSON.stringify(savedVariants) !== JSON.stringify(initialVariants)

            if (hasActualChanges) {
              setVariants(savedVariants)
              justUpdatedRef.current = true // Set flag before calling onChange
              onVariantsChange(savedVariants, true)
            }
          }
        } catch (error) {
          debugError('Failed to load saved variants:', error)
        }
        return
      }

      // Legacy path: no initial variants provided, try loading from storage
      const storageKey = `experiment-${experimentId}-variants`
      try {
        const savedVariants = await storage.get(storageKey)
        if (savedVariants && Array.isArray(savedVariants)) {
          setVariants(savedVariants)
          // Notify parent that we have unsaved changes
          justUpdatedRef.current = true
          onVariantsChange(savedVariants, true)
        }
      } catch (error) {
        debugError('Failed to load saved variants:', error)
      }
    }
    loadSavedChanges()
  }, [experimentId, initialVariants.length])

  // Sync with parent when initialVariants change
  // This ensures we always have the latest data from parent (e.g., when __inject_html changes)
  useEffect(() => {
    // Skip sync if this update came from our own onChange call
    // This prevents a feedback loop where adding a variable causes us to overwrite it
    if (justUpdatedRef.current) {
      // IMPORTANT: Reset immediately so next sync can proceed
      justUpdatedRef.current = false
      return
    }

    // Sync from parent (for external updates like __inject_html edits)
    setVariants(initialVariants)
    // DON'T save to storage here - only save when user makes actual changes
    // This prevents false "unsaved changes" warnings
  }, [initialVariants, experimentId])

  // Cleanup storage and preview on unmount
  useEffect(() => {
    return () => {
      // Clear preview
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'ABSMARTLY_PREVIEW',
            action: 'remove',
            experimentName: experimentName
          })
        }
      })
    }
  }, [experimentName])

  // Listen for preview state changes from background script
  useEffect(() => {
    const handleMessage = (message: unknown) => {
      if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'PREVIEW_STATE_CHANGED' && 'enabled' in message && message.enabled === false) {
        // Turn off preview when Exit Preview button is clicked
        setPreviewEnabled(false)
        setActivePreviewVariant(null)
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [])

  const saveToStorage = (updatedVariants: Variant[]) => {
    const storageKey = `experiment-${experimentId}-variants`
    storage.set(storageKey, updatedVariants).catch(error => {
      debugError('Failed to save variants to storage:', error)
    })
  }

  const updateVariants = (updatedVariants: Variant[]) => {
    setVariants(updatedVariants)
    saveToStorage(updatedVariants)
    justUpdatedRef.current = true // Mark that we're updating (will be reset by sync useEffect)
    onVariantsChange(updatedVariants, true) // true = has unsaved changes
  }

  const addVariant = () => {
    const newVariants = [
      ...variants,
      {
        name: `Variant ${variants.length}`,
        config: {} // Empty config for new variants
      }
    ]
    updateVariants(newVariants)
  }

  const removeVariant = (index: number) => {
    const newVariants = variants.filter((_, i) => i !== index)
    updateVariants(newVariants)
  }

  const updateVariantName = (index: number, name: string) => {
    const newVariants = [...variants]
    newVariants[index] = { ...newVariants[index], name }
    updateVariants(newVariants)
  }

  const updateVariantDOMChanges = (index: number, changes: DOMChange[], options?: { isReorder?: boolean }) => {
    const newVariants = [...variants]
    const domChangesData = getDOMChangesFromConfig(newVariants[index].config, domFieldName)

    // Always preserve URL filter and global defaults from the config
    const currentConfig = getChangesConfig(domChangesData)
    const updatedDOMChanges: DOMChangesData = {
      ...currentConfig,
      changes
    }

    newVariants[index] = {
      ...newVariants[index],
      config: setDOMChangesInConfig(newVariants[index].config, updatedDOMChanges, domFieldName)
    }

    updateVariants(newVariants)

    // Re-apply preview if active for this variant (but not for reorders)
    if (previewEnabled && activePreviewVariant === index && !options?.isReorder) {
      const enabledChanges = changes.filter(c => c.enabled !== false)
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'ABSMARTLY_PREVIEW',
            action: 'update',
            changes: enabledChanges,
            experimentName: experimentName,
            variantName: newVariants[index].name
          })
        }
      })
    }
  }

  const updateVariantDOMConfig = (index: number, configUpdate: Partial<Omit<DOMChangesConfig, 'changes'>>) => {
    const newVariants = [...variants]
    const domChangesData = getDOMChangesFromConfig(newVariants[index].config, domFieldName)
    const currentDOMConfig = getChangesConfig(domChangesData)

    const updatedDOMChanges: DOMChangesData = {
      ...currentDOMConfig,
      ...configUpdate
    }

    newVariants[index] = {
      ...newVariants[index],
      config: setDOMChangesInConfig(newVariants[index].config, updatedDOMChanges, domFieldName)
    }

    updateVariants(newVariants)
  }

  const addVariantVariable = (index: number) => {
    setAddingVariableForVariant(index)
    setNewVariableName('')
    setNewVariableValue('')
    // Focus the input after state update
    setTimeout(() => {
      newVarNameInputRef.current?.focus()
    }, 0)
  }

  const saveNewVariable = (index: number) => {
    let key = newVariableName.trim()
    let value = newVariableValue

    // FALLBACK: If state is empty, read directly from input refs
    // This handles cases where React state hasn't updated yet (e.g., in E2E tests)
    if (!key && newVarNameInputRef.current) {
      key = newVarNameInputRef.current.value.trim()
      debugLog('📝 Read key from ref:', key)
    }
    if (!value && newVarValueInputRef.current) {
      value = newVarValueInputRef.current.value
      debugLog('📝 Read value from ref:', value)
    }

    if (!key) {
      return
    }

    const newVariants = [...variants]
    let parsedValue: unknown = value
    try {
      // Try to parse as JSON if it looks like JSON
      if (value && (value.startsWith('{') || value.startsWith('['))) {
        parsedValue = JSON.parse(value)
      }
    } catch {
      // Keep as string if parsing fails
    }

    newVariants[index] = {
      ...newVariants[index],
      config: { ...newVariants[index].config, [key]: parsedValue }
    }
    updateVariants(newVariants)
    setAddingVariableForVariant(null)
    setNewVariableName('')
    setNewVariableValue('')
  }

  const cancelNewVariable = () => {
    setAddingVariableForVariant(null)
    setNewVariableName('')
    setNewVariableValue('')
  }

  const updateVariantVariable = (index: number, key: string, value: string) => {
    const newVariants = [...variants]
    let parsedValue: unknown = value
    try {
      // Try to parse as JSON if it looks like JSON
      if (value.startsWith('{') || value.startsWith('[')) {
        parsedValue = JSON.parse(value)
      }
    } catch {
      // Keep as string if parsing fails
    }
    newVariants[index] = {
      ...newVariants[index],
      config: { ...newVariants[index].config, [key]: parsedValue }
    }
    updateVariants(newVariants)
  }

  const deleteVariantVariable = (index: number, key: string) => {
    const newVariants = [...variants]
    const newConfig = { ...newVariants[index].config }
    delete newConfig[key]
    newVariants[index] = { ...newVariants[index], config: newConfig }
    updateVariants(newVariants)
  }

  const handlePreviewToggle = useCallback((enabled: boolean, variantIndex: number) => {
    setPreviewEnabled(enabled)
    setActivePreviewVariant(enabled ? variantIndex : null)

    if (enabled && variants[variantIndex]) {
      const domChangesData = getDOMChangesFromConfig(variants[variantIndex].config, domFieldName)
      const changes = getChangesArray(domChangesData)
      const variantName = variants[variantIndex].name

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'ABSMARTLY_PREVIEW',
            action: 'apply',
            changes: changes.filter(c => c.enabled !== false),
            experimentName: experimentName,
            variantName: variantName
          })
        }
      })
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'ABSMARTLY_PREVIEW',
            action: 'remove',
            experimentName: experimentName
          })
        }
      })
    }
  }, [variants, experimentName, domFieldName])

  // Pre-compute display variables for all variants to avoid repeated calculations in render
  const variantsDisplayVariables = useMemo(
    () => variants.map(variant => getVariablesForDisplay(variant.config, domFieldName)),
    [variants, domFieldName]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">Variants</h4>
        {canEdit && canAddRemove && (
          <Button
            type="button"
            onClick={addVariant}
            size="sm"
            variant="secondary"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Variant
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {variants.map((variant, index) => {
          const isExpanded = expandedVariants.has(index)
          const isControl = index === 0
          
          return (
          <div key={index} className={`border rounded-lg ${isControl ? 'border-gray-300 bg-gray-100' : 'border-gray-200'} ${isControl && !isExpanded ? 'opacity-60' : ''}`}>
            {/* Variant Header */}
            <div className="px-4 py-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const newExpanded = new Set(expandedVariants)
                  if (isExpanded) {
                    newExpanded.delete(index)
                  } else {
                    newExpanded.add(index)
                  }
                  setExpandedVariants(newExpanded)
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
              {isControl && (
                <span className="px-2 py-0.5 text-xs font-medium text-yellow-800 bg-yellow-200 rounded">
                  Control
                </span>
              )}
              <Input
                className="flex-1 font-medium"
                value={variant.name}
                onChange={(e) => updateVariantName(index, e.target.value)}
                placeholder={`Variant ${index}`}
                disabled={!canEdit}
              />
              <Button
                type="button"
                onClick={() => {
                  setJsonEditorVariant(index)
                  setJsonEditorOpen(true)
                }}
                size="sm"
                variant="secondary"
                title="View Full Variant Configuration"
              >
                <CodeBracketIcon className="h-4 w-4" />
                Json
              </Button>
              {canEdit && canAddRemove && variants.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeVariant(index)}
                  className="p-1 text-red-600 hover:text-red-800"
                  title="Delete variant"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Collapsible Content */}
            {isExpanded && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-200 pt-3">
              {/* Warning message for Control variant */}
              {isControl && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                  <svg className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="text-xs text-amber-800">
                    <strong>Warning:</strong> You are editing the Control variant. Changes here affect the baseline for comparison.
                  </div>
                </div>
              )}
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Variables</h5>
                <div className="space-y-2">
                  {Object.entries(variantsDisplayVariables[index]).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <Input
                        value={key}
                        disabled
                        className="flex-1 text-sm"
                      />
                      <Input
                        value={typeof value === 'object' ? JSON.stringify(value) : value}
                        onChange={(e) => updateVariantVariable(index, key, e.target.value)}
                        className="flex-1 text-sm"
                        disabled={!canEdit}
                      />
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => deleteVariantVariable(index, key)}
                          className="p-1 text-red-600 hover:text-red-800"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {addingVariableForVariant === index && canEdit && (
                    <div className="flex items-center gap-2 bg-blue-50 p-2 rounded border border-blue-200">
                      <Input
                        ref={newVarNameInputRef}
                        value={newVariableName}
                        onChange={(e) => setNewVariableName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            saveNewVariable(index)
                          } else if (e.key === 'Escape') {
                            cancelNewVariable()
                          }
                        }}
                        placeholder="Variable name"
                        className="flex-1 text-sm"
                      />
                      <Input
                        ref={newVarValueInputRef}
                        value={newVariableValue}
                        onChange={(e) => setNewVariableValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            saveNewVariable(index)
                          } else if (e.key === 'Escape') {
                            cancelNewVariable()
                          }
                        }}
                        placeholder="Variable value"
                        className="flex-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => saveNewVariable(index)}
                        className="p-1 text-green-600 hover:text-green-800"
                        title="Save variable"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={cancelNewVariable}
                        className="p-1 text-red-600 hover:text-red-800"
                        title="Cancel"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  {canEdit && addingVariableForVariant !== index && (
                    <Button
                      type="button"
                      onClick={() => addVariantVariable(index)}
                      size="sm"
                      variant="secondary"
                      className="w-full"
                    >
                      Add Variable
                    </Button>
                  )}
                </div>
              </div>

              {/* URL Filter Section */}
              <URLFilterSection
                variantIndex={index}
                config={getChangesConfig(getDOMChangesFromConfig(variant.config, domFieldName))}
                onConfigChange={(config) => updateVariantDOMConfig(index, config)}
                canEdit={canEdit}
              />

              {/* Global Defaults Section */}
              <GlobalDefaultsSection
                config={getChangesConfig(getDOMChangesFromConfig(variant.config, domFieldName))}
                onConfigChange={(config) => updateVariantDOMConfig(index, config)}
                canEdit={canEdit}
              />

              {/* DOM Changes Section */}
              <DOMChangesInlineEditor
                variantName={variant.name}
                variantIndex={index}
                experimentName={experimentName}
                changes={getChangesArray(getDOMChangesFromConfig(variant.config, domFieldName))}
                onChange={(changes) => updateVariantDOMChanges(index, changes)}
                previewEnabled={previewEnabled && activePreviewVariant === index}
                onPreviewToggle={(enabled) => {
                  // Check if another variant has VE active
                  if (activeVEVariant && activeVEVariant !== variant.name) {
                    alert(`Visual Editor is active for variant "${activeVEVariant}". Please close it first.`)
                    return
                  }
                  handlePreviewToggle(enabled, index)
                }}
                activeVEVariant={activeVEVariant}
                onVEStart={() => setActiveVEVariant(variant.name)}
                onVEStop={() => setActiveVEVariant(null)}
                activePreviewVariantName={activePreviewVariant !== null ? variants[activePreviewVariant]?.name : null}
              />
            </div>
            )}
          </div>
        )
        })}
      </div>

      {/* Config Editor Modal */}
      {jsonEditorVariant !== null && (
        <VariantConfigJSONEditor
          isOpen={jsonEditorOpen}
          onClose={() => {
            setJsonEditorOpen(false)
            setJsonEditorVariant(null)
          }}
          variant={variants[jsonEditorVariant]}
          onSave={(updatedVariant) => {
            if (jsonEditorVariant !== null) {
              const newVariants = [...variants]
              newVariants[jsonEditorVariant] = updatedVariant
              updateVariants(newVariants)
            }
            setJsonEditorOpen(false)
            setJsonEditorVariant(null)
          }}
        />
      )}
    </div>
  )
}

// URL Filter Section Component
interface URLFilterSectionProps {
  variantIndex: number
  config: DOMChangesConfig
  onConfigChange: (config: Partial<Omit<DOMChangesConfig, 'changes'>>) => void
  canEdit: boolean
}

const URLFilterSection = React.memo(function URLFilterSection({ config, onConfigChange, canEdit }: URLFilterSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isFirstRenderRef = useRef(true)

  const [mode, setMode] = useState<'all' | 'simple' | 'advanced'>(() => {
    if (!config.urlFilter) return 'all'
    if (typeof config.urlFilter === 'string' || Array.isArray(config.urlFilter)) return 'simple'
    return 'advanced'
  })

  const [simplePatterns, setSimplePatterns] = useState<string[]>(() => {
    if (!config.urlFilter) return []
    if (typeof config.urlFilter === 'string') return [config.urlFilter]
    if (Array.isArray(config.urlFilter)) return config.urlFilter
    return config.urlFilter.include || []
  })

  const [excludePatterns, setExcludePatterns] = useState<string[]>(() => {
    if (!config.urlFilter || typeof config.urlFilter === 'string' || Array.isArray(config.urlFilter)) {
      return []
    }
    return config.urlFilter.exclude || []
  })

  const [regexMode, setRegexMode] = useState<boolean>(() => {
    if (!config.urlFilter || typeof config.urlFilter === 'string' || Array.isArray(config.urlFilter)) {
      return false
    }
    return config.urlFilter.mode === 'regex'
  })

  const [matchType, setMatchType] = useState<'full-url' | 'path' | 'domain' | 'query' | 'hash'>(() => {
    if (!config.urlFilter || typeof config.urlFilter === 'string' || Array.isArray(config.urlFilter)) {
      return 'path' // Default to path
    }
    return config.urlFilter.matchType || 'path'
  })

  const updateURLFilter = () => {
    if (mode === 'all') {
      onConfigChange({ urlFilter: undefined })
    } else if (mode === 'simple') {
      const filtered = simplePatterns.filter(p => p.trim())
      if (filtered.length === 0) {
        onConfigChange({ urlFilter: undefined })
      } else {
        // Always use config format for simple mode to include matchType
        onConfigChange({
          urlFilter: {
            include: filtered,
            mode: regexMode ? 'regex' : 'simple',
            matchType: matchType
          }
        })
      }
    } else {
      // advanced mode
      const includeFiltered = simplePatterns.filter(p => p.trim())
      const excludeFiltered = excludePatterns.filter(p => p.trim())

      if (includeFiltered.length === 0 && excludeFiltered.length === 0) {
        onConfigChange({ urlFilter: undefined })
      } else {
        onConfigChange({
          urlFilter: {
            include: includeFiltered.length > 0 ? includeFiltered : undefined,
            exclude: excludeFiltered.length > 0 ? excludeFiltered : undefined,
            mode: regexMode ? 'regex' : 'simple',
            matchType: matchType
          }
        })
      }
    }
  }

  // Auto-save URL filter changes with debouncing (skip on first render)
  useEffect(() => {
    // Skip the autosave on first render to avoid false "unsaved changes"
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      return
    }

    const timer = setTimeout(() => {
      updateURLFilter()
    }, 500)

    return () => clearTimeout(timer)
  }, [simplePatterns, excludePatterns, regexMode, matchType, mode])

  return (
    <div className="bg-blue-50 rounded-lg border border-blue-200">
      {/* Header with toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-100 transition-colors rounded-lg"
      >
        <span className="text-xs font-medium text-gray-700">URL Filtering</span>
        <span className="text-gray-500">{isExpanded ? '−' : '+'}</span>
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-blue-200 pt-3">
          {/* Mode selector */}
          <select
            value={mode}
            onChange={(e) => {
              const newMode = e.target.value as 'all' | 'simple' | 'advanced'
              setMode(newMode)
              if (newMode === 'all') {
                onConfigChange({ urlFilter: undefined })
              } else if (newMode === 'simple' || newMode === 'advanced') {
                if (simplePatterns.length === 0) {
                  setSimplePatterns([''])
                }
              }
            }}
            disabled={!canEdit}
            className="w-full pl-2 pr-10 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs bg-white"
            style={{ backgroundPosition: 'right 0.75rem center' }}
          >
            <option value="all">Apply on all pages</option>
            <option value="simple">Target specific URLs (Simple patterns)</option>
            <option value="advanced">Advanced (Include/Exclude + Regex)</option>
          </select>

          {/* Match Type selector - only show when not "all" mode */}
          {mode !== 'all' && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                Match against:
              </label>
              <select
                value={matchType}
                onChange={(e) => {
                  setMatchType(e.target.value as 'full-url' | 'path' | 'domain' | 'query' | 'hash')
                  setTimeout(updateURLFilter, 0)
                }}
                disabled={!canEdit}
                className="w-full pl-2 pr-10 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs bg-white"
                style={{ backgroundPosition: 'right 0.75rem center' }}
              >
                <option value="path">Path only (e.g., /products/123)</option>
                <option value="full-url">Full URL (e.g., https://example.com/products/123?ref=home)</option>
                <option value="domain">Domain only (e.g., example.com)</option>
                <option value="query">Query parameters only (e.g., ?id=123&ref=home)</option>
                <option value="hash">Hash fragment only (e.g., #section-name)</option>
              </select>
            </div>
          )}

      {/* Simple mode */}
      {mode === 'simple' && (
        <div className="space-y-2">
          <div className="text-xs text-gray-600">
            💡 Use * to match any characters, ? for single character
          </div>
          {(simplePatterns.length > 0 ? simplePatterns : ['']).map((pattern, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={pattern}
                onChange={(e) => {
                  const newPatterns = [...simplePatterns]
                  newPatterns[i] = e.target.value
                  setSimplePatterns(newPatterns)
                }}
                onBlur={updateURLFilter}
                placeholder={matchType === 'path' ? '/products/*' : matchType === 'domain' ? 'example.com' : matchType === 'query' ? 'id=*' : matchType === 'hash' ? '#section-*' : 'https://example.com/products/*'}
                disabled={!canEdit}
                className="flex-1 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  const newPatterns = simplePatterns.filter((_, idx) => idx !== i)
                  setSimplePatterns(newPatterns.length > 0 ? newPatterns : [''])
                  setTimeout(updateURLFilter, 0)
                }}
                disabled={!canEdit}
                className="p-1 text-red-600 hover:text-red-800"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button
            type="button"
            onClick={() => setSimplePatterns([...simplePatterns, ''])}
            size="sm"
            variant="secondary"
            disabled={!canEdit}
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Pattern
          </Button>
        </div>
      )}

      {/* Advanced mode */}
      {mode === 'advanced' && (
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={regexMode}
              onChange={(e) => {
                setRegexMode(e.target.checked)
                setTimeout(updateURLFilter, 0)
              }}
              disabled={!canEdit}
              className="text-blue-600"
            />
            <span className="text-sm">Use Regex mode</span>
          </label>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Include patterns:
            </label>
            {(simplePatterns.length > 0 ? simplePatterns : ['']).map((pattern, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <Input
                  value={pattern}
                  onChange={(e) => {
                    const newPatterns = [...simplePatterns]
                    newPatterns[i] = e.target.value
                    setSimplePatterns(newPatterns)
                  }}
                  onBlur={updateURLFilter}
                  placeholder={
                    regexMode
                      ? (matchType === 'path' ? '^/products/.*$' : matchType === 'hash' ? '^#section-.*$' : '^https://example\\.com/.*$')
                      : (matchType === 'path' ? '/products/*' : matchType === 'domain' ? 'example.com' : matchType === 'query' ? 'id=*' : matchType === 'hash' ? '#section-*' : 'https://example.com/*')
                  }
                  disabled={!canEdit}
                  className="flex-1 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newPatterns = simplePatterns.filter((_, idx) => idx !== i)
                    setSimplePatterns(newPatterns.length > 0 ? newPatterns : [''])
                    setTimeout(updateURLFilter, 0)
                  }}
                  disabled={!canEdit}
                  className="p-1 text-red-600 hover:text-red-800"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              onClick={() => setSimplePatterns([...simplePatterns, ''])}
              size="sm"
              variant="secondary"
              disabled={!canEdit}
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Include Pattern
            </Button>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Exclude patterns (optional):
            </label>
            {excludePatterns.length === 0 && (
              <Button
                type="button"
                onClick={() => setExcludePatterns([''])}
                size="sm"
                variant="secondary"
                disabled={!canEdit}
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Add Exclude Pattern
              </Button>
            )}
            {excludePatterns.map((pattern, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <Input
                  value={pattern}
                  onChange={(e) => {
                    const newPatterns = [...excludePatterns]
                    newPatterns[i] = e.target.value
                    setExcludePatterns(newPatterns)
                  }}
                  onBlur={updateURLFilter}
                  placeholder={
                    regexMode
                      ? (matchType === 'path' ? '^/admin/.*$' : matchType === 'hash' ? '^#admin-.*$' : '^https://example\\.com/admin/.*$')
                      : (matchType === 'path' ? '/admin/*' : matchType === 'domain' ? 'admin.example.com' : matchType === 'query' ? 'preview=*' : matchType === 'hash' ? '#admin-*' : 'https://example.com/admin/*')
                  }
                  disabled={!canEdit}
                  className="flex-1 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newPatterns = excludePatterns.filter((_, idx) => idx !== i)
                    setExcludePatterns(newPatterns)
                    setTimeout(updateURLFilter, 0)
                  }}
                  disabled={!canEdit}
                  className="p-1 text-red-600 hover:text-red-800"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
            {excludePatterns.length > 0 && (
              <Button
                type="button"
                onClick={() => setExcludePatterns([...excludePatterns, ''])}
                size="sm"
                variant="secondary"
                disabled={!canEdit}
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Add Exclude Pattern
              </Button>
            )}
          </div>
        </div>
      )}

        </div>
      )}
    </div>
  )
})

interface GlobalDefaultsSectionProps {
  config: DOMChangesConfig;
  onConfigChange: (config: Partial<DOMChangesConfig>) => void;
  canEdit: boolean;
}

const GlobalDefaultsSection = React.memo(function GlobalDefaultsSection({ config, onConfigChange, canEdit }: GlobalDefaultsSectionProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200">
      {/* Header with toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-100 transition-colors rounded-lg"
      >
        <span className="text-xs font-medium text-gray-700">Global Defaults</span>
        <span className="text-gray-500">{isExpanded ? '−' : '+'}</span>
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-200 pt-3">
          <p className="text-xs text-gray-600 mb-3">
            Set default values for all DOM changes in this variant
          </p>
          <DOMChangeOptions
            important={config.important === true}
            waitForElement={config.waitForElement === true}
            persistStyle={config.persistStyle === true}
            observerRoot={config.observerRoot || ''}
            onImportantChange={(value) => onConfigChange({ important: value || undefined })}
            onWaitForElementChange={(value) => onConfigChange({ waitForElement: value || undefined })}
            onPersistStyleChange={(value) => onConfigChange({ persistStyle: value || undefined })}
            onObserverRootChange={(value) => onConfigChange({ observerRoot: value || undefined })}
            disabled={!canEdit}
            idPrefix="global-defaults"
          />
        </div>
      )}
    </div>
  )
})
