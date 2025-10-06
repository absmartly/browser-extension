import React, { useState, useEffect } from 'react'
import { debugLog, debugError } from '~src/utils/debug'
import { Storage } from '@plasmohq/storage'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { PlusIcon, TrashIcon, CodeBracketIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { DOMChangesInlineEditor } from './DOMChangesInlineEditor'
import { DOMChangesJSONEditor } from './DOMChangesJSONEditor'
import type { DOMChange } from '~src/types/dom-changes'

const storage = new Storage({ area: "local" })

export interface Variant {
  name: string
  variables: Record<string, any>
  dom_changes: DOMChange[]
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
          debugLog('📦 Restoring saved variants from storage:', savedVariants)
          setVariants(savedVariants)
          // Notify parent that we have unsaved changes
          onVariantsChange(savedVariants, true)
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
        setVariants(initialVariants)
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
        dom_changes: []
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
    newVariants[index] = { ...newVariants[index], dom_changes: changes }
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
      const changes = variants[variantIndex].dom_changes || []
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

              {/* DOM Changes Section */}
              <DOMChangesInlineEditor
                variantName={variant.name}
                experimentName={experimentName}
                changes={variant.dom_changes}
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
          changes={variants[jsonEditorVariant]?.dom_changes || []}
          onSave={(newChanges) => {
            updateVariantDOMChanges(jsonEditorVariant, newChanges)
            setJsonEditorOpen(false)
            setJsonEditorVariant(null)
          }}
          variantName={variants[jsonEditorVariant]?.name || ''}
        />
      )}
    </div>
  )
}
