import React, { useState, useEffect } from "react"
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
import { CogIcon, PlusIcon, ArrowPathIcon } from "@heroicons/react/24/outline"
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
  
  // Filter state - loaded from storage or default
  const [filters, setFilters] = useState<any>(null)
  const [filtersLoaded, setFiltersLoaded] = useState(false)
  
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
    updateExperiment,
    getFavorites,
    setExperimentFavorite
  } = useABsmartly()

  // Track if we've initialized experiments for this session
  const [hasInitialized, setHasInitialized] = useState(false)
  const [filtersInitialized, setFiltersInitialized] = useState(false)
  
  // Load experiments when switching to list view AND filters are loaded
  useEffect(() => {
    if (config && view === 'list' && !hasInitialized && !experimentsLoading && filtersLoaded && filters) {
      console.log('Initializing experiments for this session with filters:', filters)
      setHasInitialized(true)
      loadExperiments(false)
      loadFavorites()
    }
  }, [config, view, hasInitialized, filtersLoaded, filters])

  // Restore popup state and filters when component mounts
  useEffect(() => {
    const storage = new Storage({ area: "local" })
    
    // Restore popup state
    storage.get('popupState').then(result => {
      if (result) {
        console.log('Restoring popup state:', result)
        const state = result
        if (state.view) setView(state.view)
        if (state.selectedExperiment) setSelectedExperiment(state.selectedExperiment)
        // Don't clear the state - keep it for next time
      }
    })
    
    // Restore filters
    storage.get('experimentFilters').then(result => {
      console.log('Loading saved filters:', result)
      if (result) {
        setFilters(result)
      } else {
        // Use default filters if none saved
        setFilters({
          state: ['created', 'ready']  // 'created' maps to 'Draft' in the UI
        })
      }
      setFiltersLoaded(true)
    })
    
    // Load favorites from server
    if (config) {
      loadFavorites()
    }
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

  const loadFavorites = async () => {
    try {
      const favoriteIds = await getFavorites()
      setFavoriteExperiments(new Set(favoriteIds))
    } catch (error) {
      console.error('Failed to load favorites:', error)
      // Continue without favorites if the call fails
    }
  }

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
      
      // Add all filter parameters
      if (filters.search && filters.search.trim()) {
        params.search = filters.search.trim()
      }
      
      // State filter
      if (filters.state && filters.state.length > 0) {
        params.state = filters.state.join(',')
      }
      
      // Significance filter
      if (filters.significance && filters.significance.length > 0) {
        params.significance = filters.significance.join(',')
      }
      
      // Owners filter
      if (filters.owners && filters.owners.length > 0) {
        params.owners = filters.owners.join(',')
      }
      
      // Teams filter  
      if (filters.teams && filters.teams.length > 0) {
        params.teams = filters.teams.join(',')
      }
      
      // Tags filter
      if (filters.tags && filters.tags.length > 0) {
        params.tags = filters.tags.join(',')
      }
      
      // Applications filter
      if (filters.applications && filters.applications.length > 0) {
        params.applications = filters.applications.join(',')
      }
      
      // Boolean filters
      if (filters.sample_ratio_mismatch === true) params.sample_ratio_mismatch = true
      if (filters.cleanup_needed === true) params.cleanup_needed = true
      if (filters.audience_mismatch === true) params.audience_mismatch = true
      if (filters.sample_size_reached === true) params.sample_size_reached = true
      if (filters.experiments_interact === true) params.experiments_interact = true
      if (filters.assignment_conflict === true) params.assignment_conflict = true
      
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
    const isFavorite = favoriteExperiments.has(experimentId)
    const newFavorite = !isFavorite
    
    // Optimistically update UI
    const newFavorites = new Set(favoriteExperiments)
    if (newFavorite) {
      newFavorites.add(experimentId)
    } else {
      newFavorites.delete(experimentId)
    }
    setFavoriteExperiments(newFavorites)
    
    try {
      // Update on server
      await setExperimentFavorite(experimentId, newFavorite)
    } catch (error) {
      console.error('Failed to update favorite:', error)
      // Revert on error
      const revertedFavorites = new Set(favoriteExperiments)
      if (isFavorite) {
        revertedFavorites.add(experimentId)
      } else {
        revertedFavorites.delete(experimentId)
      }
      setFavoriteExperiments(revertedFavorites)
      setToast({ message: 'Failed to update favorite', type: 'error' })
    }
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
    console.log('handleFilterChange called with:', filterState)
    console.log('Current filters:', filters)
    
    // Mark filters as initialized on first call
    if (!filtersInitialized) {
      setFiltersInitialized(true)
    }
    
    const hasActualChange = JSON.stringify(filterState) !== JSON.stringify(filters)
    console.log('Has actual change:', hasActualChange)
    
    if (hasActualChange) {
      setFilters(filterState)
      // Save filters to storage
      const storage = new Storage({ area: "local" })
      storage.set('experimentFilters', filterState)
      console.log('Filter changed, reloading experiments')
      // Reset to first page when filters change
      setCurrentPage(1)
      // Need to pass the new filter state directly since state update is async
      loadExperimentsWithFilters(filterState, 1, pageSize)
    } else {
      console.log('No actual change detected, not reloading')
    }
  }
  
  // Helper function to load experiments with specific filters
  const loadExperimentsWithFilters = async (filterState: any, page = currentPage, size = pageSize) => {
    setExperimentsLoading(true)
    setError(null)
    
    try {
      const params: any = {
        page: page,
        items: size,
        iterations: 1,
        previews: 1,
        type: 'test'
      }
      
      // Add all filter parameters using the passed filterState
      if (filterState.search && filterState.search.trim()) {
        params.search = filterState.search.trim()
      }
      
      // State filter
      if (filterState.state && filterState.state.length > 0) {
        params.state = filterState.state.join(',')
      }
      
      // Significance filter
      if (filterState.significance && filterState.significance.length > 0) {
        params.significance = filterState.significance.join(',')
      }
      
      // Owners filter
      if (filterState.owners && filterState.owners.length > 0) {
        params.owners = filterState.owners.join(',')
      }
      
      // Teams filter  
      if (filterState.teams && filterState.teams.length > 0) {
        params.teams = filterState.teams.join(',')
      }
      
      // Tags filter
      if (filterState.tags && filterState.tags.length > 0) {
        params.tags = filterState.tags.join(',')
      }
      
      // Applications filter
      if (filterState.applications && filterState.applications.length > 0) {
        params.applications = filterState.applications.join(',')
      }
      
      // Boolean filters
      if (filterState.sample_ratio_mismatch === true) params.sample_ratio_mismatch = true
      if (filterState.cleanup_needed === true) params.cleanup_needed = true
      if (filterState.audience_mismatch === true) params.audience_mismatch = true
      if (filterState.sample_size_reached === true) params.sample_size_reached = true
      if (filterState.experiments_interact === true) params.experiments_interact = true
      if (filterState.assignment_conflict === true) params.assignment_conflict = true
      
      const response = await getExperiments(params)
      const experiments = response.experiments || []
      
      setExperiments(experiments)
      setFilteredExperiments(experiments)
      setTotalExperiments(response.total)
      setHasMore(response.hasMore || false)
      setCurrentPage(page)
      setPageSize(size)
      setIsAuthExpired(false)
      
      // Cache the results only for first page
      if (page === 1) {
        try {
          await setExperimentsCache(experiments)
        } catch (cacheError) {
          console.warn('Failed to cache experiments:', cacheError)
        }
      }
    } catch (err: any) {
      if (err.isAuthError || err.message === 'AUTH_EXPIRED') {
        setIsAuthExpired(true)
        setError('Your session has expired. Please log in again.')
      } else {
        setError('Failed to load experiments. Please check your API settings.')
      }
      console.error('Failed to load experiments:', err)
      setExperiments([])
      setFilteredExperiments([])
    } finally {
      setExperimentsLoading(false)
    }
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
      <div className="w-full h-screen flex items-center justify-center">
        <div role="status" aria-label="Loading">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    )
  }

  if (!config && view !== 'settings') {
    return (
      <div className="w-full h-screen p-4">
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
    <div className="w-full h-screen bg-white flex flex-col">
      {view === 'list' && (
        <>
          <div className="border-b px-4 py-3 flex-shrink-0">
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
                  onClick={() => {
                    loadExperiments(true, 1, pageSize)
                    loadFavorites()
                  }}
                  className={`p-2 hover:bg-gray-100 rounded-md transition-colors ${experimentsLoading ? 'animate-spin' : ''}`}
                  aria-label="Refresh experiments"
                  title="Refresh experiments"
                  disabled={experimentsLoading}
                >
                  <ArrowPathIcon className="h-5 w-5 text-gray-600" />
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
            {filters && (
              <ExperimentFilter
                onFilterChange={handleFilterChange}
                initialFilters={filters}
              />
            )}
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
  return <IndexPopupContent />
}