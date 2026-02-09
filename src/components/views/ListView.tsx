import React from "react"
import { ExperimentList } from "~src/components/ExperimentList"
import { ExperimentFilter } from "~src/components/ExperimentFilter"
import { Pagination } from "~src/components/Pagination"
import { Button } from "~src/components/ui/Button"
import { Logo } from "~src/components/Logo"
import { CreateExperimentDropdown, CreateExperimentDropdownPanel } from "~src/components/CreateExperimentDropdown"
import { SDKStatusAlert } from "~src/components/SDKStatusAlert"
import { useSDKStatus } from "~src/hooks/useSDKStatus"
import { CogIcon, ArrowPathIcon, BoltIcon } from "@heroicons/react/24/outline"
import type { Experiment, ABsmartlyConfig, Application } from "~src/types/absmartly"
import type { ExperimentFilters } from "~src/types/filters"
import type { View } from "~src/types/view"

interface ListViewProps {
  config: ABsmartlyConfig | null
  filteredExperiments: Experiment[]
  experimentsLoading: boolean
  favoriteExperiments: Set<number>
  filters: ExperimentFilters | null
  applications: Application[]
  currentPage: number
  pageSize: number
  totalExperiments: number
  hasMore: boolean
  error: string | null
  isAuthenticated: boolean
  createPanelOpen: boolean
  templates: Experiment[]
  templatesLoading: boolean
  templateSearchQuery: string
  onExperimentClick: (experiment: Experiment) => void
  onToggleFavorite: (experimentId: number) => void
  onFilterChange: (filterState: any, callback: (filters: ExperimentFilters) => void) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onRefresh: () => void
  onCreateFromScratch: () => void
  onCreateFromTemplate: (templateId: number) => void
  onLoginRedirect: () => void
  setCurrentPage: (page: number) => void
  setView: (view: View) => void
  setCreatePanelOpen: (open: boolean) => void
  setTemplateSearchQuery: (query: string) => void
  loadExperiments: (force?: boolean, page?: number, pageSize?: number, filters?: ExperimentFilters) => Promise<void>
}

export function ListView({
  config,
  filteredExperiments,
  experimentsLoading,
  favoriteExperiments,
  filters,
  applications,
  currentPage,
  pageSize,
  totalExperiments,
  hasMore,
  error,
  isAuthenticated,
  createPanelOpen,
  templates,
  templatesLoading,
  templateSearchQuery,
  onExperimentClick,
  onToggleFavorite,
  onFilterChange,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  onCreateFromScratch,
  onCreateFromTemplate,
  onLoginRedirect,
  setCurrentPage,
  setView,
  setCreatePanelOpen,
  setTemplateSearchQuery,
  loadExperiments
}: ListViewProps) {
  const { sdkDetected, checking } = useSDKStatus()

  return (
    <>
      <div className="border-b px-4 py-3 flex-shrink-0 relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Logo config={config} />
            <h1 id="experiments-heading" className="text-lg font-semibold">Experiments</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="refresh-experiments-button"
              onClick={onRefresh}
              className={`p-2 hover:bg-gray-100 rounded-md transition-colors ${experimentsLoading ? 'animate-spin' : ''}`}
              aria-label="Refresh experiments"
              title="Refresh experiments"
              disabled={experimentsLoading}
            >
              <ArrowPathIcon className="h-5 w-5 text-gray-600" />
            </button>
            <CreateExperimentDropdown
              onCreateFromScratch={onCreateFromScratch}
              isOpen={createPanelOpen}
              onOpenChange={setCreatePanelOpen}
            />
            <button
              id="nav-events"
              onClick={() => setView('events')}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              aria-label="Events Debug"
              title="Events Debug"
            >
              <BoltIcon className="h-5 w-5 text-gray-600" />
            </button>
            <button
              id="nav-settings"
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
            onFilterChange={(filterState) => onFilterChange(filterState, (newFilters) => {
              setCurrentPage(1)
              loadExperiments(false, 1, pageSize, newFilters)
            })}
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
            onCreateFromScratch()
          }}
          onTemplateSelect={(templateId) => {
            setCreatePanelOpen(false)
            onCreateFromTemplate(templateId)
          }}
          config={config}
        />
      </div>
      {!isAuthenticated && (
        <div role="alert" className="bg-blue-50 text-blue-700 px-4 py-2 text-sm">
          <div className="flex items-center justify-between">
            <span>You are not logged in. Log in to load fresh experiments.</span>
            <Button
              onClick={onLoginRedirect}
              size="sm"
              variant="primary"
              className="ml-2"
            >
              Login
            </Button>
          </div>
        </div>
      )}
      {error && isAuthenticated && (
        <div role="alert" className="bg-red-50 text-red-700 px-4 py-2 text-sm">
          {error}
        </div>
      )}
      {!checking && (
        <div className="px-4 pt-4">
          <SDKStatusAlert sdkDetected={sdkDetected} />
        </div>
      )}
      <div className="flex-1 flex flex-col">
        <ExperimentList
          experiments={filteredExperiments}
          onExperimentClick={onExperimentClick}
          loading={experimentsLoading}
          favoriteExperiments={favoriteExperiments}
          onToggleFavorite={onToggleFavorite}
        />
        <Pagination
          currentPage={currentPage}
          totalPages={totalExperiments ? Math.ceil(totalExperiments / pageSize) : 0}
          pageSize={pageSize}
          totalItems={totalExperiments}
          hasMore={hasMore}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          loading={experimentsLoading}
        />
      </div>
    </>
  )
}
