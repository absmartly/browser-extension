import React, { useState, useEffect, useCallback, useRef } from "react"
import { debugLog, debugError, debugWarn } from '~src/utils/debug'

import { Storage } from "@plasmohq/storage"
import { ExperimentList } from "~src/components/ExperimentList"
import { ExperimentDetail } from "~src/components/ExperimentDetail"
import { ExperimentEditor } from "~src/components/ExperimentEditor"
import { ExperimentFilter } from "~src/components/ExperimentFilter"
import { SettingsView } from "~src/components/SettingsView"
import EventsDebugPage from "~src/components/EventsDebugPage"
import { AIDOMChangesPage } from "~src/components/AIDOMChangesPage"
import { Pagination } from "~src/components/Pagination"
import { Button } from "~src/components/ui/Button"
import { ErrorBoundary } from "~src/components/ErrorBoundary"
import { Toast } from "~src/components/Toast"
import { CookieConsentModal } from "~src/components/CookieConsentModal"
import { useABsmartly } from "~src/hooks/useABsmartly"
import type { Experiment, ABsmartlyConfig, Application, ExperimentTag, ExperimentUser, ExperimentTeam } from "~src/types/absmartly"
import type { SidebarState, ExperimentFilters } from "~src/types/storage-state"
import type { DOMChange, AIDOMGenerationResult } from "~src/types/dom-changes"
import { CogIcon, PlusIcon, ArrowPathIcon, BoltIcon } from "@heroicons/react/24/outline"
import { CreateExperimentDropdown, CreateExperimentDropdownPanel } from "~src/components/CreateExperimentDropdown"
import { getExperimentsCache, setExperimentsCache } from "~src/utils/storage"
import { clearAllExperimentStorage } from "~src/utils/storage-cleanup"
import { Logo } from "~src/components/Logo"
import "~style.css"

type View = 'list' | 'detail' | 'settings' | 'create' | 'edit' | 'events' | 'ai-dom-changes'

// Helper function to build API parameters from filter state
const buildFilterParams = (filterState: ExperimentFilters, page: number, size: number) => {
  const params: Record<string, unknown> = {
    page,
    items: size,
    iterations: 1,
    previews: 1,
    type: 'test'
  }

  // Add all filter parameters
  if (filterState.search?.trim()) {
    params.search = filterState.search.trim()
  }

  // Array filters - join with commas
  if (filterState.state?.length > 0) {
    params.state = filterState.state.join(',')
  }
  if (filterState.significance?.length > 0) {
    params.significance = filterState.significance.join(',')
  }
  if (filterState.owners?.length > 0) {
    params.owners = filterState.owners.join(',')
  }
  if (filterState.teams?.length > 0) {
    params.teams = filterState.teams.join(',')
  }
  if (filterState.tags?.length > 0) {
    params.tags = filterState.tags.join(',')
  }
  if (filterState.applications?.length > 0) {
    params.applications = filterState.applications.join(',')
  }

  // Boolean filters
  if (filterState.sample_ratio_mismatch === true) params.sample_ratio_mismatch = true
  if (filterState.cleanup_needed === true) params.cleanup_needed = true
  if (filterState.audience_mismatch === true) params.audience_mismatch = true
  if (filterState.sample_size_reached === true) params.sample_size_reached = true
  if (filterState.experiments_interact === true) params.experiments_interact = true
  if (filterState.assignment_conflict === true) params.assignment_conflict = true

  return params
}

function SidebarContent() {
  const [view, setView] = useState<View>('list')
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null)
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [filteredExperiments, setFilteredExperiments] = useState<Experiment[]>([])
  const [experimentsLoading, setExperimentsLoading] = useState(false)
  const [experimentDetailLoading, setExperimentDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAuthExpired, setIsAuthExpired] = useState(false)
  const [needsPermissions, setNeedsPermissions] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  // AI DOM Changes state
  const [aiDomContext, setAiDomContext] = useState<{
    variantName: string
    onGenerate: (prompt: string, images?: string[], conversationSession?: import('~src/types/absmartly').ConversationSession | null) => Promise<AIDOMGenerationResult>
    currentChanges: DOMChange[]
    onRestoreChanges: (changes: DOMChange[]) => void
    onPreviewToggle: (enabled: boolean) => void
    onPreviewRefresh: () => void
    previousView: View
  } | null>(null)

  // Flag to auto-navigate to AI page after experiment detail loads (used for state restoration)
  const [autoNavigateToAI, setAutoNavigateToAI] = useState<string | null>(null)

  const handleNavigateToAI = useCallback((
    variantName: string,
    onGenerate: (prompt: string, images?: string[], conversationSession?: import('~src/types/absmartly').ConversationSession | null) => Promise<AIDOMGenerationResult>,
    currentChanges: DOMChange[],
    onRestoreChanges: (changes: DOMChange[]) => void,
    onPreviewToggle: (enabled: boolean) => void,
    onPreviewRefresh: () => void
  ) => {
    setAiDomContext({
      variantName,
      onGenerate,
      currentChanges,
      onRestoreChanges,
      onPreviewToggle,
      onPreviewRefresh,
      previousView: view
    })
    setView('ai-dom-changes')
    setAutoNavigateToAI(null)
  }, [view])

  const handleBackFromAI = useCallback(() => {
    if (aiDomContext) {
      setView(aiDomContext.previousView)
    }
  }, [aiDomContext])

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [totalExperiments, setTotalExperiments] = useState<number | undefined>()
  const [hasMore, setHasMore] = useState(false)
  
  // Filter state - loaded from storage or default
  const [filters, setFilters] = useState<ExperimentFilters | null>(null)
  const [filtersLoaded, setFiltersLoaded] = useState(false)
  
  // Favorite experiments state
  const [favoriteExperiments, setFavoriteExperiments] = useState<Set<number>>(new Set())
  
  // Resource states for ExperimentEditor
  const [applications, setApplications] = useState<Application[]>([])
  const [unitTypes, setUnitTypes] = useState<unknown[]>([])
  const [metrics, setMetrics] = useState<unknown[]>([])
  const [tags, setTags] = useState<ExperimentTag[]>([])
  const [owners, setOwners] = useState<ExperimentUser[]>([])
  const [teams, setTeams] = useState<ExperimentTeam[]>([])
  
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
    getTeams,
    getTemplates
  } = useABsmartly()

  // Handler to actually request permissions (called from modal button click)
  const handleGrantPermissions = async () => {
    console.log('[ExtensionUI] handleGrantPermissions called - requesting permissions')

    try {
      // First check what we currently have
      const currentCookies = await chrome.permissions.contains({ permissions: ['cookies'] })
      const currentHost = await chrome.permissions.contains({ origins: ['https://*.absmartly.com/*'] })
      console.log('[ExtensionUI] Current permissions before request - cookies:', currentCookies, 'host:', currentHost)

      // Request cookies permission first
      console.log('[ExtensionUI] Requesting cookies permission...')
      const cookiesGranted = await chrome.permissions.request({
        permissions: ['cookies']
      })
      console.log('[ExtensionUI] Cookies permission result:', cookiesGranted)

      // Request host permission separately
      console.log('[ExtensionUI] Requesting host permission...')
      const hostGranted = await chrome.permissions.request({
        origins: ['https://*.absmartly.com/*']
      })
      console.log('[ExtensionUI] Host permission result:', hostGranted)

      // Verify what we have now
      const finalCookies = await chrome.permissions.contains({ permissions: ['cookies'] })
      const finalHost = await chrome.permissions.contains({ origins: ['https://*.absmartly.com/*'] })
      console.log('[ExtensionUI] Final permissions after request - cookies:', finalCookies, 'host:', finalHost)

      if (cookiesGranted && hostGranted) {
        console.log('[ExtensionUI] ✅ All permissions granted!')
        setNeedsPermissions(false)

        // Check if permissions were already granted (no dialog shown)
        if (currentCookies && currentHost) {
          console.log('[ExtensionUI] ⚠️ Permissions were already granted - JWT cookie might be missing or expired')
          setError('You have permissions but authentication failed. Please log in to ABsmartly in your browser first.')
          setToast({ message: 'Please log in to ABsmartly first', type: 'error' })
        } else {
          setToast({ message: 'Permissions granted. Reloading...', type: 'success' })
          setTimeout(() => {
            setIsAuthExpired(false)
            setError(null)
            loadExperiments(true)
          }, 500)
        }
      } else {
        console.error('[ExtensionUI] ❌ User denied some permissions - cookies:', cookiesGranted, 'host:', hostGranted)
        setNeedsPermissions(false)
        setError('Cookie and host permissions are required for JWT authentication.')
      }
    } catch (err) {
      console.error('[ExtensionUI] Error requesting permissions:', err)
      setNeedsPermissions(false)
      setError('Failed to request permissions. Please try again.')
    }
  }

  const handleDenyPermissions = useCallback(() => {
    console.log('[ExtensionUI] User denied permissions')
    setNeedsPermissions(false)
    setError('Cookie permissions are required to use JWT authentication.')
  }, [])

  // Show permission modal when we get AUTH_EXPIRED
  const requestPermissionsIfNeeded = useCallback(async (forceRequest = false): Promise<boolean> => {
    console.log('[ExtensionUI] requestPermissionsIfNeeded called, forceRequest:', forceRequest)

    // Only request permissions if using JWT auth
    if (config?.authMethod !== 'jwt') {
      console.log('[ExtensionUI] Not using JWT auth, skipping permission request')
      return false
    }

    try {
      // Check if we already have permissions first
      const hasCookies = await chrome.permissions.contains({ permissions: ['cookies'] })
      const hasHost = await chrome.permissions.contains({ origins: ['https://*.absmartly.com/*'] })

      console.log('[ExtensionUI] Permission status - cookies:', hasCookies, 'host:', hasHost)

      if (hasCookies && hasHost) {
        console.log('[ExtensionUI] ✅ Already have all permissions')
        return false
      }

      // Show the modal (user must click button to grant)
      console.log('[ExtensionUI] 🔐 Missing permissions - showing modal...')
      setNeedsPermissions(true)
      return false // Will be granted via modal
    } catch (err) {
      console.error('[ExtensionUI] Error checking permissions:', err)
      return false
    }
  }, [config?.authMethod])

  // Check permissions on mount if using JWT
  useEffect(() => {
    if (config?.authMethod === 'jwt') {
      console.log('[ExtensionUI] Checking permissions on mount (JWT auth detected)')
      chrome.permissions.contains({
        permissions: ['cookies'],
        origins: ['https://*.absmartly.com/*']
      }).then(hasPermission => {
        if (!hasPermission) {
          console.warn('[ExtensionUI] ⚠️ Missing cookie permissions! Will request on first API call.')
        } else {
          console.log('[ExtensionUI] ✅ Cookie permissions already granted')
        }
      })
    }
  }, [config?.authMethod])

  // DIAGNOSTIC: Track view state changes
  const prevViewRef = useRef<View>('list')
  useEffect(() => {
    console.log(JSON.stringify({
      type: 'STATE_CHANGE',
      component: 'ExtensionUI',
      event: 'VIEW_CHANGED',
      timestamp: Date.now(),
      oldView: prevViewRef.current,
      newView: view,
      aiDomContextSet: !!aiDomContext
    }))
    prevViewRef.current = view
  }, [view, aiDomContext])

  // DIAGNOSTIC: Track handleNavigateToAI callback changes
  useEffect(() => {
    console.log(JSON.stringify({
      type: 'CALLBACK_CHANGE',
      component: 'ExtensionUI',
      event: 'NAVIGATE_TO_AI_CALLBACK_CHANGED',
      timestamp: Date.now()
    }))
  }, [handleNavigateToAI])

  // Auto-refresh experiments when user returns after logging in
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && (isAuthExpired || error) && config && view === 'list') {
        debugLog('Document became visible with error state, attempting to refresh...')
        loadExperiments(true, 1, pageSize)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isAuthExpired, error, config, view, pageSize])

  // Track if we've initialized experiments for this session
  const [hasInitialized, setHasInitialized] = useState(false)
  const [filtersInitialized, setFiltersInitialized] = useState(false)

  // Create experiment panel state
  const [createPanelOpen, setCreatePanelOpen] = useState(false)
  const [templates, setTemplates] = useState<Experiment[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templateSearchQuery, setTemplateSearchQuery] = useState("")
  
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
  }, [config, view, hasInitialized, filtersLoaded])



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
    storage.get<SidebarState>('sidebarState').then(state => {
      if (state) {
        debugLog('Restoring sidebar state:', state)
        if (state.selectedExperiment) {
          setSelectedExperiment(state.selectedExperiment as unknown as Experiment)
        }
        if (state.aiDomContext) {
          setAiDomContext(state.aiDomContext)
        }

        // Handle AI page restoration
        if (state.view === 'ai-dom-changes' && state.aiVariantName && state.aiDomContext) {
          debugLog('Restoring AI page with variant:', state.aiVariantName)
          setView('ai-dom-changes')
        } else if (state.view && state.view !== 'ai-dom-changes') {
          setView(state.view as View)
        }
        // Don't clear the state - keep it for next time
      }
    })

    // Restore filters and check for configured application
    Promise.all([
      storage.get<ExperimentFilters>('experimentFilters'),
      storage.get<ABsmartlyConfig>('absmartly-config')
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
  }, [])

  // Save sidebar state whenever view or selectedExperiment changes
  useEffect(() => {
    const storage = new Storage({ area: "local" })
    const state = {
      view,
      selectedExperiment,
      aiVariantName: aiDomContext?.variantName,
      aiDomContext,
      timestamp: Date.now()
    }
    storage.set('sidebarState', state)
    debugLog('Saved sidebar state:', state)
  }, [view, selectedExperiment, aiDomContext])

  // Reset to first page when switching to list view
  useEffect(() => {
    if (view === 'list' && currentPage !== 1) {
      setCurrentPage(1)
    }
  }, [view])

  // Load templates when panel opens
  useEffect(() => {
    if (createPanelOpen && templates.length === 0) {
      const loadTemplates = async () => {
        setTemplatesLoading(true)
        try {
          const data = await getTemplates('test_template')
          setTemplates(data)
        } catch (error) {
          console.error('Failed to load templates:', error)
          setTemplates([])
        } finally {
          setTemplatesLoading(false)
        }
      }
      loadTemplates()
    }
  }, [createPanelOpen])

  const loadFavorites = async () => {
    try {
      const favoriteIds = await getFavorites()
      setFavoriteExperiments(new Set(favoriteIds))
    } catch (err: unknown) {
      const error = err as { isAuthError?: boolean; message?: string }
      if (error.isAuthError || error.message === 'AUTH_EXPIRED') {
        console.log('[loadFavorites] AUTH_EXPIRED error detected')
        // Check if permissions are missing - only show modal if they are
        const permissionsGranted = await requestPermissionsIfNeeded(true)
        if (permissionsGranted) {
          // Retry loading after permissions granted
          console.log('[loadFavorites] Retrying after permissions granted...')
          setTimeout(() => loadFavorites(), 500)
        }
      }
      debugError('Failed to load favorites:', error)
      // Continue without favorites if the call fails
    }
  }

  const loadEditorResources = useCallback(async () => {
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
    } catch (err: unknown) {
      const error = err as { isAuthError?: boolean; message?: string }
      if (error.isAuthError || error.message === 'AUTH_EXPIRED') {
        console.log('[loadEditorResources] AUTH_EXPIRED error detected')
        // Check if permissions are missing - only show modal if they are
        const permissionsGranted = await requestPermissionsIfNeeded(true)
        if (permissionsGranted) {
          // Retry loading after permissions granted
          console.log('[loadEditorResources] Retrying after permissions granted...')
          setTimeout(() => loadEditorResources(), 500)
        }
      }
      debugError('Failed to load editor resources:', error)
      // Continue with empty arrays if the call fails
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestPermissionsIfNeeded])

  // Load editor resources when config is available (regardless of view)
  // This ensures resources are loaded when:
  // - Refreshing directly on detail page then navigating to edit
  // - Opening extension for the first time on any page
  useEffect(() => {
    if (config && unitTypes.length === 0) {
      debugLog('Loading editor resources (config available, resources not loaded)')
      loadEditorResources()
    }
  }, [config, unitTypes.length, loadEditorResources])

  // Also load resources when switching to create/edit view if not loaded
  useEffect(() => {
    if ((view === 'create' || view === 'edit') && config && unitTypes.length === 0) {
      debugLog('Loading editor resources for create/edit view')
      loadEditorResources()
    }
  }, [view, config, unitTypes.length, loadEditorResources])

  const loadExperiments = async (forceRefresh = false, page = currentPage, size = pageSize, customFilters = null) => {
    const stack = new Error().stack
    debugLog('=== loadExperiments called ===')
    debugLog('Called from:', stack?.split('\n').slice(2, 5).join('\n'))
    debugLog('Params:', { forceRefresh, page, size, hasCustomFilters: !!customFilters })

    setExperimentsLoading(true)
    setError(null)

    const activeFilters = customFilters || filters

    try {
      // Build API parameters using helper function
      const params = buildFilterParams(activeFilters, page, size)

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
    } catch (err: unknown) {
      // Check if this is an authentication error
      const error = err as { isAuthError?: boolean; message?: string }
      if (error.isAuthError || error.message === 'AUTH_EXPIRED') {
        console.log('[loadExperiments] AUTH_EXPIRED error detected')
        setIsAuthExpired(true)

        // Check if permissions are missing - only show modal if they are
        const permissionsGranted = await requestPermissionsIfNeeded(true)

        if (permissionsGranted) {
          // Retry loading after permissions granted
          console.log('[loadExperiments] Retrying after permissions granted...')
          setTimeout(() => loadExperiments(true, page, size, customFilters), 500)
        } else {
          // If permissions check didn't show modal, user is likely logged out
          setError('Your session has expired. Please log in again.')
        }
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
    // Clear storage when opening detail view to prevent stale data
    await clearAllExperimentStorage(experiment.id)

    // Don't set the partial experiment first to avoid re-renders
    setView('detail')
    setExperimentDetailLoading(true)

    // Always fetch full experiment details since we now cache minimal data only
    // The cached data doesn't include variant configs to save space
    try {
      const fullExperiment = await getExperiment(experiment.id)
      if (fullExperiment) {
        setSelectedExperiment(fullExperiment)
      } else {
        debugWarn('getExperiment returned null/undefined, using cached data')
        setSelectedExperiment(experiment)
      }
    } catch (err: any) {
      debugError('Failed to fetch full experiment details:', err)
      // Use cached data on error
      setSelectedExperiment(experiment)
      
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

  const handleSettingsSave = (newConfig: Partial<ABsmartlyConfig>) => {
    updateConfig(newConfig)
    setView('list')
  }

  const handleCreateExperiment = async () => {
    await clearAllExperimentStorage(0)
    setSelectedExperiment(null)
    setView('create')
  }

  const handleCreateFromTemplate = async (templateId: number) => {
    try {
      await clearAllExperimentStorage(0)
      const template = await getExperiment(templateId)
      // Load template with cleared name/display_name, matching ABsmartly frontend behavior
      setSelectedExperiment({
        ...template,
        id: undefined as any, // Clear ID so it creates new experiment
        name: '',
        display_name: ''
      })
      setView('create')
    } catch (err) {
      console.error('Failed to load template:', err)
      setError('Failed to load template')
    }
  }

  const handleEditExperiment = async (experiment: Experiment) => {
    await clearAllExperimentStorage(experiment.id)
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
      loadExperiments(true, 1, pageSize)
      setToast({ message: 'Experiment saved successfully!', type: 'success' })
    } catch (err: any) {
      if (err.isAuthError || err.message === 'AUTH_EXPIRED') {
        setIsAuthExpired(true)
        setError('Your session has expired. Please log in again.')
      } else {
        const errorMessage = err.message || 'Failed to save experiment'
        setToast({ message: errorMessage, type: 'error' })
      }
      debugError('Failed to save experiment:', err)
    }
  }

  const handleFilterChange = (filterState: ExperimentFilters) => {
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
  const loadExperimentsWithFilters = async (filterState: ExperimentFilters, page = currentPage, size = pageSize) => {
    const stack = new Error().stack
    debugLog('=== loadExperimentsWithFilters called ===')
    debugLog('Called from:', stack?.split('\n').slice(2, 5).join('\n'))
    debugLog('Params:', { page, size, filterState })

    setExperimentsLoading(true)
    setError(null)

    try {
      // Build API parameters using helper function
      const params = buildFilterParams(filterState, page, size)

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
      const params: Record<string, unknown> = {
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
          <div className="border-b px-4 py-3 flex-shrink-0 relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Logo config={config} />
                <h1 className="text-lg font-semibold">Experiments</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    loadExperiments(true, 1, pageSize)
                    loadEditorResources()
                    loadFavorites()
                  }}
                  className={`p-2 hover:bg-gray-100 rounded-md transition-colors ${experimentsLoading ? 'animate-spin' : ''}`}
                  aria-label="Refresh experiments"
                  title="Refresh experiments"
                  disabled={experimentsLoading}
                >
                  <ArrowPathIcon className="h-5 w-5 text-gray-600" />
                </button>
                <CreateExperimentDropdown
                  onCreateFromScratch={handleCreateExperiment}
                  isOpen={createPanelOpen}
                  onOpenChange={setCreatePanelOpen}
                />
                <button
                  onClick={() => setView('events')}
                  className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                  aria-label="Events Debug"
                  title="Events Debug"
                >
                  <BoltIcon className="h-5 w-5 text-gray-600" />
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

            <CreateExperimentDropdownPanel
              isOpen={createPanelOpen}
              templates={templates}
              loading={templatesLoading}
              searchQuery={templateSearchQuery}
              onSearchChange={setTemplateSearchQuery}
              onCreateFromScratch={() => {
                setCreatePanelOpen(false)
                handleCreateExperiment()
              }}
              onTemplateSelect={(templateId) => {
                setCreatePanelOpen(false)
                handleCreateFromTemplate(templateId)
              }}
              config={config}
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
            applications={applications}
            unitTypes={unitTypes}
            owners={owners}
            teams={teams}
            tags={tags}
            onNavigateToAI={handleNavigateToAI}
            autoNavigateToAI={autoNavigateToAI}
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

      {view === 'events' && (
        <EventsDebugPage onBack={() => setView('list')} />
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
          onNavigateToAI={handleNavigateToAI}
        />
      )}

      {view === 'ai-dom-changes' && aiDomContext && (
        <ErrorBoundary
          fallback={
            <div className="flex flex-col items-center justify-center h-screen p-8 bg-red-50">
              <div className="text-center max-w-md">
                <h2 className="text-xl font-bold text-red-600 mb-4">
                  AI Chat Failed to Load
                </h2>
                <p className="text-sm text-gray-600 mb-6">
                  The AI chat page encountered an error. Your changes are safe.
                </p>
                <Button onClick={handleBackFromAI}>
                  ← Return to Variant Editor
                </Button>
              </div>
            </div>
          }
        >
          <AIDOMChangesPage
            variantName={aiDomContext.variantName}
            currentChanges={aiDomContext.currentChanges}
            onBack={handleBackFromAI}
            onGenerate={aiDomContext.onGenerate}
            onRestoreChanges={aiDomContext.onRestoreChanges}
            onPreviewToggle={aiDomContext.onPreviewToggle}
            onPreviewRefresh={aiDomContext.onPreviewRefresh}
          />
        </ErrorBoundary>
      )}

      {view === 'ai-dom-changes' && !aiDomContext && (
        <div className="flex flex-col items-center justify-center h-screen p-8 bg-yellow-50">
          <div className="text-center max-w-md">
            <h2 className="text-xl font-bold text-yellow-600 mb-4">
              Missing Context
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              AI chat context is missing. Please return and try again.
            </p>
            <Button onClick={handleBackFromAI}>
              ← Go Back
            </Button>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Cookie Consent Modal */}
      <CookieConsentModal
        isOpen={needsPermissions}
        onGrant={handleGrantPermissions}
        onDeny={handleDenyPermissions}
      />
    </div>
  )
}

export default function ExtensionSidebar() {
  return <SidebarContent />
}
