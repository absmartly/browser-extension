import React, { useMemo } from 'react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { CodeBracketIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { DOMChangesInlineEditor } from '../DOMChangesInlineEditor'
import { URLFilterSection } from '../URLFilterSection'
import { GlobalDefaultsSection } from '../GlobalDefaultsSection'
import type { DOMChange, DOMChangesData, AIDOMGenerationResult } from '~src/types/dom-changes'
import { getChangesArray, getChangesConfig, getVariablesForDisplay, type VariantConfig } from '~src/hooks/useVariantConfig'

export interface Variant {
  name: string
  config: VariantConfig
}

interface VariantCardProps {
  variant: Variant
  index: number
  isExpanded: boolean
  isControl: boolean
  canEdit: boolean
  canAddRemove: boolean
  experimentName: string
  domFieldName: string
  previewEnabled: boolean
  activePreviewVariant: number | null
  activeVEVariant: string | null
  activePreviewVariantName: string | null
  autoNavigateToAI: string | null
  addingVariableForVariant: number | null
  newVariableName: string
  newVariableValue: string
  newVarNameInputRef: React.RefObject<HTMLInputElement>
  newVarValueInputRef: React.RefObject<HTMLInputElement>
  onToggleExpand: () => void
  onUpdateName: (name: string) => void
  onUpdateDOMChanges: (changes: DOMChange[], options?: { isReorder?: boolean }) => void
  onUpdateDOMConfig: (configUpdate: Partial<Omit<DOMChangesData, 'changes'>>) => void
  onOpenJsonEditor: () => void
  onRemove: () => void
  onAddVariable: () => void
  onSaveVariable: () => void
  onCancelVariable: () => void
  onUpdateVariable: (key: string, value: string) => void
  onDeleteVariable: (key: string) => void
  onNewVariableNameChange: (value: string) => void
  onNewVariableValueChange: (value: string) => void
  onPreviewToggle: (enabled: boolean) => void
  onPreviewRefresh: () => void
  onVEStart: () => void
  onVEStop: () => void
  onNavigateToAI?: (
    variantName: string,
    onGenerate: (prompt: string, images?: string[]) => Promise<AIDOMGenerationResult>,
    currentChanges: DOMChange[],
    onRestoreChanges: (changes: DOMChange[]) => void,
    onPreviewToggle: (enabled: boolean) => void,
    onPreviewRefresh: () => void,
    onPreviewWithChanges: (enabled: boolean, changes: DOMChange[]) => void
  ) => void
  allVariantsCount: number
}

export const VariantCard = React.memo(function VariantCard({
  variant,
  index,
  isExpanded,
  isControl,
  canEdit,
  canAddRemove,
  experimentName,
  domFieldName,
  previewEnabled,
  activePreviewVariant,
  activeVEVariant,
  activePreviewVariantName,
  autoNavigateToAI,
  addingVariableForVariant,
  newVariableName,
  newVariableValue,
  newVarNameInputRef,
  newVarValueInputRef,
  onToggleExpand,
  onUpdateName,
  onUpdateDOMChanges,
  onUpdateDOMConfig,
  onOpenJsonEditor,
  onRemove,
  onAddVariable,
  onSaveVariable,
  onCancelVariable,
  onUpdateVariable,
  onDeleteVariable,
  onNewVariableNameChange,
  onNewVariableValueChange,
  onPreviewToggle,
  onPreviewRefresh,
  onVEStart,
  onVEStop,
  onNavigateToAI,
  allVariantsCount
}: VariantCardProps) {
  const displayVariables = useMemo(
    () => getVariablesForDisplay(variant.config, domFieldName),
    [variant.config, domFieldName]
  )

  const domChangesData = useMemo(
    () => getChangesConfig(variant.config[domFieldName] as DOMChangesData || []),
    [variant.config, domFieldName]
  )

  const changes = useMemo(
    () => getChangesArray(variant.config[domFieldName] as DOMChangesData || []),
    [variant.config, domFieldName]
  )

  return (
    <div className={`border rounded-lg ${isControl ? 'border-gray-300 bg-gray-100' : 'border-gray-200'} ${isControl && !isExpanded ? 'opacity-60' : ''}`}>
      <div className="px-4 py-3 flex items-center gap-2">
        <button
          id={`variant-toggle-${index}`}
          type="button"
          onClick={onToggleExpand}
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
          onChange={(e) => onUpdateName(e.target.value)}
          placeholder={`Variant ${index}`}
          disabled={!canEdit}
        />
        <Button
          id={`json-editor-button-variant-${index}`}
          type="button"
          onClick={onOpenJsonEditor}
          size="sm"
          variant="secondary"
          disabled={activeVEVariant !== null}
          title={
            activeVEVariant
              ? `Cannot edit JSON while Visual Editor is active for "${activeVEVariant}"`
              : "View Full Variant Configuration"
          }
        >
          <CodeBracketIcon className="h-4 w-4" />
          Json
        </Button>
        {canEdit && canAddRemove && allVariantsCount > 2 && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-red-600 hover:text-red-800"
            title="Delete variant"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-200 pt-3">
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
              {Object.entries(displayVariables).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <Input
                    value={key}
                    disabled
                    className="flex-1 text-sm"
                  />
                  <Input
                    value={typeof value === 'object' ? JSON.stringify(value) : value}
                    onChange={(e) => onUpdateVariable(key, e.target.value)}
                    className="flex-1 text-sm"
                    disabled={!canEdit}
                  />
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onDeleteVariable(key)}
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
                    onChange={(e) => onNewVariableNameChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onSaveVariable()
                      } else if (e.key === 'Escape') {
                        onCancelVariable()
                      }
                    }}
                    placeholder="Variable name"
                    className="flex-1 text-sm"
                  />
                  <Input
                    ref={newVarValueInputRef}
                    value={newVariableValue}
                    onChange={(e) => onNewVariableValueChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onSaveVariable()
                      } else if (e.key === 'Escape') {
                        onCancelVariable()
                      }
                    }}
                    placeholder="Variable value"
                    className="flex-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={onSaveVariable}
                    className="p-1 text-green-600 hover:text-green-800"
                    title="Save variable"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={onCancelVariable}
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
                  onClick={onAddVariable}
                  size="sm"
                  variant="secondary"
                  className="w-full"
                >
                  Add Variable
                </Button>
              )}
            </div>
          </div>

          <URLFilterSection
            variantIndex={index}
            config={domChangesData}
            onConfigChange={onUpdateDOMConfig}
            canEdit={canEdit}
          />

          <GlobalDefaultsSection
            config={domChangesData}
            onConfigChange={onUpdateDOMConfig}
            canEdit={canEdit}
          />

          <DOMChangesInlineEditor
            variantName={variant.name}
            variantIndex={index}
            experimentName={experimentName}
            changes={changes}
            onChange={onUpdateDOMChanges}
            previewEnabled={previewEnabled && activePreviewVariant === index}
            onPreviewToggle={onPreviewToggle}
            onPreviewRefresh={onPreviewRefresh}
            activeVEVariant={activeVEVariant}
            onVEStart={onVEStart}
            onVEStop={onVEStop}
            activePreviewVariantName={activePreviewVariantName}
            autoNavigateToAI={autoNavigateToAI}
            onNavigateToAI={onNavigateToAI}
          />
        </div>
      )}
    </div>
  )
})
