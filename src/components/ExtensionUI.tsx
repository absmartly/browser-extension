import React, { useEffect, useRef } from "react"
import { debugLog } from '~src/utils/debug'

import { ExperimentDetail } from "~src/components/ExperimentDetail"
import { ExperimentEditor } from "~src/components/ExperimentEditor"
import { SettingsView } from "~src/components/SettingsView"
import EventsDebugPage from "~src/components/EventsDebugPage"
import { Button } from "~src/components/ui/Button"
import { CookieConsentModal } from "~src/components/CookieConsentModal"
import { ListView } from "~src/components/views/ListView"
import { AIDOMChangesView } from "~src/components/views/AIDOMChangesView"
import { NotificationProvider } from "~src/contexts/NotificationContext"
import { useABsmartly } from "~src/hooks/useABsmartly"
import { usePermissions } from "~src/hooks/usePermissions"
import { useExperimentFilters } from "~src/hooks/useExperimentFilters"
import { useExperimentLoading } from "~src/hooks/useExperimentLoading"
import { useEditorResources } from "~src/hooks/useEditorResources"
import { useFavorites } from "~src/hooks/useFavorites"
import { useTemplates } from "~src/hooks/useTemplates"
import { useViewNavigation } from "~src/hooks/useViewNavigation"
import { useExperimentHandlers } from "~src/hooks/useExperimentHandlers"
import { useSidebarState } from "~src/hooks/useSidebarState"
import { useExtensionState } from "~src/hooks/useExtensionState"
import { useExperimentInitialization } from "~src/hooks/useExperimentInitialization"
import { useLoginRedirect } from "~src/hooks/useLoginRedirect"
import { useNotifications } from "~src/contexts/NotificationContext"
import type { ABsmartlyConfig } from "~src/types/absmartly"
import "~style.css"

function SidebarContent() {
  const { showError, showSuccess } = useNotifications()
  const {
    client,
    config,
    loading: configLoading,
    user,
    isAuthenticated,
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

  const {
    needsPermissions,
    requestPermissionsIfNeeded,
    handleGrantPermissions,
    handleDenyPermissions
  } = usePermissions(config)

  const {
    view,
    setView,
    aiDomContext,
    autoNavigateToAI,
    setAutoNavigateToAI,
    handleNavigateToAI,
    handleBackFromAI
  } = useViewNavigation()

  const {
    filters,
    filtersLoaded,
    handleFilterChange,
    setFilters
  } = useExperimentFilters(config)

  const {
    error,
    setError,
    setIsAuthExpired,
    createPanelOpen,
    setCreatePanelOpen,
    hasInitialized,
    setHasInitialized,
    handleAuthExpired
  } = useExtensionState({
    config
  })

  const {
    filteredExperiments,
    experimentsLoading,
    currentPage,
    pageSize,
    totalExperiments,
    hasMore,
    loadExperiments,
    loadCachedExperiments,
    handlePageChange,
    handlePageSizeChange,
    setCurrentPage
  } = useExperimentLoading({
    getExperiments,
    requestPermissionsIfNeeded,
    onAuthExpired: setIsAuthExpired,
    onError: setError
  })

  const {
    selectedExperiment,
    setSelectedExperiment,
    experimentDetailLoading,
    setExperimentDetailLoading,
    handleExperimentClick,
    handleStartExperiment,
    handleStopExperiment,
    handleCreateExperiment,
    handleCreateFromTemplate,
    handleSaveExperiment,
    handleUpdateExperiment
  } = useExperimentHandlers({
    getExperiment,
    startExperiment,
    stopExperiment,
    createExperiment,
    updateExperiment,
    loadExperiments,
    onAuthExpired: handleAuthExpired,
    onError: showError,
    onSuccess: showSuccess,
    setView,
    pageSize
  })

  const {
    applications,
    unitTypes,
    metrics,
    tags,
    owners,
    teams,
    loadEditorResources,
    setApplications
  } = useEditorResources({
    config,
    isAuthenticated,
    getApplications,
    getUnitTypes,
    getMetrics,
    getExperimentTags,
    getOwners,
    getTeams,
    requestPermissionsIfNeeded
  })

  const {
    favoriteExperiments,
    loadFavorites,
    handleToggleFavorite
  } = useFavorites({
    getFavorites,
    setExperimentFavorite,
    requestPermissionsIfNeeded,
    onError: showError
  })

  const {
    templates,
    templatesLoading,
    templateSearchQuery,
    setTemplateSearchQuery
  } = useTemplates({
    getTemplates,
    createPanelOpen
  })

  useSidebarState({
    getExperiment,
    setSelectedExperiment,
    setExperimentDetailLoading,
    setView,
    setAutoNavigateToAI,
    selectedExperiment,
    currentView: view
  })

  useExperimentInitialization({
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
  })

  const { handleLoginRedirect } = useLoginRedirect({
    client,
    pageSize,
    filters,
    getExperiments,
    loadExperiments,
    setIsAuthExpired,
    setError
  })

  const prevViewRef = useRef<string>('list')
  useEffect(() => {
    debugLog(JSON.stringify({
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

  useEffect(() => {
    if (view === 'list' && currentPage !== 1) {
      setCurrentPage(1)
    }
  }, [view, currentPage, setCurrentPage])

  useEffect(() => {
    const handleAIDispatch = () => {
      const ctx = (window as any).__absmartlyAIContext
      if (!ctx) return
      handleNavigateToAI(
        ctx.variantName,
        ctx.onGenerate,
        ctx.currentChanges,
        ctx.onRestoreChanges,
        ctx.onPreviewToggle,
        ctx.onPreviewRefresh,
        ctx.onPreviewWithChanges
      )
    }

    window.addEventListener('absmartly:navigate-ai', handleAIDispatch as EventListener)
    return () => window.removeEventListener('absmartly:navigate-ai', handleAIDispatch as EventListener)
  }, [handleNavigateToAI])

  useEffect(() => {
    const handleAIClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return

      const button = target.closest('#generate-with-ai-button') as HTMLElement | null
      if (!button) return

      const variantName = button.getAttribute('data-variant-name') || ''
      const map = (window as any).__absmartlyAIContextMap || {}
      const ctx = map[variantName]
      if (!ctx) return

      handleNavigateToAI(
        ctx.variantName,
        ctx.onGenerate,
        ctx.currentChanges,
        ctx.onRestoreChanges,
        ctx.onPreviewToggle,
        ctx.onPreviewRefresh,
        ctx.onPreviewWithChanges
      )
    }

    document.addEventListener('click', handleAIClick)
    return () => document.removeEventListener('click', handleAIClick)
  }, [handleNavigateToAI])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && (!isAuthenticated || error) && config && view === 'list') {
        debugLog('Document became visible with error state, attempting to refresh...')
        loadExperiments(true, 1, pageSize)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isAuthenticated, error, config, view, pageSize, loadExperiments])

  const handleSettingsSave = (newConfig: Partial<ABsmartlyConfig>) => {
    updateConfig({ ...config, ...newConfig } as ABsmartlyConfig)
    setView('list')
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
          <Button id="configure-settings-button" onClick={() => setView('settings')}>
            Configure Settings
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-screen bg-white flex flex-col">
      {view === 'list' && (
        <ListView
          config={config}
          filteredExperiments={filteredExperiments}
          experimentsLoading={experimentsLoading}
          favoriteExperiments={favoriteExperiments}
          filters={filters}
          applications={applications}
          currentPage={currentPage}
          pageSize={pageSize}
          totalExperiments={totalExperiments}
          hasMore={hasMore}
          error={error}
          isAuthenticated={isAuthenticated}
          createPanelOpen={createPanelOpen}
          templates={templates}
          templatesLoading={templatesLoading}
          templateSearchQuery={templateSearchQuery}
          onExperimentClick={handleExperimentClick}
          onToggleFavorite={handleToggleFavorite}
          onFilterChange={handleFilterChange}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          onRefresh={() => {
            loadExperiments(true, 1, pageSize)
            loadEditorResources()
            loadFavorites()
          }}
          onCreateFromScratch={handleCreateExperiment}
          onCreateFromTemplate={handleCreateFromTemplate}
          onLoginRedirect={handleLoginRedirect}
          setCurrentPage={setCurrentPage}
          setView={setView}
          setCreatePanelOpen={setCreatePanelOpen}
          setTemplateSearchQuery={setTemplateSearchQuery}
          loadExperiments={loadExperiments}
        />
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
            onUpdate={handleUpdateExperiment}
            loading={experimentDetailLoading}
            onError={showError}
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

      {view === 'ai-dom-changes' && (
        <AIDOMChangesView
          aiDomContext={aiDomContext}
          onBackFromAI={handleBackFromAI}
        />
      )}

      <CookieConsentModal
        isOpen={needsPermissions}
        onGrant={() => handleGrantPermissions(
          () => {
            showSuccess('Permissions granted. Reloading...')
            setTimeout(() => {
              setIsAuthExpired(false)
              setError(null)
              loadExperiments(true)
            }, 500)
          },
          (message) => {
            setError(message)
            showError(message)
          }
        )}
        onDeny={handleDenyPermissions}
      />
    </div>
  )
}

export default function ExtensionSidebar() {
  return (
    <NotificationProvider>
      <SidebarContent />
    </NotificationProvider>
  )
}
