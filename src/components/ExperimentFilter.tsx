import React, { useState, useEffect } from 'react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Badge } from './ui/Badge'
import { FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface FilterState {
  search?: string
  state?: string[]
  significance?: string[]
  owners?: number[]
  teams?: number[]
  tags?: number[]
  applications?: number[]
  unit_types?: number[]
  impact?: [number, number]
  sample_ratio_mismatch?: boolean
  cleanup_needed?: boolean
  audience_mismatch?: boolean
  sample_size_reached?: boolean
  experiments_interact?: boolean
  group_sequential_updated?: boolean
  assignment_conflict?: boolean
  metric_threshold_reached?: boolean
}

interface ExperimentFilterProps {
  onFilterChange: (filters: FilterState) => void
  initialFilters?: FilterState
  users?: any[]
  teams?: any[]
  tags?: any[]
  applications?: any[]
  unitTypes?: any[]
}

const experimentStates = [
  { value: 'created', label: 'Draft' },  // Match ABsmartly UI - "created" state shows as "Draft"
  { value: 'ready', label: 'Ready' },
  { value: 'running', label: 'Running' },
  { value: 'development', label: 'Development' },
  { value: 'full_on', label: 'Full On' },
  { value: 'running_not_full_on', label: 'Running (Not Full On)' },
  { value: 'stopped', label: 'Stopped' },
  { value: 'archived', label: 'Archived' },
  { value: 'scheduled', label: 'Scheduled' }
]

const significanceOptions = [
  { value: 'positive', label: 'Positive', color: 'success' },
  { value: 'negative', label: 'Negative', color: 'danger' },
  { value: 'neutral', label: 'Neutral', color: 'default' },
  { value: 'inconclusive', label: 'Inconclusive', color: 'warning' }
]

export function ExperimentFilter({
  onFilterChange,
  initialFilters,
  users = [],
  teams = [],
  tags = [],
  applications = [],
  unitTypes = []
}: ExperimentFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [filters, setFilters] = useState<FilterState>(
    initialFilters || {
      state: ['created', 'ready']  // Default to Draft and Ready
    }
  )
  const [searchDebounce, setSearchDebounce] = useState(initialFilters?.search || '')

  // Call onFilterChange with initial filters on mount
  useEffect(() => {
    if (initialFilters) {
      setFilters(initialFilters)
      setSearchDebounce(initialFilters.search || '')
    }
    onFilterChange(filters)
  }, []) // Only run once on mount

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchDebounce !== filters.search) {
        updateFilter('search', searchDebounce)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchDebounce])

  const updateFilter = (key: keyof FilterState, value: any) => {
    const newFilters = { ...filters, [key]: value }
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      delete newFilters[key]
    }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const toggleArrayFilter = (key: keyof FilterState, value: any) => {
    const current = filters[key] as any[] || []
    const newValue = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]
    updateFilter(key, newValue)
  }

  const clearFilters = () => {
    const defaultFilters = { state: ['created', 'ready'] }
    setFilters(defaultFilters)
    setSearchDebounce('')
    onFilterChange(defaultFilters)
    // Also clear from storage
    if ((window as any).chrome?.storage?.local) {
      (window as any).chrome.storage.local.remove('experimentFilters')
    }
  }

  // Calculate active filter count (excluding default state filter)
  const activeFilterCount = Object.keys(filters).reduce((count, key) => {
    // Skip if it's the default state filter
    if (key === 'state') {
      const stateFilters = filters.state || []
      // Check if it's exactly the default filters
      if (stateFilters.length === 2 && 
          stateFilters.includes('created') && 
          stateFilters.includes('ready')) {
        return count  // Don't count default state filter
      }
    }
    // Skip empty values
    const value = filters[key as keyof FilterState]
    if (value === undefined || value === '' || 
        (Array.isArray(value) && value.length === 0)) {
      return count
    }
    return count + 1
  }, 0)

  return (
    <div className="border-b">
      <div className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search experiments..."
            value={searchDebounce}
            onChange={(e) => setSearchDebounce(e.target.value)}
            className="flex-1"
          />
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsExpanded(!isExpanded)
              }}
              className={`p-2 rounded-md transition-colors cursor-pointer ${
                isExpanded ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-600'
              }`}
              aria-label="Toggle filters"
              data-testid="filter-toggle"
            >
              <FunnelIcon className="h-5 w-5" />
            </button>
            {activeFilterCount > 0 && (
              <div className="absolute -top-1 -right-1">
                <Badge variant="primary" className="h-5 w-5 flex items-center justify-center p-0 text-xs">
                  {activeFilterCount}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t">
          {/* States */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Experiment State
            </label>
            <div className="flex flex-wrap gap-1">
              {experimentStates.map(state => (
                <button
                  key={state.value}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    toggleArrayFilter('state', state.value)
                  }}
                  className={`px-2 py-1 text-xs rounded-md transition-colors cursor-pointer ${
                    filters.state?.includes(state.value)
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {state.label}
                </button>
              ))}
            </div>
          </div>

          {/* Significance */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Significance
            </label>
            <div className="flex flex-wrap gap-1">
              {significanceOptions.map(sig => (
                <button
                  key={sig.value}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    toggleArrayFilter('significance', sig.value)
                  }}
                  className={`px-2 py-1 text-xs rounded-md transition-colors cursor-pointer ${
                    filters.significance?.includes(sig.value)
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {sig.label}
                </button>
              ))}
            </div>
          </div>

          {/* Owners */}
          {users.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Owners
              </label>
              <select
                multiple
                className="w-full text-xs border border-gray-300 rounded-md p-1"
                value={filters.owners?.map(String) || []}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => Number(option.value))
                  updateFilter('owners', selected)
                }}
              >
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Tags
              </label>
              <div className="flex flex-wrap gap-1">
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      toggleArrayFilter('tags', tag.id)
                    }}
                    className={`px-2 py-1 text-xs rounded-md transition-colors cursor-pointer ${
                      filters.tags?.includes(tag.id)
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {tag.tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Applications */}
          {applications.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Applications
              </label>
              <div className="flex flex-wrap gap-1">
                {applications.map(app => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      toggleArrayFilter('applications', app.id)
                    }}
                    className={`px-2 py-1 text-xs rounded-md transition-colors cursor-pointer ${
                      filters.applications?.includes(app.id)
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {app.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Boolean Filters */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Issues & Alerts
            </label>
            <div className="grid grid-cols-2 gap-1">
              {[
                { key: 'sample_ratio_mismatch', label: 'SRM' },
                { key: 'cleanup_needed', label: 'Cleanup Needed' },
                { key: 'audience_mismatch', label: 'Audience Mismatch' },
                { key: 'sample_size_reached', label: 'Sample Size Reached' },
                { key: 'experiments_interact', label: 'Interactions' },
                { key: 'assignment_conflict', label: 'Assignment Conflict' }
              ].map(filter => (
                <label key={filter.key} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={filters[filter.key as keyof FilterState] === true}
                    onChange={(e) => updateFilter(filter.key as keyof FilterState, e.target.checked || undefined)}
                    className="h-3 w-3"
                  />
                  <span className="text-xs text-gray-700">{filter.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Clear Filters */}
          {activeFilterCount > 0 && (
            <div className="pt-2">
              <Button
                onClick={clearFilters}
                size="sm"
                variant="secondary"
                className="w-full"
              >
                <XMarkIcon className="h-4 w-4 mr-1" />
                Clear All Filters
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}