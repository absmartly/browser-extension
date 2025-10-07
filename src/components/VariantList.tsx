import React, { useState, useEffect } from 'react'
import { debugLog, debugError } from '~src/utils/debug'
import { Storage } from '@plasmohq/storage'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { PlusIcon, TrashIcon, CodeBracketIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { DOMChangesInlineEditor } from './DOMChangesInlineEditor'
import { DOMChangesJSONEditor } from './DOMChangesJSONEditor'
import { DOMChangeOptions } from './DOMChangeOptions'
import type { DOMChange, DOMChangesData, DOMChangesConfig, URLFilter } from '~src/types/dom-changes'

const storage = new Storage({ area: "local" })

export interface Variant {
  name: string
  variables: Record<string, any>
  dom_changes: DOMChangesData // Now supports both legacy array and new config format
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

// Helper to convert legacy array format to new format
function normalizeToNewFormat(data: DOMChangesData): DOMChangesConfig {
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
}

export function VariantList({
  initialVariants,
  experimentId,
  experimentName,
  onVariantsChange,
  canEdit = true,
  canAddRemove = true
}: VariantListProps) {
  const [variants, setVariants] = useState<Variant[]>(initialVariants)
  const [previewEnabled, setPreviewEnabled] = useState(false)
  const [activePreviewVariant, setActivePreviewVariant] = useState<number | null>(null)
  const [activeVEVariant, setActiveVEVariant] = useState<string | null>(null)
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false)
  const [jsonEditorVariant, setJsonEditorVariant] = useState<number | null>(null)

  // Load saved changes from storage on mount
  useEffect(() => {
    const loadSavedChanges = async () => {
      const storageKey = `experiment-${experimentId}-variants`
      try {
        const savedVariants = await storage.get(storageKey)
        if (savedVariants && Array.isArray(savedVariants)) {
          // Convert all variants to new format
          const normalizedVariants = savedVariants.map(v => ({
            ...v,
            dom_changes: normalizeToNewFormat(v.dom_changes || [])
          }))
          debugLog('📦 Restoring saved variants from storage (normalized):', normalizedVariants)
          setVariants(normalizedVariants)
          // Notify parent that we have unsaved changes
          onVariantsChange(normalizedVariants, true)
        }
      } catch (error) {
        debugError('Failed to load saved variants:', error)
      }
    }
    loadSavedChanges()
  }, [experimentId])

  // Sync with parent when initialVariants change (new experiment loaded)
  // Only sync when experiment actually changes (not on every parent re-render)
  useEffect(() => {
    if (initialVariants.length > 0) {
      // Only update if this is truly a new experiment (different ID)
      // Don't sync if we already have variants from storage or user edits
      if (variants.length === 0) {
        // Convert all variants to new format
        const normalizedVariants = initialVariants.map(v => ({
          ...v,
          dom_changes: normalizeToNewFormat(v.dom_changes || [])
        }))
        setVariants(normalizedVariants)
      }
    }
  }, [initialVariants, experimentId])

  // Cleanup storage and preview on unmount
  useEffect(() => {
    return () => {
      debugLog('🧹 VariantList unmounting, cleaning up')

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

  const saveToStorage = (updatedVariants: Variant[]) => {
    const storageKey = `experiment-${experimentId}-variants`
    storage.set(storageKey, updatedVariants).catch(error => {
      debugError('Failed to save variants to storage:', error)
    })
  }

  const updateVariants = (updatedVariants: Variant[]) => {
    setVariants(updatedVariants)
    saveToStorage(updatedVariants)
    onVariantsChange(updatedVariants, true) // true = has unsaved changes
  }

  const addVariant = () => {
    const newVariants = [
      ...variants,
      {
        name: `Variant ${variants.length}`,
        variables: {},
        dom_changes: { changes: [] } // Use new format for new variants
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
    const currentData = newVariants[index].dom_changes

    // Always preserve URL filter and global defaults from the config
    const currentConfig = getChangesConfig(currentData)
    newVariants[index] = {
      ...newVariants[index],
      dom_changes: {
        ...currentConfig,
        changes
      }
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

  const updateVariantDOMConfig = (index: number, config: Partial<Omit<DOMChangesConfig, 'changes'>>) => {
    const newVariants = [...variants]
    const currentData = newVariants[index].dom_changes
    const currentConfig = getChangesConfig(currentData)

    newVariants[index] = {
      ...newVariants[index],
      dom_changes: {
        ...currentConfig,
        ...config
      }
    }

    updateVariants(newVariants)
  }

  const addVariantVariable = (index: number) => {
    const key = prompt('Enter variable name:')
    if (key) {
      const newVariants = [...variants]
      newVariants[index] = {
        ...newVariants[index],
        variables: { ...newVariants[index].variables, [key]: '' }
      }
      updateVariants(newVariants)
    }
  }

  const updateVariantVariable = (index: number, key: string, value: string) => {
    const newVariants = [...variants]
    let parsedValue: any = value
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
      variables: { ...newVariants[index].variables, [key]: parsedValue }
    }
    updateVariants(newVariants)
  }

  const deleteVariantVariable = (index: number, key: string) => {
    const newVariants = [...variants]
    const newVariables = { ...newVariants[index].variables }
    delete newVariables[key]
    newVariants[index] = { ...newVariants[index], variables: newVariables }
    updateVariants(newVariants)
  }

  const handlePreviewToggle = (enabled: boolean, variantIndex: number) => {
    setPreviewEnabled(enabled)
    setActivePreviewVariant(enabled ? variantIndex : null)

    if (enabled && variants[variantIndex]) {
      const domChanges = variants[variantIndex].dom_changes || { changes: [] }
      const changes = getChangesArray(domChanges)
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
  }

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
        {variants.map((variant, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4">
            <div className="mb-3 flex items-center gap-2">
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
                title="Edit DOM Changes as JSON"
              >
                <CodeBracketIcon className="h-4 w-4" />
                JSON
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

            {/* Variables Section */}
            <div className="space-y-3">
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Variables</h5>
                <div className="space-y-2">
                  {Object.entries(variant.variables).map(([key, value]) => (
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
                  {canEdit && (
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
                config={getChangesConfig(variant.dom_changes)}
                onConfigChange={(config) => updateVariantDOMConfig(index, config)}
                canEdit={canEdit}
              />

              {/* Global Defaults Section */}
              <GlobalDefaultsSection
                config={getChangesConfig(variant.dom_changes)}
                onConfigChange={(config) => updateVariantDOMConfig(index, config)}
                canEdit={canEdit}
              />

              {/* DOM Changes Section */}
              <DOMChangesInlineEditor
                variantName={variant.name}
                experimentName={experimentName}
                changes={getChangesArray(variant.dom_changes)}
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
          </div>
        ))}
      </div>

      {/* JSON Editor Modal */}
      {jsonEditorVariant !== null && (
        <DOMChangesJSONEditor
          isOpen={jsonEditorOpen}
          onClose={() => {
            setJsonEditorOpen(false)
            setJsonEditorVariant(null)
          }}
          changes={variants[jsonEditorVariant]?.dom_changes}
          onSave={(newData) => {
            if (jsonEditorVariant !== null) {
              const newVariants = [...variants]
              newVariants[jsonEditorVariant] = {
                ...newVariants[jsonEditorVariant],
                dom_changes: newData
              }
              updateVariants(newVariants)
            }
            setJsonEditorOpen(false)
            setJsonEditorVariant(null)
          }}
          variantName={variants[jsonEditorVariant]?.name || ''}
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

function URLFilterSection({ config, onConfigChange, canEdit }: URLFilterSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)

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
}

interface GlobalDefaultsSectionProps {
  config: DOMChangesConfig;
  onConfigChange: (config: Partial<DOMChangesConfig>) => void;
  canEdit: boolean;
}

function GlobalDefaultsSection({ config, onConfigChange, canEdit }: GlobalDefaultsSectionProps) {
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
}
