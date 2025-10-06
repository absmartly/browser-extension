import React, { useState, useEffect } from 'react'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'

import { Storage } from '@plasmohq/storage'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'
import type { Experiment } from '~src/types/absmartly'
import { Header } from './Header'
import { PencilIcon, CheckIcon, XMarkIcon, PlayIcon, StopIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { VariantList } from './VariantList'
import { ExperimentMetadata } from './ExperimentMetadata'
import { getConfig } from '~src/utils/storage'
import { useExperimentVariants } from '~src/hooks/useExperimentVariants'
import { useExperimentSave } from '~src/hooks/useExperimentSave'
import { ExperimentActions } from './ExperimentDetail/ExperimentActions'
import { getExperimentStateLabel, getExperimentStateBadgeVariant } from '~src/utils/experiment-state'

const storage = new Storage({ area: "local" })

interface ExperimentDetailProps {
  experiment: Experiment
  onBack: () => void
  onStart: (id: number) => void
  onStop: (id: number) => void
  onUpdate?: (id: number, updates: Partial<Experiment>) => void
  loading?: boolean
}

// Removed - now using Variant from VariantList

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
  const [domFieldName, setDomFieldName] = useState<string>('__dom_changes')

  // Use hooks
  const { initialVariants, currentVariants, hasUnsavedChanges, handleVariantsChange } = useExperimentVariants({
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
  }



  const canAddVariants = experiment.state !== 'running' &&
                         experiment.state !== 'development' &&
                         experiment.status !== 'running'

  const handleBack = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Do you want to discard them?')) {
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
    } else {
      onBack()
    }
  }

  const titleContent = (
    <div className="flex-1 min-w-0">
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
            <p className="text-sm text-gray-500 mt-1 overflow-hidden text-ellipsis whitespace-nowrap cursor-help" title={experiment.name}>{experiment.name}</p>
          )}
        </div>
      ) : (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 overflow-hidden text-ellipsis whitespace-nowrap cursor-help" title={displayName}>{displayName}</h2>
          {displayName !== experiment.name && (
            <p className="text-sm text-gray-500 overflow-hidden text-ellipsis whitespace-nowrap cursor-help" title={experiment.name}>{experiment.name}</p>
          )}
        </div>
      )}
    </div>
  )

  const actions = (
    <>
      {!editingName && (
        <>
          <button
            onClick={() => setEditingName(true)}
            className="p-1 text-gray-400 hover:text-gray-600"
            title="Edit name"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <ExperimentActions experimentId={experiment.id} />
        </>
      )}
    </>
  )

  return (
    <div className="p-4">
      <Header
        title={titleContent}
        onBack={handleBack}
        actions={actions}
      />

      {/* Status badge */}
      <div className="mb-4 flex items-center gap-2">
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

      <div className="space-y-4">

        {/* Metadata Section */}
        <ExperimentMetadata
          data={metadata}
          onChange={(newMetadata) => {
            setMetadata(newMetadata)
          }}
          canEdit={true}
        />

        {/* Variants Section */}
        {currentVariants.length > 0 && (
          <VariantList
            initialVariants={initialVariants}
            experimentId={experiment.id}
            experimentName={experiment.name}
            onVariantsChange={handleVariantsChange}
            canEdit={true}
            canAddRemove={canAddVariants}
          />
        )}

        {/* Warning for running/development experiments */}
        {(experiment.state === 'running' || experiment.state === 'development' || experiment.state === 'running_not_full_on') && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-yellow-800">
                <strong>Experiment is {experiment.state === 'development' ? 'in development' : 'running'}.</strong> Changes cannot be saved while the experiment is active. Stop the experiment to make changes.
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
