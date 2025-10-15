import React, { useState, useEffect } from 'react'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'

import { Storage } from '@plasmohq/storage'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'
import type { Experiment } from '~src/types/absmartly'
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
import type { ExperimentInjectionCode } from '~src/types/absmartly'
import type { URLFilter, DOMChangesData } from '~src/types/dom-changes'

const storage = new Storage({ area: "local" })

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
}

// Removed - now using Variant from VariantList

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
  tags = []
}: ExperimentDetailProps) {
  debugLog('🔍 ExperimentDetail render start - experiment:', experiment)
  debugLog('🔍 ExperimentDetail render start - experiment.variants:', experiment?.variants)
  debugLog('🔍 ExperimentDetail render start - loading:', loading)
  debugLog('🔍 ExperimentDetail props - unitTypes:', unitTypes?.length, 'owners:', owners?.length, 'tags:', tags?.length)

  // Always in edit mode - removed isEditing state
  const [editingName, setEditingName] = useState(false)
  const [displayName, setDisplayName] = useState(experiment.display_name || experiment.name)
  const [domFieldName, setDomFieldName] = useState<string>('__dom_changes')

  // Use hooks
  const { initialVariants, currentVariants, hasUnsavedChanges, setHasUnsavedChanges, handleVariantsChange } = useExperimentVariants({
    experiment,
    domFieldName
  })
  const { save } = useExperimentSave({ experiment, domFieldName })
  const [metadata, setMetadata] = useState({
    percentage_of_traffic: experiment.percentage_of_traffic || 100,
    unit_type_id: experiment.unit_type?.unit_type_id || null,
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


  const handleSaveDisplayName = () => {
    if (onUpdate && displayName !== experiment.display_name) {
      onUpdate(experiment.id, { display_name: displayName })
    }
    setEditingName(false)
  }

  const handleSaveChanges = async () => {
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
    
    // Reset unsaved changes flag after successful save
    setHasUnsavedChanges(false)
  }

  // Helper functions for code injection
  const extractInjectionCode = (variant: Variant): ExperimentInjectionCode | undefined => {
    if (!variant || !variant.config) return undefined
    const injectHtml = variant.config.__inject_html
    if (!injectHtml) return undefined
    return typeof injectHtml === 'string' ? JSON.parse(injectHtml) : injectHtml
  }

  const extractDomChangesUrlFilter = (variant: Variant): URLFilter | undefined => {
    if (!variant || !variant.config) return undefined
    const domChanges: DOMChangesData = variant.config.__dom_changes
    if (!domChanges || Array.isArray(domChanges)) return undefined
    return domChanges.urlFilter
  }

  const handleInjectionCodeChange = (code: ExperimentInjectionCode) => {
    debugLog('🔧 handleInjectionCodeChange called with code:', code)
    debugLog('🔧 Current currentVariants[0]:', currentVariants[0])
    const updatedVariants = [...currentVariants]
    if (updatedVariants[0]) {
      updatedVariants[0] = {
        ...updatedVariants[0],
        config: {
          ...updatedVariants[0].config,
          __inject_html: code
        }
      }
      debugLog('🔧 Updated variant config:', updatedVariants[0].config)
      handleVariantsChange(updatedVariants, true)
    }
  }

  const canAddVariants = experiment.state !== 'running' &&
                         experiment.state !== 'development' &&
                         experiment.status !== 'running'

  const handleBack = () => {
    // Cleanup function to stop VE and Preview
    const cleanup = () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          // Stop Visual Editor
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'STOP_VISUAL_EDITOR'
          })
          
          // Remove Preview
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'ABSMARTLY_PREVIEW',
            action: 'remove',
            experimentName: experiment.name
          })
        }
      })
    }

    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Do you want to discard them?')) {
        const storageKey = `experiment-${experiment.id}-variants`
        debugLog('🧹 User chose to discard changes for experiment', experiment.id)
        storage.remove(storageKey).then(() => {
          debugLog('🧹 Cleared variant data from storage for experiment', experiment.id)
          cleanup()
          onBack()
        }).catch(error => {
          debugError('Failed to clear storage:', error)
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

            {/* Click to edit tooltip */}
            <div className="absolute top-full mt-2 left-0 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
              Click to edit
              <div className="absolute bottom-full left-4 w-0 h-0 border-4 border-transparent border-b-gray-900"></div>
            </div>
          </div>

          {displayName !== experiment.name && (
            <div className="relative group">
              <p className="text-sm text-gray-500 overflow-hidden text-ellipsis whitespace-nowrap cursor-help">{experiment.name}</p>

              {/* Experiment info tooltip */}
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

      {/* Status badge and actions */}
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

        {/* Metadata Section */}
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

        {/* Variants Section */}
        {currentVariants.length > 0 && (
          <VariantList
            initialVariants={currentVariants}
            experimentId={experiment.id}
            experimentName={experiment.name}
            onVariantsChange={handleVariantsChange}
            canEdit={true}
            canAddRemove={canAddVariants}
            domFieldName={domFieldName}
          />
        )}

        {/* Code Injection Section - Only for control variant */}
        {currentVariants.length > 0 && currentVariants[0] && (() => {
          const canEditValue = experiment.state !== 'running' && experiment.state !== 'development'
          debugLog('[ExperimentDetail] Rendering CodeInjection - Experiment state:', experiment.state, 'canEdit:', canEditValue)
          return (
            <ExperimentCodeInjection
              experimentId={experiment.id}
              variantIndex={0}
              initialCode={extractInjectionCode(currentVariants[0])}
              domChangesUrlFilter={extractDomChangesUrlFilter(currentVariants[0])}
              onChange={handleInjectionCodeChange}
              canEdit={canEditValue}
            />
          )
        })()}

        {/* Warning for running/development experiments */}
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

        {/* Action Buttons */}
        <div className="pt-4 flex gap-2">
          <Button
            onClick={handleSaveChanges}
            variant="primary"
            size="sm"
            disabled={loading || experiment.state === 'running' || experiment.state === 'development'}
            className={hasUnsavedChanges ? 'ring-2 ring-yellow-400' : ''}
            title={
              experiment.state === 'running' || experiment.state === 'development'
                ? 'Stop the experiment to save changes'
                : hasUnsavedChanges
                ? 'Save your changes'
                : 'No changes to save'
            }
          >
            {hasUnsavedChanges ? '• Save Changes' : 'Save Changes'}
          </Button>
          {/* TODO: Implement Start/Stop experiment functionality
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
          {(experiment.state === 'running' || experiment.status === 'running') && (
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
          */}
        </div>
      </div>
      

    </div>
  )
}
