import { useState, useEffect } from "react"
import { Storage } from "@plasmohq/storage"
import { ExperimentList } from "~src/components/ExperimentList"
import { ExperimentDetail } from "~src/components/ExperimentDetail"
import { ExperimentEditor } from "~src/components/ExperimentEditor"
import { ExperimentFilter } from "~src/components/ExperimentFilter"
import { SettingsView } from "~src/components/SettingsView"
import { Pagination } from "~src/components/Pagination"
import { Button } from "~src/components/ui/Button"
import { ErrorBoundary } from "~src/components/ErrorBoundary"
import { Toast } from "~src/components/Toast"
import { useABsmartly } from "~src/hooks/useABsmartly"
import type { Experiment } from "~src/types/absmartly"
import { CogIcon, PaintBrushIcon, PlusIcon, ArrowPathIcon } from "@heroicons/react/24/outline"
import { getExperimentsCache, setExperimentsCache } from "~src/utils/storage"
import logoUrl from "data-base64:~assets/logo.png"
import "~style.css"

type View = 'list' | 'detail' | 'settings' | 'create' | 'edit'

function IndexPopupContent() {
  const [view, setView] = useState<View>('list')
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null)
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [filteredExperiments, setFilteredExperiments] = useState<Experiment[]>([])
  const [experimentsLoading, setExperimentsLoading] = useState(false)
  const [experimentDetailLoading, setExperimentDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAuthExpired, setIsAuthExpired] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [totalExperiments, setTotalExperiments] = useState<number | undefined>()
  const [hasMore, setHasMore] = useState(false)
  
  // Filter state
  const [filters, setFilters] = useState<any>({})
  
  // Favorite experiments state
  const [favoriteExperiments, setFavoriteExperiments] = useState<Set<number>>(new Set())
  
  const {
    client,
    config,
    loading: configLoading,
    updateConfig,
    getExperiments,
    getExperiment,
    startExperiment,
    stopExperiment,
    createExperiment,
    updateExperiment
  } = useABsmartly()

  // Track if we've initialized experiments for this session
  const [hasInitialized, setHasInitialized] = useState(false)
  
  // Load experiments when switching to list view
  useEffect(() => {
    if (config && view === 'list' && !hasInitialized && !experimentsLoading) {
      console.log('Initializing experiments for this session')
      setHasInitialized(true)
      loadCachedExperiments()
    }
  }, [config, view, hasInitialized])
  
  const loadCachedExperiments = async () => {
    console.log('loadCachedExperiments called')
    try {
      const cache = await getExperimentsCache()
      console.log('Cache result:', cache)
      if (cache && cache.experiments && cache.experiments.length > 0) {
        console.log('Loading experiments from cache:', cache.experiments.length)
        setExperiments(cache.experiments)
        setFilteredExperiments(cache.experiments)
        setExperimentsLoading(false)
        return
      }
      
      // Check if this is truly the first time (no cache at all)
      const storage = new Storage({ area: "local" })
      const hasLoadedBefore = await storage.get('hasLoadedExperiments')
      console.log('hasLoadedBefore:', hasLoadedBefore)
      
      if (!hasLoadedBefore) {
        console.log('First time loading, fetching initial data')
        await storage.set('hasLoadedExperiments', true)
        loadExperiments(false)
      } else {
        console.log('No cache but has loaded before, not fetching')
        // Don't set empty arrays - just leave whatever is there
        setExperimentsLoading(false)
      }
    } catch (error) {
      console.warn('Failed to load cache:', error)
      setExperimentsLoading(false)
    }
  }

  // Restore popup state when component mounts
  useEffect(() => {
    const storage = new Storage({ area: "local" })
    storage.get('popupState').then(result => {
      if (result) {
        console.log('Restoring popup state:', result)
        const state = result
        if (state.view) setView(state.view)
        if (state.selectedExperiment) setSelectedExperiment(state.selectedExperiment)
        // Don't clear the state - keep it for next time
      }
    })
    
    // Load favorites
    storage.get('favoriteExperiments').then(result => {
      if (result && Array.isArray(result)) {
        setFavoriteExperiments(new Set(result))
      }
    })
  }, [])

  // Save popup state whenever view or selectedExperiment changes
  useEffect(() => {
    const storage = new Storage({ area: "local" })
    const state = {
      view,
      selectedExperiment,
      timestamp: Date.now()
    }
    storage.set('popupState', state)
    console.log('Saved popup state:', state)
  }, [view, selectedExperiment])

  // Reset to first page when switching to list view
  useEffect(() => {
    if (view === 'list' && currentPage !== 1) {
      setCurrentPage(1)
    }
  }, [view])

  const loadExperiments = async (forceRefresh = false, page = currentPage, size = pageSize) => {
    setExperimentsLoading(true)
    setError(null)
    
    try {
      // Always fetch fresh data when this function is called
      // Cache is handled separately in loadCachedExperiments
      const params: any = {
        page: page,
        items: size,
        iterations: 1,
        previews: 1,
        type: 'test'
      }
      
      // Add filter parameters (start simple to avoid 500 errors)
      if (filters.search && filters.search.trim()) {
        params.search = filters.search.trim()
      }
      
      if (filters.state && filters.state.length > 0) {
        params.state = filters.state.join(',')
      } else {
        // Use the exact states from your example
        params.state = 'ready,created'
      }
      
      console.log('Fetching experiments with params:', params)
      const response = await getExperiments(params)
      const experiments = response.experiments || []
      
      setExperiments(experiments)
      setFilteredExperiments(experiments)
      setTotalExperiments(response.total)
      setHasMore(response.hasMore || false)
      setCurrentPage(page)
      setPageSize(size)
      setIsAuthExpired(false) // Clear auth error on successful fetch
      
      // Cache the results only for first page (but don't fail if storage is full)
      if (page === 1) {
        try {
          await setExperimentsCache(experiments)
        } catch (cacheError) {
          console.warn('Failed to cache experiments:', cacheError)
          // Continue without caching
        }
      }
    } catch (err: any) {
      // Check if this is an authentication error
      if (err.isAuthError || err.message === 'AUTH_EXPIRED') {
        setIsAuthExpired(true)
        setError('Your session has expired. Please log in again.')
      } else {
        setError('Failed to load experiments. Please check your API settings.')
      }
      console.error('Failed to load experiments:', err)
      // Set empty arrays on error to prevent crashes
      setExperiments([])
      setFilteredExperiments([])
    } finally {
      setExperimentsLoading(false)
    }
  }

  const handleToggleFavorite = async (experimentId: number) => {
    const newFavorites = new Set(favoriteExperiments)
    if (newFavorites.has(experimentId)) {
      newFavorites.delete(experimentId)
    } else {
      newFavorites.add(experimentId)
    }
    setFavoriteExperiments(newFavorites)
    
    // Save to storage
    const storage = new Storage({ area: "local" })
    await storage.set('favoriteExperiments', Array.from(newFavorites))
  }
  
  const handleExperimentClick = async (experiment: Experiment) => {
    // Don't set the partial experiment first to avoid re-renders
    setView('detail')
    setExperimentDetailLoading(true)
    
    // Always fetch full experiment details since we now cache minimal data only
    // The cached data doesn't include variant configs to save space
    try {
      const fullExperiment = await getExperiment(experiment.id)
      if (fullExperiment) {
        // Handle nested experiment structure from API
        const experimentData = fullExperiment.experiment || fullExperiment
        setSelectedExperiment(experimentData)
      } else {
        console.warn('getExperiment returned null/undefined, using cached data')
        // Use the cached data as fallback - handle nested structure
        const experimentData = experiment.experiment || experiment
        setSelectedExperiment(experimentData)
      }
    } catch (err: any) {
      console.error('Failed to fetch full experiment details:', err)
      // Use cached data on error - also handle nested structure
      const experimentData = experiment.experiment || experiment
      setSelectedExperiment(experimentData)
      
      // Check if this is an authentication error
      if (err.isAuthError || err.message === 'AUTH_EXPIRED') {
        setIsAuthExpired(true)
        setError('Your session has expired. Please log in again.')
      } else {
        console.warn('API fetch failed, continuing with cached experiment data')
        // Don't clear the experiment data - continue with what we have
      }
      // Continue with cached data if available
    } finally {
      setExperimentDetailLoading(false)
    }
  }

  const handleStartExperiment = async (id: number) => {
    try {
      const updated = await startExperiment(id)
      setSelectedExperiment(updated)
    } catch (err: any) {
      if (err.isAuthError || err.message === 'AUTH_EXPIRED') {
        setIsAuthExpired(true)
        setError('Your session has expired. Please log in again.')
      } else {
        setError('Failed to start experiment')
      }
      console.error('Failed to start experiment:', err)
    }
  }

  const handleStopExperiment = async (id: number) => {
    try {
      const updated = await stopExperiment(id)
      setSelectedExperiment(updated)
    } catch (err: any) {
      if (err.isAuthError || err.message === 'AUTH_EXPIRED') {
        setIsAuthExpired(true)
        setError('Your session has expired. Please log in again.')
      } else {
        setError('Failed to stop experiment')
      }
      console.error('Failed to stop experiment:', err)
    }
  }

  const handleSettingsSave = (newConfig: any) => {
    updateConfig(newConfig)
    setView('list')
  }

  const handleCreateExperiment = () => {
    setSelectedExperiment(null)
    setView('create')
  }

  const handleEditExperiment = (experiment: Experiment) => {
    setSelectedExperiment(experiment)
    setView('edit')
  }

  const handleSaveExperiment = async (experiment: Partial<Experiment>) => {
    try {
      if (selectedExperiment) {
        await updateExperiment(selectedExperiment.id, experiment)
      } else {
        await createExperiment(experiment)
      }
      setView('list')
      loadExperiments(true, 1, pageSize) // Refresh and go to first page
    } catch (err: any) {
      if (err.isAuthError || err.message === 'AUTH_EXPIRED') {
        setIsAuthExpired(true)
        setError('Your session has expired. Please log in again.')
      } else {
        setError('Failed to save experiment')
      }
      console.error('Failed to save experiment:', err)
    }
  }

  const handleFilterChange = (filterState: any) => {
    const hasActualChange = JSON.stringify(filterState) !== JSON.stringify(filters)
    setFilters(filterState)
    
    // Only reload if there's an actual change and we have experiments
    if (hasActualChange && experiments.length > 0) {
      console.log('Filter changed, reloading experiments')
      // Reset to first page when filters change
      setCurrentPage(1)
      // Reload experiments with new filters
      loadExperiments(true, 1, pageSize)
    }
  }

  const handleOpenVisualEditor = () => {
    chrome.runtime.sendMessage({ type: 'TOGGLE_VISUAL_EDITOR' })
    window.close()
  }

  const handleLoginRedirect = async () => {
    try {
      await client.openLogin()
      // Close the popup after opening login
      window.close()
    } catch (err) {
      console.error('Failed to open login:', err)
    }
  }

  const handlePageChange = (page: number) => {
    loadExperiments(false, page, pageSize)
  }

  const handlePageSizeChange = (size: number) => {
    // Reset to page 1 when changing page size
    setCurrentPage(1)
    setPageSize(size)
    loadExperiments(true, 1, size)
  }

  if (configLoading) {
    return (
      <div className="w-96 h-[600px] flex items-center justify-center">
        <div role="status" aria-label="Loading">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    )
  }

  if (!config && view !== 'settings') {
    return (
      <div className="w-96 h-[600px] p-4">
        <div className="flex flex-col items-center justify-center h-full space-y-4">
          <h2 className="text-lg font-semibold">Welcome to ABsmartly</h2>
          <p className="text-sm text-gray-600 text-center">
            Please configure your API settings to get started
          </p>
          <Button onClick={() => setView('settings')}>
            Configure Settings
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-96 h-[600px] bg-white">
      {view === 'list' && (
        <>
          <div className="border-b px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {config?.apiEndpoint ? (
                  <a 
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      const baseUrl = config.apiEndpoint.replace(/\/+$/, '').replace(/\/v1$/, '')
                      chrome.tabs.create({ url: baseUrl })
                    }}
                    className="cursor-pointer"
                    title="Open ABsmartly"
                  >
                    <img 
                      src={logoUrl} 
                      alt="ABsmartly" 
                      className="w-6 h-6 hover:opacity-80 transition-opacity"
                    />
                  </a>
                ) : (
                  <img 
                    src={logoUrl} 
                    alt="ABsmartly" 
                    className="w-6 h-6"
                  />
                )}
                <h1 className="text-lg font-semibold">Experiments</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadExperiments(true, 1, pageSize)}
                  className={`p-2 hover:bg-gray-100 rounded-md transition-colors ${experimentsLoading ? 'animate-spin' : ''}`}
                  aria-label="Refresh experiments"
                  title="Refresh experiments"
                  disabled={experimentsLoading}
                >
                  <ArrowPathIcon className="h-5 w-5 text-gray-600" />
                </button>
                <button
                  onClick={handleOpenVisualEditor}
                  className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                  aria-label="Visual Editor"
                  title="Open Visual Editor"
                >
                  <PaintBrushIcon className="h-5 w-5 text-gray-600" />
                </button>
                <button
                  onClick={handleCreateExperiment}
                  className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                  aria-label="Create Experiment"
                  title="Create New Experiment"
                >
                  <PlusIcon className="h-5 w-5 text-gray-600" />
                </button>
                <button
                  onClick={() => setView('settings')}
                  className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                  aria-label="Settings"
                  title="Settings"
                >
                  <CogIcon className="h-5 w-5 text-gray-600" />
                </button>
              </div>
            </div>
            <ExperimentFilter
              onFilterChange={handleFilterChange}
            />
          </div>
          {error && (
            <div role="alert" className="bg-red-50 text-red-700 px-4 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span>{error}</span>
                {isAuthExpired && (
                  <Button
                    onClick={handleLoginRedirect}
                    size="sm"
                    variant="primary"
                    className="ml-2"
                  >
                    Login
                  </Button>
                )}
              </div>
            </div>
          )}
          <div className="flex-1 flex flex-col">
            <ExperimentList
              experiments={filteredExperiments}
              onExperimentClick={handleExperimentClick}
              loading={experimentsLoading}
              favoriteExperiments={favoriteExperiments}
              onToggleFavorite={handleToggleFavorite}
            />
            <Pagination
              currentPage={currentPage}
              totalPages={totalExperiments ? Math.ceil(totalExperiments / pageSize) : 0}
              pageSize={pageSize}
              totalItems={totalExperiments}
              hasMore={hasMore}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              loading={experimentsLoading}
            />
          </div>
        </>
      )}
      
      {view === 'detail' && (
        selectedExperiment ? (
          <ExperimentDetail
            experiment={selectedExperiment}
            onBack={() => setView('list')}
            onStart={handleStartExperiment}
            onStop={handleStopExperiment}
            onUpdate={async (id, updates) => {
            try {
              // Send the update
              await updateExperiment(id, updates)
              
              // Fetch the full experiment data after successful update
              const fullExperiment = await getExperiment(id)
              setSelectedExperiment(fullExperiment)
              
              // Update the experiments list as well
              setExperiments(prev => prev.map(exp => exp.id === id ? fullExperiment : exp))
              setFilteredExperiments(prev => prev.map(exp => exp.id === id ? fullExperiment : exp))
              
              // Show success toast
              setToast({ message: 'Experiment saved successfully!', type: 'success' })
            } catch (err: any) {
              if (err.isAuthError || err.message === 'AUTH_EXPIRED') {
                setIsAuthExpired(true)
                setError('Your session has expired. Please log in again.')
              } else {
                setError('Failed to update experiment')
                setToast({ message: 'Failed to save experiment', type: 'error' })
              }
              console.error('Failed to update experiment:', err)
            }
          }}
          loading={experimentDetailLoading}
        />
      ) : (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading experiment details...</p>
          </div>
        </div>
      )
    )}
      
      {view === 'settings' && (
        <SettingsView
          onSave={handleSettingsSave}
          onCancel={() => setView('list')}
        />
      )}
      
      {(view === 'create' || view === 'edit') && (
        <ExperimentEditor
          experiment={selectedExperiment}
          onSave={handleSaveExperiment}
          onCancel={() => setView('list')}
        />
      )}
      
      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}

export default function IndexPopup() {
  return (
    <ErrorBoundary>
      <IndexPopupContent />
    </ErrorBoundary>
  )
}