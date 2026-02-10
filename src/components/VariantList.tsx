import React, { useState, useEffect, useRef, useCallback } from 'react'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'
import { sendToContent } from '~src/lib/messaging'
import { Button } from './ui/Button'
import { PlusIcon } from '@heroicons/react/24/outline'
import { VariantConfigJSONEditor } from './VariantConfigJSONEditor'
import type { DOMChange, DOMChangesData, DOMChangesConfig, AIDOMGenerationResult } from '~src/types/dom-changes'
import { localAreaStorage as storage } from "~src/utils/storage"
import { VariantCard, type Variant } from './variant/VariantCard'
import {
  getDOMChangesFromConfig,
  setDOMChangesInConfig,
  getChangesArray,
  getChangesConfig,
  type VariantConfig
} from '~src/hooks/useVariantConfig'
import { useVariantPreview } from '~src/hooks/useVariantPreview'

interface VariantListProps {
  initialVariants: Variant[]
  experimentId: number
  experimentName: string
  onVariantsChange: (variants: Variant[], hasChanges: boolean) => void
  canEdit?: boolean
  canAddRemove?: boolean
  domFieldName: string
  onNavigateToAI?: (
    variantName: string,
    onGenerate: (prompt: string, images?: string[]) => Promise<AIDOMGenerationResult>,
    currentChanges: DOMChange[],
    onRestoreChanges: (changes: DOMChange[]) => void,
    onPreviewToggle: (enabled: boolean) => void,
    onPreviewRefresh: () => void,
    onPreviewWithChanges: (enabled: boolean, changes: DOMChange[]) => void
  ) => void
  autoNavigateToAI?: string | null
}

export function VariantList({
  initialVariants,
  experimentId,
  experimentName,
  onVariantsChange,
  canEdit = true,
  canAddRemove = true,
  domFieldName,
  onNavigateToAI,
  autoNavigateToAI
}: VariantListProps) {
  const [variants, setVariants] = useState<Variant[]>(initialVariants)
  const [activeVEVariant, setActiveVEVariant] = useState<string | null>(null)
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false)
  const [jsonEditorVariant, setJsonEditorVariant] = useState<number | null>(null)
  const [addingVariableForVariant, setAddingVariableForVariant] = useState<number | null>(null)
  const [newVariableName, setNewVariableName] = useState('')
  const [newVariableValue, setNewVariableValue] = useState('')
  const [expandedVariants, setExpandedVariants] = useState<Set<number>>(() => {
    const expanded = new Set<number>()
    for (let i = 1; i < initialVariants.length; i++) {
      expanded.add(i)
    }
    return expanded
  })
  const newVarNameInputRef = useRef<HTMLInputElement>(null)
  const newVarValueInputRef = useRef<HTMLInputElement>(null)
  const justUpdatedRef = useRef(false)
  const aiChangesAppliedRef = useRef(false)

  const {
    previewEnabled,
    activePreviewVariant,
    handlePreviewToggle,
    handlePreviewWithChanges,
    handlePreviewRefresh
  } = useVariantPreview({
    variants,
    experimentName,
    domFieldName,
    activeVEVariant
  })

  useEffect(() => {
    justUpdatedRef.current = false
  }, [experimentId])

  useEffect(() => {
    const loadSavedChanges = async () => {
      if (initialVariants.length > 0) {
        const storageKey = experimentId === 0
          ? 'experiment-new-variants'
          : `experiment-${experimentId}-variants`
        try {
          const savedVariants = await storage.get(storageKey)
          if (savedVariants && Array.isArray(savedVariants)) {
            const hasActualChanges = JSON.stringify(savedVariants) !== JSON.stringify(initialVariants)

            if (hasActualChanges) {
              setVariants(savedVariants)
              justUpdatedRef.current = true
              onVariantsChange(savedVariants, true)
            }
          }
        } catch (error) {
          debugError('Failed to load saved variants:', error)
        }
        return
      }

      const storageKey = experimentId === 0
        ? 'experiment-new-variants'
        : `experiment-${experimentId}-variants`
      try {
        const savedVariants = await storage.get(storageKey)
        if (savedVariants && Array.isArray(savedVariants)) {
          setVariants(savedVariants)
          justUpdatedRef.current = true
          onVariantsChange(savedVariants, true)
        }
      } catch (error) {
        debugError('Failed to load saved variants:', error)
      }
    }
    loadSavedChanges()
  }, [experimentId, initialVariants.length])

  useEffect(() => {
    if (justUpdatedRef.current) {
      justUpdatedRef.current = false
      return
    }

    setVariants(initialVariants)
  }, [initialVariants, experimentId])

  const saveToStorage = (updatedVariants: Variant[]) => {
    const storageKey = experimentId === 0
      ? 'experiment-new-variants'
      : `experiment-${experimentId}-variants`
    storage.set(storageKey, updatedVariants).catch(error => {
      debugError('Failed to save variants to storage:', error)
    })
  }

  const updateVariants = (updatedVariants: Variant[]) => {
    setVariants(updatedVariants)
    saveToStorage(updatedVariants)
    justUpdatedRef.current = true
    onVariantsChange(updatedVariants, true)
  }

  const addVariant = () => {
    const newVariants = [
      ...variants,
      {
        name: `Variant ${variants.length}`,
        config: {}
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

    if (previewEnabled && activePreviewVariant === index && !options?.isReorder) {
      const enabledChanges = changes.filter(c => !c.disabled)
      try {
        sendToContent({
          type: 'ABSMARTLY_PREVIEW',
          action: 'update',
          changes: enabledChanges,
          experimentName: experimentName,
          variantName: newVariants[index].name
        }).catch(error => {
          debugError('[VariantList] Error sending ABSMARTLY_PREVIEW (update):', error)
        })
      } catch (error) {
        debugError('[VariantList] Exception sending ABSMARTLY_PREVIEW (update):', error)
      }
    }
  }

  useEffect(() => {
    const applyAIDomChanges = async () => {
      const returnFlag = (typeof window !== 'undefined') ? (window as any).__absmartlyReturnToDomChanges : null
      if (returnFlag) {
        delete (window as any).__absmartlyReturnToDomChanges
        setTimeout(() => {
          const section = document.querySelector('[data-dom-changes-section="true"]')
          if (section) {
            section.scrollIntoView({ block: 'start' })
          }
        }, 0)
      }

      if (aiChangesAppliedRef.current) return

      let aiDomChangesState: { variantName: string; changes: DOMChange[] } | null = null
      try {
        aiDomChangesState = await storage.get<{ variantName: string; changes: DOMChange[] }>('aiDomChangesState')
      } catch (error) {
        debugWarn('[VariantList] Failed to read aiDomChangesState from storage:', error)
      }
      const windowState = (typeof window !== 'undefined')
        ? (window as any).__absmartlyLatestDomChanges
        : null
      const effectiveState = aiDomChangesState || windowState
      if (!effectiveState || !effectiveState.variantName) return

      const targetIndex = variants.findIndex(v => v.name === effectiveState.variantName)
      if (targetIndex === -1) return

      if (effectiveState.changes && effectiveState.changes.length > 0) {
        updateVariantDOMChanges(targetIndex, effectiveState.changes)
        aiChangesAppliedRef.current = true
        await storage.remove('aiDomChangesState')
        if (windowState) {
          delete (window as any).__absmartlyLatestDomChanges
        }
        setTimeout(() => {
          const section = document.querySelector('[data-dom-changes-section="true"]')
          if (section) {
            section.scrollIntoView({ block: 'start' })
          }
        }, 0)
      }
    }

    applyAIDomChanges()
  }, [variants, updateVariantDOMChanges])

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
    setTimeout(() => {
      newVarNameInputRef.current?.focus()
    }, 0)
  }

  const saveNewVariable = (index: number) => {
    let key = newVariableName.trim()
    let value = newVariableValue

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
      if (value && (value.startsWith('{') || value.startsWith('['))) {
        parsedValue = JSON.parse(value)
      }
    } catch {
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
      if (value.startsWith('{') || value.startsWith('[')) {
        parsedValue = JSON.parse(value)
      }
    } catch {
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

  const handleNavigateToAIWithPreview = useCallback((
    variantName: string,
    onGenerate: (prompt: string, images?: string[]) => Promise<AIDOMGenerationResult>,
    currentChanges: DOMChange[],
    onRestoreChanges: (changes: DOMChange[]) => void,
    onPreviewToggle: (enabled: boolean) => void,
    _onPreviewRefresh: () => void
  ) => {
    debugLog('[VariantList] handleNavigateToAIWithPreview called for variant:', variantName)
    debugLog('[VariantList] handleNavigateToAIWithPreview called with params:', {
      variantName,
      currentChangesLength: currentChanges?.length,
      hasOnGenerate: !!onGenerate,
      hasOnRestoreChanges: !!onRestoreChanges,
      hasOnPreviewToggle: !!onPreviewToggle
    })

    const variantIndex = variants.findIndex(v => v.name === variantName)

    const wrappedPreviewToggle = (enabled: boolean) => {
      if (variantIndex !== -1) {
        handlePreviewToggle(enabled, variantIndex)
      }
    }

    const wrappedPreviewWithChanges = (enabled: boolean, changes: DOMChange[]) => {
      if (variantIndex !== -1) {
        handlePreviewWithChanges(enabled, variantIndex, changes)
      }
    }

    const wrappedPreviewRefresh = () => {
      if (variantIndex !== -1) {
        handlePreviewRefresh(variantIndex)
      }
    }

    if (onNavigateToAI) {
      debugLog('[VariantList] Calling parent onNavigateToAI with all 7 parameters')
      onNavigateToAI(variantName, onGenerate, currentChanges, onRestoreChanges, wrappedPreviewToggle, wrappedPreviewRefresh, wrappedPreviewWithChanges)
    } else {
      debugWarn('[VariantList] onNavigateToAI is not defined!')
    }
  }, [variants, onNavigateToAI, handlePreviewToggle, handlePreviewRefresh, handlePreviewWithChanges])

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
            <VariantCard
              key={`${variant.name}-${index}`}
              variant={variant}
              index={index}
              isExpanded={isExpanded}
              isControl={isControl}
              canEdit={canEdit}
              canAddRemove={canAddRemove}
              experimentName={experimentName}
              domFieldName={domFieldName}
              previewEnabled={previewEnabled}
              activePreviewVariant={activePreviewVariant}
              activeVEVariant={activeVEVariant}
              activePreviewVariantName={activePreviewVariant !== null ? variants[activePreviewVariant]?.name : null}
              autoNavigateToAI={autoNavigateToAI}
              addingVariableForVariant={addingVariableForVariant}
              newVariableName={newVariableName}
              newVariableValue={newVariableValue}
              newVarNameInputRef={newVarNameInputRef}
              newVarValueInputRef={newVarValueInputRef}
              onToggleExpand={() => {
                const newExpanded = new Set(expandedVariants)
                if (isExpanded) {
                  newExpanded.delete(index)
                } else {
                  newExpanded.add(index)
                }
                setExpandedVariants(newExpanded)
              }}
              onUpdateName={(name) => updateVariantName(index, name)}
              onUpdateDOMChanges={(changes, options) => updateVariantDOMChanges(index, changes, options)}
              onUpdateDOMConfig={(config) => updateVariantDOMConfig(index, config)}
              onOpenJsonEditor={() => {
                setJsonEditorVariant(index)
                setJsonEditorOpen(true)
              }}
              onRemove={() => removeVariant(index)}
              onAddVariable={() => addVariantVariable(index)}
              onSaveVariable={() => saveNewVariable(index)}
              onCancelVariable={cancelNewVariable}
              onUpdateVariable={(key, value) => updateVariantVariable(index, key, value)}
              onDeleteVariable={(key) => deleteVariantVariable(index, key)}
              onNewVariableNameChange={setNewVariableName}
              onNewVariableValueChange={setNewVariableValue}
              onPreviewToggle={(enabled) => {
                debugLog('[VariantList] onPreviewToggle inline callback called:', { enabled, index })
                if (activeVEVariant && activeVEVariant !== variant.name) {
                  alert(`Visual Editor is active for variant "${activeVEVariant}". Please close it first.`)
                  return
                }
                handlePreviewToggle(enabled, index)
              }}
              onPreviewRefresh={() => handlePreviewRefresh(index)}
              onVEStart={() => setActiveVEVariant(variant.name)}
              onVEStop={() => setActiveVEVariant(null)}
              onNavigateToAI={handleNavigateToAIWithPreview}
              allVariantsCount={variants.length}
            />
          )
        })}
      </div>

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

export type { Variant, VariantConfig }
