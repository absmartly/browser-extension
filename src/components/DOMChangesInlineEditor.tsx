import React, { useState, useEffect, useRef } from 'react'
import { debugLog, debugError } from '~src/utils/debug'
import { Button } from './ui/Button'
import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import { DOMChangeEditor } from './DOMChangeEditor'
import { AIDOMChangesDialog } from './AIDOMChangesDialog'
import { DOMChangeList } from './dom-editor'
import { useDOMChangesEditor } from '~src/hooks/useDOMChangesEditor'
import { useVisualEditorCoordination } from '~src/hooks/useVisualEditorCoordination'
import { useEditorStateRestoration } from '~src/hooks/useEditorStateRestoration'
import {
  PlusIcon,
  PaintBrushIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'

interface DOMChangesInlineEditorProps {
  variantName: string
  variantIndex: number
  experimentName?: string
  changes: DOMChange[]
  onChange: (changes: DOMChange[]) => void
  previewEnabled: boolean
  onPreviewToggle: (enabled: boolean) => void
  onPreviewRefresh?: () => void
  activeVEVariant: string | null
  onVEStart: () => void
  onVEStop: () => void
  activePreviewVariantName: string | null
  autoNavigateToAI?: string | null
  onNavigateToAI?: (
    variantName: string,
    onGenerate: (prompt: string, images?: string[]) => Promise<AIDOMGenerationResult>,
    currentChanges: DOMChange[],
    onRestoreChanges: (changes: DOMChange[]) => void,
    onPreviewToggle: (enabled: boolean) => void,
    onPreviewRefresh: () => void
  ) => void
}

export function DOMChangesInlineEditor({
  variantName,
  variantIndex,
  experimentName,
  changes,
  onChange,
  previewEnabled,
  onPreviewToggle,
  onPreviewRefresh,
  activeVEVariant,
  onVEStart,
  onVEStop,
  activePreviewVariantName,
  autoNavigateToAI,
  onNavigateToAI
}: DOMChangesInlineEditorProps) {

  const changesRef = useRef(changes)
  useEffect(() => {
    changesRef.current = changes
  }, [changes])

  const {
    editingChange,
    pickingForField,
    setEditingChange,
    setPickingForField,
    handleAddChange,
    handleEditChange,
    handleSaveChange,
    handleCancelEdit,
    handleDeleteChange,
    handleToggleChange,
    handleReorderChanges,
    handleStartElementPicker,
    handleAIGenerate
  } = useDOMChangesEditor({
    changes,
    onChange,
    variantName,
    experimentName,
    previewEnabled
  })

  useEditorStateRestoration({
    variantName,
    changes,
    onChange,
    setEditingChange,
    setPickingForField,
    editingChange
  })

  const { handleLaunchVisualEditor } = useVisualEditorCoordination({
    variantName,
    variantIndex,
    experimentName,
    changes,
    onChange,
    changesRef,
    activeVEVariant,
    onVEStart,
    onVEStop,
    previewEnabled,
    onPreviewToggle
  })

  const [isDragOver, setIsDragOver] = useState(false)
  const [aiDialogOpen, setAiDialogOpen] = useState(false)

  const aiGenerateCallbackIdRef = useRef(Date.now())
  useEffect(() => {
    const newId = Date.now()
    console.log(JSON.stringify({
      type: 'CALLBACK_CHANGE',
      component: 'DOMChangesInlineEditor',
      event: 'HANDLE_AI_GENERATE_RECREATED',
      timestamp: newId,
      previousId: aiGenerateCallbackIdRef.current,
      dependencies: {
        changesLength: changes?.length,
        onChangeProvided: !!onChange
      }
    }))
    aiGenerateCallbackIdRef.current = newId
  }, [handleAIGenerate])

  const hasAutoNavigatedRef = useRef(false)
  useEffect(() => {
    if (
      autoNavigateToAI === variantName &&
      onNavigateToAI &&
      onPreviewRefresh &&
      !hasAutoNavigatedRef.current
    ) {
      hasAutoNavigatedRef.current = true
      console.log(`[DOMChangesInlineEditor:${variantName}] Auto-navigating to AI page`)
      onNavigateToAI(variantName, handleAIGenerate, changes, onChange, onPreviewToggle, onPreviewRefresh)
    }
  }, [autoNavigateToAI, variantName, onNavigateToAI, handleAIGenerate, changes, onChange, onPreviewToggle, onPreviewRefresh])

  return (
    <div
      className={`space-y-3 ${isDragOver ? 'ring-2 ring-blue-400 ring-opacity-50 bg-blue-50 rounded-lg p-2' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)

        const changeData = e.dataTransfer.getData('application/json')
        if (changeData) {
          try {
            const draggedChange = JSON.parse(changeData) as DOMChange

            const existingIndex = changes.findIndex(c => c.selector === draggedChange.selector)
            if (existingIndex === -1) {
              onChange([...changes, draggedChange])
              debugLog('✅ DOM change dropped and added')
            } else {
              debugLog('⚠️ Change with this selector already exists')
            }
          } catch (err) {
            debugError('Failed to parse dropped change:', err)
          }
        }
      }}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">DOM Changes</h4>
        <div className="flex items-center gap-2">
          {changes.length > 0 && (
            <button
              type="button"
              onClick={async () => {
                const jsonString = JSON.stringify(changes, null, 2);

                try {
                  await navigator.clipboard.writeText(jsonString);
                  debugLog('✅ DOM changes copied to clipboard using Clipboard API');
                } catch (err) {
                  try {
                    const textarea = document.createElement('textarea');
                    textarea.value = jsonString;
                    textarea.style.position = 'fixed';
                    textarea.style.top = '-9999px';
                    textarea.style.left = '-9999px';
                    document.body.appendChild(textarea);
                    textarea.focus();
                    textarea.select();

                    const successful = document.execCommand('copy');
                    document.body.removeChild(textarea);

                    if (successful) {
                      debugLog('✅ DOM changes copied to clipboard using fallback method');
                    } else {
                      throw new Error('Document.execCommand failed');
                    }
                  } catch (fallbackErr) {
                    debugError('Failed to copy changes with both methods:', err, fallbackErr);
                    window.prompt('Copy the DOM changes manually:', jsonString);
                  }
                }
              }}
              className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
              title="Copy all DOM changes"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          )}

          <button
            type="button"
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText()
                const pastedChanges = JSON.parse(text) as DOMChange[]

                if (Array.isArray(pastedChanges) && pastedChanges.every(c =>
                  c.selector && c.type && ['text', 'html', 'attribute', 'style', 'class'].includes(c.type)
                )) {
                  const existingSelectors = new Set(changes.map(c => c.selector))
                  const newChanges = pastedChanges.filter(c => !existingSelectors.has(c.selector))
                  onChange([...changes, ...newChanges])
                  debugLog(`✅ Pasted ${newChanges.length} new DOM changes`)
                } else {
                  debugError('Invalid DOM changes format in clipboard')
                }
              } catch (err) {
                debugError('Failed to paste changes:', err)
              }
            }}
            className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
            title="Paste DOM changes from clipboard"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </button>

          <label className="flex items-center gap-2 text-sm">
            <span>Preview:</span>
            <button
              type="button"
              id={`preview-variant-${variantIndex}`}
              data-variant-index={variantIndex}
              data-testid={`preview-toggle-variant-${variantIndex}`}
              onClick={() => {
                console.log('[DOMChangesInlineEditor] Preview toggle clicked:', { previewEnabled, variantIndex })
                onPreviewToggle(!previewEnabled)
              }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                previewEnabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  previewEnabled ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      <div className="space-y-2">
        {changes.length === 0 && !editingChange ? (
          <DOMChangeList
            changes={[]}
            onEdit={handleEditChange}
            onDelete={handleDeleteChange}
            onToggle={handleToggleChange}
            onReorder={(newChanges) => {
              (onChange as any)(newChanges, { isReorder: true })
            }}
            editingIndex={editingChange?.index || null}
          />
        ) : (
          <>
            {editingChange && editingChange.index !== null ? (
              <DOMChangeList
                changes={changes}
                onEdit={handleEditChange}
                onDelete={handleDeleteChange}
                onToggle={handleToggleChange}
                onReorder={(newChanges) => {
                  (onChange as any)(newChanges, { isReorder: true })
                }}
                editingIndex={editingChange.index}
              />
            ) : (
              <DOMChangeList
                changes={changes}
                onEdit={handleEditChange}
                onDelete={handleDeleteChange}
                onToggle={handleToggleChange}
                onReorder={(newChanges) => {
                  (onChange as any)(newChanges, { isReorder: true })
                }}
                editingIndex={null}
              />
            )}

            {editingChange && (
              <DOMChangeEditor
                editingChange={editingChange}
                variantIndex={variantIndex}
                onSave={handleSaveChange}
                onCancel={handleCancelEdit}
                onStartPicker={handleStartElementPicker}
              />
            )}
          </>
        )}
      </div>

      {!editingChange && (
        <div className="flex gap-2">
          <Button id="add-dom-change-button"
            type="button"
            onClick={handleAddChange}
            size="sm"
            variant="secondary"
            className="flex-1"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add DOM Change
          </Button>
          <Button id="generate-with-ai-button"
            type="button"
            onClick={() => {
              if (onNavigateToAI && onPreviewRefresh) {
                onNavigateToAI(variantName, handleAIGenerate, changes, onChange, onPreviewToggle, onPreviewRefresh)
              } else {
                setAiDialogOpen(true)
              }
            }}
            size="sm"
            variant="secondary"
            className="flex-1"
          >
            <SparklesIcon className="h-4 w-4 mr-1" />
            Generate with AI
          </Button>
          <Button id="visual-editor-button"
            type="button"
            onClick={handleLaunchVisualEditor}
            size="sm"
            variant="primary"
            className="flex-1"
            disabled={activeVEVariant !== null}
            title={
              activeVEVariant === variantName
                ? 'Visual Editor is already active for this variant'
                : activeVEVariant
                ? `Visual Editor is active for variant "${activeVEVariant}"`
                : 'Launch Visual Editor'
            }
          >
            <PaintBrushIcon className="h-4 w-4 mr-1" />
            Visual Editor
          </Button>
        </div>
      )}

      <AIDOMChangesDialog
        isOpen={aiDialogOpen}
        onClose={() => setAiDialogOpen(false)}
        onGenerate={handleAIGenerate}
        variantName={variantName}
      />
    </div>
  )
}
