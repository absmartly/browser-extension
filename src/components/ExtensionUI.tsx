import React, { useState, useEffect } from "react"
import { debugLog, debugError, debugWarn } from '~src/utils/debug'

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

function SidebarContent() {
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
  
  // Resource states for ExperimentEditor
  const [applications, setApplications] = useState<any[]>([])
  const [unitTypes, setUnitTypes] = useState<any[]>([])
  const [metrics, setMetrics] = useState<any[]>([])
  const [tags, setTags] = useState<any[]>([])
  const [owners, setOwners] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  
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
    setExperimentFavorite,
    getApplications,
    getUnitTypes,
    getMetrics,
    getExperimentTags,
    getOwners,
    getTeams
  } = useABsmartly()

  // Track if we've initialized experiments for this session
  const [hasInitialized, setHasInitialized] = useState(false)
  const [filtersInitialized, setFiltersInitialized] = useState(false)
  
  // Load experiments when switching to list view AND filters are loaded
  useEffect(() => {
    if (config && view === 'list' && !hasInitialized && !experimentsLoading && filtersLoaded && filters) {
      debugLog('Initializing experiments for this session with filters:', filters)
      setHasInitialized(true)
      
      // Load applications first, then check for pending application filter
      getApplications().then(apps => {
        if (apps && apps.length > 0) {
          setApplications(apps)
          
          // Check if we have a pending application filter from config
          const storage = new Storage({ area: "local" })
          storage.get('pendingApplicationFilter').then(appName => {
            if (appName) {
              // Find the application by name
              const app = apps.find(a => a.name === appName)
              if (app) {
                // Update filters to include this application
                const newFilters = {
                  ...filters,
                  applications: [app.id]
                }
                setFilters(newFilters)
                // Save the updated filters
                storage.set('experimentFilters', newFilters)
                // Remove the pending filter
                storage.remove('pendingApplicationFilter')
                // Load experiments with the new filter
                loadExperiments(false, 1, pageSize, newFilters)
              } else {
                // Application not found, load without filter
                loadExperiments(false)
              }
            } else {
              // No pending filter, load normally
              loadExperiments(false)
            }
          })
        } else {
          // No applications available, load normally
          loadExperiments(false)
        }
      }).catch(error => {
        debugError('Failed to load applications:', error)
        // Continue without applications
        loadExperiments(false)
      })
      
      loadFavorites()
    }
  }, [config, view, hasInitialized, filtersLoaded, filters])

  // Load editor resources when switching to create or edit view
  useEffect(() => {
    if (config && (view === 'create' || view === 'edit')) {
      debugLog('Loading editor resources for view:', view)
      loadEditorResources()
    }
  }, [config, view])
  
  // Load applications for filter when they're not loaded yet
  useEffect(() => {
    if (config && view === 'list' && applications.length === 0) {
      debugLog('Loading applications for filter')
      getApplications().then(apps => {
        if (apps && apps.length > 0) {
          setApplications(apps)
        }
      }).catch(error => {
        debugError('Failed to load applications for filter:', error)
      })
    }
  }, [config, view, applications.length])

  // Restore sidebar state and filters when component mounts
  useEffect(() => {
    const storage = new Storage({ area: "local" })
    
    // Restore sidebar state
    storage.get('sidebarState').then(result => {
      if (result) {
        debugLog('Restoring sidebar state:', result)
        const state = result
        if (state.view) setView(state.view)
        if (state.selectedExperiment) setSelectedExperiment(state.selectedExperiment)
        // Don't clear the state - keep it for next time
      }
    })
    
    // Restore filters and check for configured application
    Promise.all([
      storage.get('experimentFilters'),
      storage.get('absmartly-config')
    ]).then(([savedFilters, savedConfig]) => {
      debugLog('Loading saved filters:', savedFilters)
      debugLog('Loading config for app filter:', savedConfig)
      
      let defaultFilters = {
        state: ['created', 'ready']  // 'created' maps to 'Draft' in the UI
      }
      
      // If there's a configured application, we'll need to load applications first
      // to get the application ID for filtering
      if (savedConfig?.applicationName) {
        // Store the application name for later use
        storage.set('pendingApplicationFilter', savedConfig.applicationName)
      }
      
      if (savedFilters) {
        setFilters(savedFilters)
      } else {
        setFilters(defaultFilters)
      }
      setFiltersLoaded(true)
    })
    
    // Load favorites from server
    if (config) {
      loadFavorites()
    }
  }, [])

  // Save sidebar state whenever view or selectedExperiment changes
  useEffect(() => {
    const storage = new Storage({ area: "local" })
    const state = {
      view,
      selectedExperiment,
      timestamp: Date.now()
    }
    storage.set('sidebarState', state)
    debugLog('Saved sidebar state:', state)
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
      debugError('Failed to load favorites:', error)
      // Continue without favorites if the call fails
    }
  }

  const loadEditorResources = async () => {
    debugLog('Loading editor resources...')
    try {
      const [apps, units, metricsData, tagsData, ownersData, teamsData] = await Promise.all([
        getApplications(),
        getUnitTypes(),
        getMetrics(),
        getExperimentTags(),
        getOwners(),
        getTeams()
      ])
      debugLog('Editor resources loaded:', {
        apps: apps?.length || 0,
        units: units?.length || 0,
        metricsData: metricsData?.length || 0,
        tagsData: tagsData?.length || 0,
        ownersData: ownersData?.length || 0,
        teamsData: teamsData?.length || 0
      })
      setApplications(apps || [])
      setUnitTypes(units || [])
      setMetrics(metricsData || [])
      setTags(tagsData || [])
      setOwners(ownersData || [])
      setTeams(teamsData || [])
    } catch (error) {
      debugError('Failed to load editor resources:', error)
      // Continue with empty arrays if the call fails
    }
  }

  const loadExperiments = async (forceRefresh = false, page = currentPage, size = pageSize, customFilters = null) => {
    setExperimentsLoading(true)
    setError(null)
    
    const activeFilters = customFilters || filters
    
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
      if (activeFilters.search && activeFilters.search.trim()) {
        params.search = activeFilters.search.trim()
      }
      
      // State filter
      if (activeFilters.state && activeFilters.state.length > 0) {
        params.state = activeFilters.state.join(',')
      }
      
      // Significance filter
      if (activeFilters.significance && activeFilters.significance.length > 0) {
        params.significance = activeFilters.significance.join(',')
      }
      
      // Owners filter
      if (activeFilters.owners && activeFilters.owners.length > 0) {
        params.owners = activeFilters.owners.join(',')
      }
      
      // Teams filter  
      if (activeFilters.teams && activeFilters.teams.length > 0) {
        params.teams = activeFilters.teams.join(',')
      }
      
      // Tags filter
      if (activeFilters.tags && activeFilters.tags.length > 0) {
        params.tags = activeFilters.tags.join(',')
      }
      
      // Applications filter
      if (activeFilters.applications && activeFilters.applications.length > 0) {
        params.applications = activeFilters.applications.join(',')
      }
      
      // Boolean filters
      if (activeFilters.sample_ratio_mismatch === true) params.sample_ratio_mismatch = true
      if (activeFilters.cleanup_needed === true) params.cleanup_needed = true
      if (activeFilters.audience_mismatch === true) params.audience_mismatch = true
      if (activeFilters.sample_size_reached === true) params.sample_size_reached = true
      if (activeFilters.experiments_interact === true) params.experiments_interact = true
      if (activeFilters.assignment_conflict === true) params.assignment_conflict = true
      
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
          debugWarn('Failed to cache experiments:', cacheError)
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
      debugError('Failed to load experiments:', err)
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
      debugError('Failed to update favorite:', error)
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
        debugWarn('getExperiment returned null/undefined, using cached data')
        // Use the cached data as fallback - handle nested structure
        const experimentData = experiment.experiment || experiment
        setSelectedExperiment(experimentData)
      }
    } catch (err: any) {
      debugError('Failed to fetch full experiment details:', err)
      // Use cached data on error - also handle nested structure
      const experimentData = experiment.experiment || experiment
      setSelectedExperiment(experimentData)
      
      // Check if this is an authentication error
      if (err.isAuthError || err.message === 'AUTH_EXPIRED') {
        setIsAuthExpired(true)
        setError('Your session has expired. Please log in again.')
      } else {
        debugWarn('API fetch failed, continuing with cached experiment data')
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
      debugError('Failed to start experiment:', err)
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
      debugError('Failed to stop experiment:', err)
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
      debugError('Failed to save experiment:', err)
    }
  }

  const handleFilterChange = (filterState: any) => {
    debugLog('handleFilterChange called with:', filterState)
    debugLog('Current filters:', filters)
    
    // Mark filters as initialized on first call
    if (!filtersInitialized) {
      setFiltersInitialized(true)
    }
    
    const hasActualChange = JSON.stringify(filterState) !== JSON.stringify(filters)
    debugLog('Has actual change:', hasActualChange)
    
    if (hasActualChange) {
      setFilters(filterState)
      // Save filters to storage
      const storage = new Storage({ area: "local" })
      storage.set('experimentFilters', filterState)
      debugLog('Filter changed, reloading experiments')
      // Reset to first page when filters change
      setCurrentPage(1)
      // Need to pass the new filter state directly since state update is async
      loadExperimentsWithFilters(filterState, 1, pageSize)
    } else {
      debugLog('No actual change detected, not reloading')
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
          debugWarn('Failed to cache experiments:', cacheError)
        }
      }
    } catch (err: any) {
      if (err.isAuthError || err.message === 'AUTH_EXPIRED') {
        setIsAuthExpired(true)
        setError('Your session has expired. Please log in again.')
      } else {
        setError('Failed to load experiments. Please check your API settings.')
      }
      debugError('Failed to load experiments:', err)
      setExperiments([])
      setFilteredExperiments([])
    } finally {
      setExperimentsLoading(false)
    }
  }

  const handleLoginRedirect = async () => {
    try {
      setExperimentsLoading(true)
      setError(null)

      // First, always try to refresh experiments
      // This will verify if the session is still valid
      debugLog('Attempting to refresh experiments before login redirect...')

      // Try to fetch experiments directly to check if session is valid
      const params: any = {
        page: 1,
        items: pageSize,
        iterations: 1,
        previews: 1,
        type: 'test'
      }

      // Apply current filters
      if (filters?.state && filters.state.length > 0) {
        params.state = filters.state.join(',')
      }

      try {
        const response = await getExperiments(params)
        // If we got here, the session is valid
        debugLog('Session is still valid, refreshing experiments')
        setIsAuthExpired(false)
        setError(null)

        // Update the experiments state with the fresh data
        const experiments = response.experiments || []
        setExperiments(experiments)
        setFilteredExperiments(experiments)
        setTotalExperiments(response.total)
        setHasMore(response.hasMore || false)
        setCurrentPage(1)

        // Cache the results
        try {
          await setExperimentsCache(experiments)
        } catch (cacheError) {
          debugWarn('Failed to cache experiments:', cacheError)
        }
      } catch (err: any) {
        // Check if this is an authentication error
        if (err.isAuthError || err.message === 'AUTH_EXPIRED') {
          debugLog('Session is expired, opening login page')
          // Open login page directly - the background script will check auth first
          const result = await client.openLogin()

          if (!result?.authenticated) {
            // Login page was opened
            // No need to close window - we're in a sidebar now
          }
          // If authenticated, the error state remains to show the user
        } else {
          // Non-auth error
          setError('Failed to load experiments. Please check your connection.')
        }
      }
    } catch (err) {
      debugError('Failed to handle login:', err)
      setError('Failed to handle login. Please try again.')
    } finally {
      setExperimentsLoading(false)
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
                <span className="px-2 py-0.5 text-xs font-semibold text-blue-600 bg-blue-100 rounded-md">BETA</span>
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
                applications={applications}
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
              debugError('Failed to update experiment:', err)
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
          applications={applications}
          unitTypes={unitTypes}
          metrics={metrics}
          tags={tags}
          owners={owners}
          teams={teams}
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

export default function ExtensionSidebar() {
  return <SidebarContent />
}
