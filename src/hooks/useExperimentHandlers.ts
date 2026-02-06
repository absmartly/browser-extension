import { useState, useCallback } from "react"
import { debugError, debugWarn } from '~src/utils/debug'
import { clearAllExperimentStorage } from "~src/utils/storage-cleanup"
import { APIError } from "~src/types/errors"
import type { Experiment } from "~src/types/absmartly"
import type { View } from "~src/types/view"

interface UseExperimentHandlersProps {
  getExperiment: (id: number) => Promise<Experiment>
  startExperiment: (id: number) => Promise<Experiment>
  stopExperiment: (id: number) => Promise<Experiment>
  createExperiment: (experiment: Partial<Experiment>) => Promise<Experiment>
  updateExperiment: (id: number, updates: Partial<Experiment>) => Promise<Experiment>
  loadExperiments: (force?: boolean, page?: number, pageSize?: number) => Promise<void>
  onAuthExpired: () => void
  onError: (message: string) => void
  onSuccess: (message: string) => void
  setView: (view: View) => void
  pageSize: number
}

export function useExperimentHandlers({
  getExperiment,
  startExperiment,
  stopExperiment,
  createExperiment,
  updateExperiment,
  loadExperiments,
  onAuthExpired,
  onError,
  onSuccess,
  setView,
  pageSize
}: UseExperimentHandlersProps) {
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null)
  const [experimentDetailLoading, setExperimentDetailLoading] = useState(false)

  const handleExperimentClick = useCallback(async (experiment: Experiment) => {
    try {
      await clearAllExperimentStorage(experiment.id)
    } catch (storageErr) {
      debugError('[Storage] Failed to clear experiment storage:', storageErr)
      console.error('[Storage] Storage clear failed - extension may have stale data:', {
        experimentId: experiment.id,
        error: storageErr instanceof Error ? storageErr.message : String(storageErr),
        suggestion: 'Extension may show outdated information. Consider reloading the extension.'
      })
      onError('Failed to clear storage. Extension may show outdated information.')
    }

    setView('detail')
    setExperimentDetailLoading(true)

    try {
      const fullExperiment = await getExperiment(experiment.id)
      if (fullExperiment) {
        setSelectedExperiment(fullExperiment)
      } else {
        debugWarn('getExperiment returned null/undefined, using cached data')
        setSelectedExperiment(experiment)
      }
    } catch (err) {
      const error = APIError.fromError(err)
      debugError('Failed to fetch full experiment details:', error)
      setSelectedExperiment(experiment)

      if (error.isAuthError || error.message === 'AUTH_EXPIRED') {
        onAuthExpired()
      } else {
        debugWarn('API fetch failed, continuing with cached experiment data')
      }
    } finally {
      setExperimentDetailLoading(false)
    }
  }, [getExperiment, setView, onAuthExpired, onError, setSelectedExperiment, setExperimentDetailLoading])

  const handleStartExperiment = useCallback(async (id: number) => {
    try {
      const updated = await startExperiment(id)
      setSelectedExperiment(updated)
    } catch (err) {
      const error = APIError.fromError(err)
      if (error.isAuthError || error.message === 'AUTH_EXPIRED') {
        onAuthExpired()
      } else {
        const errorMessage = error.message || 'Failed to start experiment'
        onError(errorMessage)
      }
      debugError('Failed to start experiment:', error)
    }
  }, [startExperiment, onAuthExpired, onError])

  const handleStopExperiment = useCallback(async (id: number) => {
    try {
      const updated = await stopExperiment(id)
      setSelectedExperiment(updated)
    } catch (err) {
      const error = APIError.fromError(err)
      if (error.isAuthError || error.message === 'AUTH_EXPIRED') {
        onAuthExpired()
      } else {
        const errorMessage = error.message || 'Failed to stop experiment'
        onError(errorMessage)
      }
      debugError('Failed to stop experiment:', error)
    }
  }, [stopExperiment, onAuthExpired, onError])

  const handleCreateExperiment = useCallback(async () => {
    try {
      await clearAllExperimentStorage(0)
    } catch (storageErr) {
      debugError('[Storage] Failed to clear storage for new experiment:', storageErr)
      console.error('[Storage] Storage clear failed:', storageErr)
      onError('Failed to clear storage. New experiment may have stale data.')
    }
    setSelectedExperiment(null)
    setView('create')
  }, [setView, onError])

  const handleCreateFromTemplate = useCallback(async (templateId: number) => {
    try {
      await clearAllExperimentStorage(0)
    } catch (storageErr) {
      debugError('[Storage] Failed to clear storage for template:', storageErr)
      console.error('[Storage] Storage clear failed:', storageErr)
      onError('Failed to clear storage. Template may have stale data.')
    }

    try {
      const template = await getExperiment(templateId)
      setSelectedExperiment({
        ...template,
        id: 0,
        name: '',
        display_name: ''
      })
      setView('create')
    } catch (err) {
      const error = APIError.fromError(err)
      console.error('Failed to load template:', error)
      const errorMessage = error.message || 'Failed to load template'
      onError(errorMessage)
    }
  }, [getExperiment, setView, onError])

  const handleEditExperiment = useCallback(async (experiment: Experiment) => {
    try {
      await clearAllExperimentStorage(experiment.id)
    } catch (storageErr) {
      debugError('[Storage] Failed to clear storage for edit:', storageErr)
      console.error('[Storage] Storage clear failed:', storageErr)
      onError('Failed to clear storage. Edited experiment may have stale data.')
    }
    setSelectedExperiment(experiment)
    setView('edit')
  }, [setView, onError])

  const handleSaveExperiment = useCallback(async (experiment: Partial<Experiment>) => {
    try {
      if (selectedExperiment) {
        await updateExperiment(selectedExperiment.id, experiment)
      } else {
        await createExperiment(experiment)
      }
      setView('list')
      loadExperiments(true, 1, pageSize)
      onSuccess('Experiment saved successfully!')
    } catch (err) {
      const error = APIError.fromError(err)
      if (error.isAuthError || error.message === 'AUTH_EXPIRED') {
        onAuthExpired()
      } else {
        const errorMessage = error.message || 'Failed to save experiment'
        onError(errorMessage)
      }
      debugError('Failed to save experiment:', error)
    }
  }, [selectedExperiment, updateExperiment, createExperiment, setView, loadExperiments, pageSize, onSuccess, onAuthExpired, onError])

  const handleUpdateExperiment = useCallback(async (id: number, updates: Partial<Experiment>) => {
    try {
      await updateExperiment(id, updates)

      const fullExperiment = await getExperiment(id)
      setSelectedExperiment(fullExperiment)

      loadExperiments(true, 1, pageSize)

      onSuccess('Experiment saved successfully!')
    } catch (err) {
      const error = APIError.fromError(err)
      if (error.isAuthError || error.message === 'AUTH_EXPIRED') {
        onAuthExpired()
      } else {
        const errorMessage = error.message || 'Failed to update experiment'
        onError(errorMessage)
      }
      debugError('Failed to update experiment:', error)
    }
  }, [updateExperiment, getExperiment, loadExperiments, pageSize, onSuccess, onAuthExpired, onError])

  return {
    selectedExperiment,
    setSelectedExperiment,
    experimentDetailLoading,
    setExperimentDetailLoading,
    handleExperimentClick,
    handleStartExperiment,
    handleStopExperiment,
    handleCreateExperiment,
    handleCreateFromTemplate,
    handleEditExperiment,
    handleSaveExperiment,
    handleUpdateExperiment
  }
}
