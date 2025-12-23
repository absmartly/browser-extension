import { useEffect } from "react"
import { debugLog, debugError } from '~src/utils/debug'
import { localAreaStorage } from "~src/utils/storage"
import type { Experiment } from "~src/types/absmartly"
import type { SidebarState } from "~src/types/storage-state"
import type { View } from "~src/types/view"

interface UseSidebarStateProps {
  getExperiment: (id: number) => Promise<Experiment>
  setSelectedExperiment: (experiment: Experiment | null) => void
  setExperimentDetailLoading: (loading: boolean) => void
  setView: (view: View) => void
  setAutoNavigateToAI: (variant: string | null) => void
  selectedExperiment: Experiment | null
}

export function useSidebarState({
  getExperiment,
  setSelectedExperiment,
  setExperimentDetailLoading,
  setView,
  setAutoNavigateToAI,
  selectedExperiment
}: UseSidebarStateProps) {
  useEffect(() => {
    const storage = localAreaStorage

    storage.get<SidebarState>('sidebarState').then(async (state) => {
      if (state) {
        debugLog('Restoring sidebar state:', state)

        let restoredExperiment: Experiment | null = null

        if (state.selectedExperiment !== null && state.selectedExperiment !== undefined) {
          if (state.selectedExperiment === 0) {
            debugLog('Restoring new unsaved experiment')
            const newExperiment: Partial<Experiment> = {
              id: undefined as any,
              name: '',
              display_name: ''
            }
            setSelectedExperiment(newExperiment as Experiment)
            restoredExperiment = newExperiment as Experiment
          } else {
            try {
              debugLog('Fetching experiment by ID:', state.selectedExperiment)
              setExperimentDetailLoading(true)
              const fullExperiment = await getExperiment(state.selectedExperiment)
              setSelectedExperiment(fullExperiment)
              restoredExperiment = fullExperiment
              debugLog('Successfully restored experiment:', fullExperiment.id)
            } catch (error) {
              debugError('Failed to restore experiment:', error)
              setView('list')
              return
            } finally {
              setExperimentDetailLoading(false)
            }
          }
        }

        if (state.aiVariantName && restoredExperiment) {
          setAutoNavigateToAI(state.aiVariantName)
          setView('detail')
        } else if (state.view && state.view !== 'ai-dom-changes') {
          if (state.view === 'detail' && !state.selectedExperiment) {
            debugLog('Redirecting to list - detail view with no selected experiment')
            setView('list')
          } else {
            setView(state.view as View)
          }
        }
      }
    })
  }, [getExperiment, setSelectedExperiment, setExperimentDetailLoading, setView, setAutoNavigateToAI])

  useEffect(() => {
    const storage = localAreaStorage
    const state = {
      selectedExperiment: selectedExperiment ? (selectedExperiment.id ?? 0) : null,
      timestamp: Date.now()
    }
    storage.set('sidebarState', state)
    debugLog('Saved sidebar state:', state)
  }, [selectedExperiment])
}
