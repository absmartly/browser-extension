import React, { useState, useEffect, useRef } from 'react'
import { XMarkIcon, PlusIcon } from '@heroicons/react/24/outline'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import type { DOMChangesConfig } from '../types/dom-changes'

interface URLFilterSectionProps {
  variantIndex: number
  config: DOMChangesConfig
  onConfigChange: (config: Partial<Omit<DOMChangesConfig, 'changes'>>) => void
  canEdit: boolean
}

const URLFilterSection = React.memo(function URLFilterSection({ variantIndex, config, onConfigChange, canEdit }: URLFilterSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isFirstRenderRef = useRef(true)
  const [currentPath, setCurrentPath] = useState<string>('')

  const [mode, setMode] = useState<'all' | 'simple' | 'advanced'>(() => {
    if (!config.urlFilter) return 'all'
    if (typeof config.urlFilter === 'string' || Array.isArray(config.urlFilter)) return 'simple'
    return 'advanced'
  })

  const [simplePatterns, setSimplePatterns] = useState<string[]>(() => {
    if (!config.urlFilter) return []
    if (typeof config.urlFilter === 'string') return [config.urlFilter]
    if (Array.isArray(config.urlFilter)) return config.urlFilter
    return config.urlFilter.include || []
  })

  // Get current tab's URL on mount
  useEffect(() => {
    const getCurrentTabPath = async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tabs[0]?.url) {
          const url = new URL(tabs[0].url)
          setCurrentPath(url.pathname)
        }
      } catch (error) {
        console.error('Failed to get current tab URL:', error)
      }
    }
    getCurrentTabPath()
  }, [])

  const [excludePatterns, setExcludePatterns] = useState<string[]>(() => {
    if (!config.urlFilter || typeof config.urlFilter === 'string' || Array.isArray(config.urlFilter)) {
      return []
    }
    return config.urlFilter.exclude || []
  })

  const [regexMode, setRegexMode] = useState<boolean>(() => {
    if (!config.urlFilter || typeof config.urlFilter === 'string' || Array.isArray(config.urlFilter)) {
      return false
    }
    return config.urlFilter.mode === 'regex'
  })

  const [matchType, setMatchType] = useState<'full-url' | 'path' | 'domain' | 'query' | 'hash'>(() => {
    if (!config.urlFilter || typeof config.urlFilter === 'string' || Array.isArray(config.urlFilter)) {
      return 'path' // Default to path
    }
    return config.urlFilter.matchType || 'path'
  })

  const updateURLFilter = () => {
    if (mode === 'all') {
      onConfigChange({ urlFilter: undefined })
    } else if (mode === 'simple') {
      const filtered = simplePatterns.filter(p => p.trim())
      if (filtered.length === 0) {
        onConfigChange({ urlFilter: undefined })
      } else {
        // Always use config format for simple mode to include matchType
        onConfigChange({
          urlFilter: {
            include: filtered,
            mode: regexMode ? 'regex' : 'simple',
            matchType: matchType
          }
        })
      }
    } else {
      // advanced mode
      const includeFiltered = simplePatterns.filter(p => p.trim())
      const excludeFiltered = excludePatterns.filter(p => p.trim())

      if (includeFiltered.length === 0 && excludeFiltered.length === 0) {
        onConfigChange({ urlFilter: undefined })
      } else {
        onConfigChange({
          urlFilter: {
            include: includeFiltered.length > 0 ? includeFiltered : undefined,
            exclude: excludeFiltered.length > 0 ? excludeFiltered : undefined,
            mode: regexMode ? 'regex' : 'simple',
            matchType: matchType
          }
        })
      }
    }
  }

  // Auto-save URL filter changes with debouncing (skip on first render)
  useEffect(() => {
    // Skip the autosave on first render to avoid false "unsaved changes"
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      return
    }

    const timer = setTimeout(() => {
      updateURLFilter()
    }, 500)

    return () => clearTimeout(timer)
  }, [simplePatterns, excludePatterns, regexMode, matchType, mode])

  return (
    <div className="bg-blue-50 rounded-lg border border-blue-200">
      {/* Header with toggle */}
      <button
        id={`url-filtering-toggle-variant-${variantIndex}`}
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-100 transition-colors rounded-lg"
      >
        <span className="text-xs font-medium text-gray-700">URL Filtering</span>
        <span className="text-gray-500">{isExpanded ? '−' : '+'}</span>
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-blue-200 pt-3">
          {/* Mode selector */}
          <select
            id={`url-filter-mode-variant-${variantIndex}`}
            value={mode}
            onChange={(e) => {
              const newMode = e.target.value as 'all' | 'simple' | 'advanced'
              setMode(newMode)
              if (newMode === 'all') {
                onConfigChange({ urlFilter: undefined })
              } else if (newMode === 'simple' || newMode === 'advanced') {
                if (simplePatterns.length === 0) {
                  // Pre-fill with current path if available, otherwise empty string
                  setSimplePatterns([currentPath || ''])
                }
              }
            }}
            disabled={!canEdit}
            className="w-full pl-2 pr-10 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs bg-white"
            style={{ backgroundPosition: 'right 0.75rem center' }}
          >
            <option value="all">Apply on all pages</option>
            <option value="simple">Target specific URLs (Simple patterns)</option>
            <option value="advanced">Advanced (Include/Exclude + Regex)</option>
          </select>

          {/* Match Type selector - only show when not "all" mode */}
          {mode !== 'all' && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                Match against:
              </label>
              <select
                value={matchType}
                onChange={(e) => {
                  setMatchType(e.target.value as 'full-url' | 'path' | 'domain' | 'query' | 'hash')
                  setTimeout(updateURLFilter, 0)
                }}
                disabled={!canEdit}
                className="w-full pl-2 pr-10 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs bg-white"
                style={{ backgroundPosition: 'right 0.75rem center' }}
              >
                <option value="path">Path only (e.g., /products/123)</option>
                <option value="full-url">Full URL (e.g., https://example.com/products/123?ref=home)</option>
                <option value="domain">Domain only (e.g., example.com)</option>
                <option value="query">Query parameters only (e.g., ?id=123&ref=home)</option>
                <option value="hash">Hash fragment only (e.g., #section-name)</option>
              </select>
            </div>
          )}

      {/* Simple mode */}
      {mode === 'simple' && (
        <div className="space-y-2">
          <div className="text-xs text-gray-600">
            💡 Use * to match any characters, ? for single character
          </div>
          {(simplePatterns.length > 0 ? simplePatterns : ['']).map((pattern, i) => (
            <div key={i} className="flex gap-2">
              <Input
                id={`url-filter-pattern-variant-${variantIndex}-${i}`}
                value={pattern}
                onChange={(e) => {
                  const newPatterns = [...simplePatterns]
                  newPatterns[i] = e.target.value
                  setSimplePatterns(newPatterns)
                }}
                onBlur={updateURLFilter}
                placeholder={matchType === 'path' ? '/products/*' : matchType === 'domain' ? 'example.com' : matchType === 'query' ? 'id=*' : matchType === 'hash' ? '#section-*' : 'https://example.com/products/*'}
                disabled={!canEdit}
                className="flex-1 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  const newPatterns = simplePatterns.filter((_, idx) => idx !== i)
                  setSimplePatterns(newPatterns.length > 0 ? newPatterns : [''])
                  setTimeout(updateURLFilter, 0)
                }}
                disabled={!canEdit}
                className="p-1 text-red-600 hover:text-red-800"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button
            type="button"
            onClick={() => setSimplePatterns([...simplePatterns, ''])}
            size="sm"
            variant="secondary"
            disabled={!canEdit}
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Pattern
          </Button>
        </div>
      )}

      {/* Advanced mode */}
      {mode === 'advanced' && (
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={regexMode}
              onChange={(e) => {
                setRegexMode(e.target.checked)
                setTimeout(updateURLFilter, 0)
              }}
              disabled={!canEdit}
              className="text-blue-600"
            />
            <span className="text-sm">Use Regex mode</span>
          </label>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Include patterns:
            </label>
            {(simplePatterns.length > 0 ? simplePatterns : ['']).map((pattern, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <Input
                  value={pattern}
                  onChange={(e) => {
                    const newPatterns = [...simplePatterns]
                    newPatterns[i] = e.target.value
                    setSimplePatterns(newPatterns)
                  }}
                  onBlur={updateURLFilter}
                  placeholder={
                    regexMode
                      ? (matchType === 'path' ? '^/products/.*$' : matchType === 'hash' ? '^#section-.*$' : '^https://example\\.com/.*$')
                      : (matchType === 'path' ? '/products/*' : matchType === 'domain' ? 'example.com' : matchType === 'query' ? 'id=*' : matchType === 'hash' ? '#section-*' : 'https://example.com/*')
                  }
                  disabled={!canEdit}
                  className="flex-1 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newPatterns = simplePatterns.filter((_, idx) => idx !== i)
                    setSimplePatterns(newPatterns.length > 0 ? newPatterns : [''])
                    setTimeout(updateURLFilter, 0)
                  }}
                  disabled={!canEdit}
                  className="p-1 text-red-600 hover:text-red-800"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              onClick={() => setSimplePatterns([...simplePatterns, ''])}
              size="sm"
              variant="secondary"
              disabled={!canEdit}
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Include Pattern
            </Button>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Exclude patterns (optional):
            </label>
            {excludePatterns.length === 0 && (
              <Button
                type="button"
                onClick={() => setExcludePatterns([''])}
                size="sm"
                variant="secondary"
                disabled={!canEdit}
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Add Exclude Pattern
              </Button>
            )}
            {excludePatterns.map((pattern, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <Input
                  value={pattern}
                  onChange={(e) => {
                    const newPatterns = [...excludePatterns]
                    newPatterns[i] = e.target.value
                    setExcludePatterns(newPatterns)
                  }}
                  onBlur={updateURLFilter}
                  placeholder={
                    regexMode
                      ? (matchType === 'path' ? '^/admin/.*$' : matchType === 'hash' ? '^#admin-.*$' : '^https://example\\.com/admin/.*$')
                      : (matchType === 'path' ? '/admin/*' : matchType === 'domain' ? 'admin.example.com' : matchType === 'query' ? 'preview=*' : matchType === 'hash' ? '#admin-*' : 'https://example.com/admin/*')
                  }
                  disabled={!canEdit}
                  className="flex-1 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newPatterns = excludePatterns.filter((_, idx) => idx !== i)
                    setExcludePatterns(newPatterns)
                    setTimeout(updateURLFilter, 0)
                  }}
                  disabled={!canEdit}
                  className="p-1 text-red-600 hover:text-red-800"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
            {excludePatterns.length > 0 && (
              <Button
                type="button"
                onClick={() => setExcludePatterns([...excludePatterns, ''])}
                size="sm"
                variant="secondary"
                disabled={!canEdit}
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Add Exclude Pattern
              </Button>
            )}
          </div>
        </div>
      )}

        </div>
      )}
    </div>
  )
})

export { URLFilterSection }
