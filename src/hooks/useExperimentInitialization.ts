import { useEffect } from "react"
import { debugLog, debugError } from '~src/utils/debug'
import { localAreaStorage } from "~src/utils/storage"
import { setExperimentsCache } from "~src/utils/storage"
import type { ABsmartlyConfig, Application, UnitType } from "~src/types/absmartly"
import type { ExperimentFilters } from "~src/types/filters"

interface UseExperimentInitializationProps {
  config: ABsmartlyConfig | null
  isAuthenticated: boolean
  view: string
  hasInitialized: boolean
  experimentsLoading: boolean
  filtersLoaded: boolean
  filters: ExperimentFilters | null
  applications: Application[]
  unitTypes: UnitType[]
  pageSize: number
  setHasInitialized: (initialized: boolean) => void
  getApplications: () => Promise<Application[]>
  setApplications: (apps: Application[]) => void
  setFilters: (filters: ExperimentFilters) => void
  loadExperiments: (force?: boolean, page?: number, pageSize?: number, filters?: ExperimentFilters) => Promise<void>
  loadFavorites: () => Promise<void>
  loadEditorResources: () => Promise<void>
}

export function useExperimentInitialization({
  config,
  isAuthenticated,
  view,
  hasInitialized,
  experimentsLoading,
  filtersLoaded,
  filters,
  applications,
  unitTypes,
  pageSize,
  setHasInitialized,
  getApplications,
  setApplications,
  setFilters,
  loadExperiments,
  loadFavorites,
  loadEditorResources
}: UseExperimentInitializationProps) {
  useEffect(() => {
    if (config && isAuthenticated && view === 'list' && !hasInitialized && !experimentsLoading && filtersLoaded && filters) {
      debugLog('Initializing experiments for this session with filters:', filters)
      setHasInitialized(true)

      getApplications().then(apps => {
        if (apps && apps.length > 0) {
          setApplications(apps)

          const storage = localAreaStorage
          storage.get('pendingApplicationFilter').then(appName => {
            if (appName) {
              const app = apps.find(a => a.name === appName)
              if (app) {
                const appId = app.id ?? app.application_id
                if (appId) {
                  const newFilters = {
                    ...filters,
                    applications: [appId]
                  }
                  setFilters(newFilters)
                  storage.set('experimentFilters', newFilters)
                  storage.remove('pendingApplicationFilter')
                  loadExperiments(false, 1, pageSize, newFilters)
                } else {
                  loadExperiments(false)
                }
              } else {
                loadExperiments(false)
              }
            } else {
              loadExperiments(false)
            }
          })
        } else {
          loadExperiments(false)
        }
      }).catch(error => {
        debugError('Failed to load applications:', error)
        loadExperiments(false)
      })

      loadFavorites()
    }
  }, [config, isAuthenticated, view, hasInitialized, experimentsLoading, filtersLoaded, filters, getApplications, loadExperiments, pageSize, loadFavorites, setApplications, setFilters, setHasInitialized])

  useEffect(() => {
    if (config && isAuthenticated && view === 'list' && applications.length === 0) {
      debugLog('Loading applications for filter')
      getApplications().then(apps => {
        if (apps && apps.length > 0) {
          setApplications(apps)
        }
      }).catch(error => {
        debugError('Failed to load applications for filter:', error)
      })
    }
  }, [config, isAuthenticated, view, applications.length, getApplications, setApplications])

  useEffect(() => {
    if ((view === 'create' || view === 'edit') && config && isAuthenticated && unitTypes.length === 0) {
      debugLog('Loading editor resources for create/edit view')
      loadEditorResources()
    }
  }, [view, config, isAuthenticated, unitTypes.length, loadEditorResources])
}
