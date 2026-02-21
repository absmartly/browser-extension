import React, { useState, useEffect } from 'react'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'
import { sendToContent } from '~src/lib/messaging'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'
import type { Experiment, ExperimentInjectionCode } from '~src/types/absmartly'
import { Header } from './Header'
import { CheckIcon, XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { VariantList } from './VariantList'
import type { Variant } from './VariantList'
import { ExperimentMetadata } from './ExperimentMetadata'
import { getConfig } from '~src/utils/storage'
import { useExperimentVariants } from '~src/hooks/useExperimentVariants'
import { useExperimentSave } from '~src/hooks/useExperimentSave'
import { ExperimentActions } from './ExperimentDetail/ExperimentActions'
import { getExperimentStateLabel, getExperimentStateBadgeVariant } from '~src/utils/experiment-state'
import { ExperimentCodeInjection } from './ExperimentCodeInjection'
import type { URLFilter, DOMChangesData, DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import { clearAllExperimentStorage } from '~src/utils/storage-cleanup'
import { localAreaStorage as storage } from "~src/utils/storage"

interface ExperimentDetailProps {
  experiment: Experiment
  onBack: () => void
  onStart: (id: number) => void
  onStop: (id: number) => void
  onUpdate?: (id: number, updates: Partial<Experiment>) => void
  loading?: boolean
  applications?: any[]
  unitTypes?: any[]
  owners?: any[]
  teams?: any[]
  tags?: any[]
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
  onError?: (message: string) => void
}

export function ExperimentDetail({
  experiment,
  onBack,
  onStart,
  onStop,
  onUpdate,
  loading,
  applications = [],
  unitTypes = [],
  owners = [],
  teams = [],
  tags = [],
  onNavigateToAI,
  autoNavigateToAI,
  onError
}: ExperimentDetailProps) {
  debugLog('🔍 ExperimentDetail render start - experiment:', experiment)
  debugLog('🔍 ExperimentDetail render start - experiment.variants:', experiment?.variants)
  debugLog('🔍 ExperimentDetail render start - loading:', loading)
  debugLog('🔍 ExperimentDetail props - unitTypes:', unitTypes?.length, 'owners:', owners?.length, 'tags:', tags?.length)

  const [editingName, setEditingName] = useState(false)
  const [displayName, setDisplayName] = useState(experiment.display_name || experiment.name)
  const [domFieldName, setDomFieldName] = useState<string>('__dom_changes')

  const { initialVariants, currentVariants, hasUnsavedChanges, setHasUnsavedChanges, handleVariantsChange } = useExperimentVariants({
    experiment,
    domFieldName
  })

  useEffect(() => {
    if (displayName !== (experiment.display_name || experiment.name)) {
      setHasUnsavedChanges(true)
    }
  }, [displayName, experiment.display_name, experiment.name, setHasUnsavedChanges])
  const { save, saving } = useExperimentSave({ experiment, domFieldName, onError })
  const [metadata, setMetadata] = useState({
    percentage_of_traffic: experiment.percentage_of_traffic || 100,
    unit_type_id: experiment.unit_type?.unit_type_id || experiment.unit_type_id || null,
    application_ids: experiment.applications?.map(a => a.application_id || a.id) || [],
    owner_ids: experiment.owners?.map(o => o.user_id) || [],
    team_ids: experiment.teams?.map(t => t.team_id) || [],
    tag_ids: experiment.experiment_tags?.map(t => t.experiment_tag_id).filter((id): id is number => id !== undefined) || []
  })

  debugLog('🔍 ExperimentDetail state - displayName:', displayName)
  debugLog('🔍 ExperimentDetail state - variants length:', experiment?.variants?.length)
  debugLog('🔍 ExperimentDetail state - should show variants section:', experiment.variants && experiment.variants.length > 0)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await getConfig()
        const fieldName = config?.domChangesFieldName || '__dom_changes'
        setDomFieldName(fieldName)
      } catch {
        setDomFieldName('__dom_changes')
      }
    }
    loadConfig()
  }, [])


  const handleSaveDisplayName = () => {
    if (onUpdate && displayName !== experiment.display_name) {
      onUpdate(experiment.id, { display_name: displayName })
    }
    setEditingName(false)
  }

  const handleSaveChanges = async () => {
    try {
      const formData = {
        display_name: displayName,
        percentage_of_traffic: metadata.percentage_of_traffic,
        unit_type_id: metadata.unit_type_id,
        application_ids: metadata.application_ids,
        owner_ids: metadata.owner_ids,
        team_ids: metadata.team_ids,
        tag_ids: metadata.tag_ids
      }

      await save(formData, currentVariants, onUpdate)

      try {
        await clearAllExperimentStorage(experiment.id)
        debugLog('🧹 Cleared all DOM changes storage (session + local) after save for experiment', experiment.id)
      } catch (error) {
        debugError('Failed to clear storage after save:', error)
      }

      setHasUnsavedChanges(false)
    } catch (error) {
      debugError('Failed to save experiment:', error)
      if (onError) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to save experiment'
        onError(errorMessage)
      }
    }
  }

  const extractInjectionCode = (variant: Variant): ExperimentInjectionCode | undefined => {
    if (!variant || !variant.config) return undefined
    const injectHtml = variant.config.__inject_html
    if (!injectHtml) return undefined
    return typeof injectHtml === 'string' ? JSON.parse(injectHtml) : injectHtml
  }

  const extractDomChangesUrlFilter = (variant: Variant): URLFilter | undefined => {
    if (!variant || !variant.config) return undefined
    const domChanges = variant.config.__dom_changes as DOMChangesData
    if (!domChanges || Array.isArray(domChanges)) return undefined
    return domChanges.urlFilter
  }

  const handleInjectionCodeChange = (code: ExperimentInjectionCode) => {
    debugLog('🔧 handleInjectionCodeChange called with code:', code)
    debugLog('🔧 Current currentVariants[0]:', currentVariants[0])
    const updatedVariants = [...currentVariants]
    if (updatedVariants[0]) {
      const oldCode = updatedVariants[0].config.__inject_html
      const codeChanged = JSON.stringify(oldCode) !== JSON.stringify(code)

      updatedVariants[0] = {
        ...updatedVariants[0],
        config: {
          ...updatedVariants[0].config,
          __inject_html: code
        }
      }
      debugLog('🔧 Updated variant config:', updatedVariants[0].config)
      debugLog('🔧 Code changed:', codeChanged)
      if (codeChanged) {
        handleVariantsChange(updatedVariants, true)
      } else {
        handleVariantsChange(updatedVariants)
      }
    }
  }

  const canAddVariants = experiment.state !== 'running' &&
                         experiment.state !== 'development' &&
                         experiment.status !== 'running'

  const handleBack = () => {
    const cleanup = async () => {
      try {
        await sendToContent({
          type: 'STOP_VISUAL_EDITOR'
        })

        await sendToContent({
          type: 'ABSMARTLY_PREVIEW',
          action: 'remove',
          experimentName: experiment.name
        })
      } catch (error) {
        debugError('Error during cleanup:', error)
      }
    }

    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Do you want to discard them?')) {
        debugLog('🧹 User chose to discard changes for experiment', experiment.id)
        clearAllExperimentStorage(experiment.id).then(() => {
          debugLog('🧹 Cleared all DOM changes storage (session + local) when discarding for experiment', experiment.id)
          cleanup()
          onBack()
        }).catch(error => {
          debugError('Failed to clear storage when discarding:', error)
          cleanup()
          onBack()
        })
      }
    } else {
      cleanup()
      onBack()
    }
  }

  const titleContent = (
    <div className="flex-1 min-w-0">
      {editingName ? (
        <div>
          <div className="flex items-center gap-2">
            <input
              className="flex-1 text-lg font-semibold rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoFocus
              title={`ID: ${experiment.id}`}
            />
            <div className="flex flex-col gap-0.5">
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
          </div>
          {displayName !== experiment.name && (
            <p className="text-sm text-gray-500 mt-1 overflow-hidden text-ellipsis whitespace-nowrap cursor-help" title={experiment.name}>{experiment.name}</p>
          )}
        </div>
      ) : (
        <div className="flex-1 min-w-0">
          <div
            className="relative group cursor-pointer"
            onClick={() => setEditingName(true)}
          >
            <h2 className="text-lg font-semibold text-gray-900 overflow-hidden text-ellipsis whitespace-nowrap">{displayName}</h2>

            <div className="absolute top-full mt-2 left-0 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
              Click to edit
              <div className="absolute bottom-full left-4 w-0 h-0 border-4 border-transparent border-b-gray-900"></div>
            </div>
          </div>

          {displayName !== experiment.name && (
            <div className="relative group">
              <p className="text-sm text-gray-500 overflow-hidden text-ellipsis whitespace-nowrap cursor-help">{experiment.name}</p>

              <div className="absolute top-full mt-2 left-0 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 max-w-[280px] break-words">
                <div className="break-words">{displayName}</div>
                <div className="text-gray-300 break-words">{experiment.name}</div>
                <div className="text-gray-400">ID: {experiment.id}</div>
                <div className="absolute bottom-full left-4 w-0 h-0 border-4 border-transparent border-b-gray-900"></div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )

  const actions = (
    <>
      {!editingName && (
        <ExperimentActions experimentId={experiment.id} />
      )}
    </>
  )

  return (
    <div className="p-4">
      <Header
        title={titleContent}
        onBack={handleBack}
      />

      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {loading && (
            <div className="flex items-center text-sm text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              Loading...
            </div>
          )}
          <Badge variant={getExperimentStateBadgeVariant(experiment.state || experiment.status || 'created')}>
            {getExperimentStateLabel(experiment.state || experiment.status || 'created')}
          </Badge>
        </div>
        {!editingName && (
          <div className="flex items-center gap-1">
            {actions}
          </div>
        )}
      </div>

      <div className="space-y-4">

        <ExperimentMetadata
          data={metadata}
          onChange={(newMetadata) => {
            setMetadata(newMetadata)
          }}
          canEdit={true}
          applications={applications}
          unitTypes={unitTypes}
          owners={owners}
          teams={teams}
          tags={tags}
        />

        {currentVariants.length > 0 && (
          <VariantList
            initialVariants={currentVariants}
            experimentId={experiment.id}
            experimentName={experiment.name}
            onVariantsChange={handleVariantsChange}
            canEdit={true}
            canAddRemove={canAddVariants}
            domFieldName={domFieldName}
            onNavigateToAI={onNavigateToAI}
            autoNavigateToAI={autoNavigateToAI}
          />
        )}

        {currentVariants.length > 0 && currentVariants[0] && (
          <ExperimentCodeInjection
            experimentId={experiment.id}
            variantIndex={0}
            initialCode={extractInjectionCode(currentVariants[0])}
            domChangesUrlFilter={extractDomChangesUrlFilter(currentVariants[0])}
            onChange={handleInjectionCodeChange}
            canEdit={experiment.state !== 'running' && experiment.state !== 'development'}
          />
        )}

        {(experiment.state === 'running' || experiment.state === 'development') && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-yellow-800">
                <strong>Experiment is {experiment.state === 'development' ? 'in development' : 'running'}.</strong> Changes cannot be saved while the experiment is active. Restart the experiment to make changes.
              </p>
            </div>
          </div>
        )}

        <div className="pt-4 flex gap-2">
          <Button
            onClick={handleSaveChanges}
            variant="primary"
            size="sm"
            disabled={loading || saving || experiment.state === 'running' || experiment.state === 'development'}
            className={hasUnsavedChanges ? 'ring-2 ring-yellow-400' : ''}
            title={
              experiment.state === 'running' || experiment.state === 'development'
                ? 'Stop the experiment to save changes'
                : saving
                ? 'Saving...'
                : hasUnsavedChanges
                ? 'Save your changes'
                : 'No changes to save'
            }
          >
            {saving ? 'Saving...' : hasUnsavedChanges ? '• Save Changes' : 'Save Changes'}
          </Button>
        </div>
      </div>


    </div>
  )
}
