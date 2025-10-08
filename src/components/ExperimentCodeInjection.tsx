import React, { useState } from 'react'
import { debugLog } from '~src/utils/debug'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { PencilIcon, PlusIcon, XMarkIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { CustomCodeEditor } from './CustomCodeEditor'
import type { ExperimentInjectionCode } from '~src/types/absmartly'
import type { URLFilter } from '~src/types/dom-changes'

type InjectionSection = 'headStart' | 'headEnd' | 'bodyStart' | 'bodyEnd'

interface ExperimentCodeInjectionProps {
  experimentId: number
  variantIndex: number
  initialCode?: ExperimentInjectionCode
  onChange: (code: ExperimentInjectionCode) => void
  canEdit: boolean
  domChangesUrlFilter?: URLFilter
}

export function ExperimentCodeInjection({
  experimentId,
  variantIndex,
  initialCode = {},
  onChange,
  canEdit,
  domChangesUrlFilter
}: ExperimentCodeInjectionProps) {
  console.log('[ExperimentCodeInjection] Rendered with canEdit:', canEdit, 'experimentId:', experimentId)

  const [isExpanded, setIsExpanded] = useState(false)
  const [code, setCode] = useState<ExperimentInjectionCode>(initialCode)
  const [editingSection, setEditingSection] = useState<InjectionSection | null>(null)
  const [tempValue, setTempValue] = useState('')

  // URL Filter state
  const [isUrlFilterExpanded, setIsUrlFilterExpanded] = useState(false)
  const [mode, setMode] = useState<'all' | 'simple' | 'advanced'>(() => {
    if (!code.urlFilter) return 'all'
    if (typeof code.urlFilter === 'string' || Array.isArray(code.urlFilter)) return 'simple'
    return 'advanced'
  })

  const [simplePatterns, setSimplePatterns] = useState<string[]>(() => {
    if (!code.urlFilter) return []
    if (typeof code.urlFilter === 'string') return [code.urlFilter]
    if (Array.isArray(code.urlFilter)) return code.urlFilter
    return code.urlFilter.include || []
  })

  const [excludePatterns, setExcludePatterns] = useState<string[]>(() => {
    if (!code.urlFilter || typeof code.urlFilter === 'string' || Array.isArray(code.urlFilter)) {
      return []
    }
    return code.urlFilter.exclude || []
  })

  const [regexMode, setRegexMode] = useState<boolean>(() => {
    if (!code.urlFilter || typeof code.urlFilter === 'string' || Array.isArray(code.urlFilter)) {
      return false
    }
    return code.urlFilter.mode === 'regex'
  })

  const [matchType, setMatchType] = useState<'full-url' | 'path' | 'domain' | 'query' | 'hash'>(() => {
    if (!code.urlFilter || typeof code.urlFilter === 'string' || Array.isArray(code.urlFilter)) {
      return 'path'
    }
    return code.urlFilter.matchType || 'path'
  })

  const sections: Array<{ key: InjectionSection; title: string; icon: string }> = [
    { key: 'headStart', title: 'Start of <head>', icon: '📝' },
    { key: 'headEnd', title: 'End of <head>', icon: '📄' },
    { key: 'bodyStart', title: 'Start of <body>', icon: '🎯' },
    { key: 'bodyEnd', title: 'End of <body>', icon: '🏁' }
  ]

  const hasCode = (section: InjectionSection) => {
    return code[section] && code[section]!.trim().length > 0
  }

  const getCodePreview = (codeStr: string) => {
    if (!codeStr) return 'Click to add code'
    const lines = codeStr.trim().split('\n')
    const preview = lines.slice(0, 2).join('\n')
    return lines.length > 2 ? `${preview}...` : preview
  }

  const codeCount = sections.filter(s => hasCode(s.key)).length

  const handleSectionClick = (section: InjectionSection) => {
    console.log('[ExperimentCodeInjection] Section clicked:', section, 'canEdit:', canEdit)
    // Always allow opening the editor to view code, even in read-only mode
    setEditingSection(section)
    setTempValue(code[section] || '')
  }

  const handleSaveSection = () => {
    if (editingSection) {
      const updatedCode = {
        ...code,
        [editingSection]: tempValue
      }
      setCode(updatedCode)
      onChange(updatedCode)
      setEditingSection(null)
      setTempValue('')
    }
  }

  const handleCloseDialog = () => {
    setEditingSection(null)
    setTempValue('')
  }

  const updateURLFilter = () => {
    let updatedCode: ExperimentInjectionCode

    if (mode === 'all') {
      updatedCode = { ...code, urlFilter: undefined }
    } else if (mode === 'simple') {
      const filtered = simplePatterns.filter(p => p.trim())
      if (filtered.length === 0) {
        updatedCode = { ...code, urlFilter: undefined }
      } else {
        updatedCode = {
          ...code,
          urlFilter: {
            include: filtered,
            mode: regexMode ? 'regex' : 'simple',
            matchType: matchType
          }
        }
      }
    } else {
      // advanced mode
      const includeFiltered = simplePatterns.filter(p => p.trim())
      const excludeFiltered = excludePatterns.filter(p => p.trim())

      if (includeFiltered.length === 0 && excludeFiltered.length === 0) {
        updatedCode = { ...code, urlFilter: undefined }
      } else {
        updatedCode = {
          ...code,
          urlFilter: {
            include: includeFiltered.length > 0 ? includeFiltered : undefined,
            exclude: excludeFiltered.length > 0 ? excludeFiltered : undefined,
            mode: regexMode ? 'regex' : 'simple',
            matchType: matchType
          }
        }
      }
    }

    setCode(updatedCode)
    onChange(updatedCode)
  }

  const copyUrlFilterFromDomChanges = () => {
    if (!domChangesUrlFilter) return

    // Update mode
    if (typeof domChangesUrlFilter === 'string' || Array.isArray(domChangesUrlFilter)) {
      setMode('simple')
      const patterns = typeof domChangesUrlFilter === 'string' ? [domChangesUrlFilter] : domChangesUrlFilter
      setSimplePatterns(patterns)
    } else {
      if (domChangesUrlFilter.exclude && domChangesUrlFilter.exclude.length > 0) {
        setMode('advanced')
        setExcludePatterns(domChangesUrlFilter.exclude)
      } else {
        setMode('simple')
      }
      setSimplePatterns(domChangesUrlFilter.include || [])
      setRegexMode(domChangesUrlFilter.mode === 'regex')
      setMatchType(domChangesUrlFilter.matchType || 'path')
    }

    // Update the code with the filter
    const updatedCode = { ...code, urlFilter: domChangesUrlFilter }
    setCode(updatedCode)
    onChange(updatedCode)
  }

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200">
      {/* Header with toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-100 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Custom Code Injection</span>
          {codeCount > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
              {codeCount} {codeCount === 1 ? 'section' : 'sections'}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUpIcon className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 text-gray-500" />
        )}
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-200 pt-4">
          <p className="text-xs text-gray-500">
            Inject custom HTML/JavaScript at specific locations in the page.
            Wrap JavaScript in <code className="bg-gray-200 px-1 rounded">&lt;script&gt;</code> tags.
          </p>

          {/* Copy URL filter button */}
          {domChangesUrlFilter && (
            <Button
              type="button"
              onClick={copyUrlFilterFromDomChanges}
              size="sm"
              variant="secondary"
              disabled={!canEdit}
            >
              Copy URL filter from DOM changes
            </Button>
          )}

          {/* URL Filter Section */}
          <div className="bg-blue-50 rounded-lg border border-blue-200">
            <button
              type="button"
              onClick={() => setIsUrlFilterExpanded(!isUrlFilterExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-100 transition-colors rounded-lg"
            >
              <span className="text-xs font-medium text-gray-700">URL Filtering</span>
              <span className="text-gray-500">{isUrlFilterExpanded ? '−' : '+'}</span>
            </button>

            {isUrlFilterExpanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-blue-200 pt-3">
                {/* Mode selector */}
                <select
                  value={mode}
                  onChange={(e) => {
                    const newMode = e.target.value as 'all' | 'simple' | 'advanced'
                    setMode(newMode)
                    if (newMode === 'all') {
                      const updatedCode = { ...code, urlFilter: undefined }
                      setCode(updatedCode)
                      onChange(updatedCode)
                    } else if (newMode === 'simple' || newMode === 'advanced') {
                      if (simplePatterns.length === 0) {
                        setSimplePatterns([''])
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

                {/* Match Type selector */}
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
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-xs text-gray-700">Use regular expressions</span>
                    </label>

                    {/* Include patterns */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                        Include (show on these URLs):
                      </label>
                      <div className="space-y-2">
                        {(simplePatterns.length > 0 ? simplePatterns : ['']).map((pattern, i) => (
                          <div key={i} className="flex gap-2">
                            <Input
                              value={pattern}
                              onChange={(e) => {
                                const newPatterns = [...simplePatterns]
                                newPatterns[i] = e.target.value
                                setSimplePatterns(newPatterns)
                              }}
                              onBlur={updateURLFilter}
                              placeholder={regexMode ? '^/products/\\d+$' : '/products/*'}
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
                          Add Include Pattern
                        </Button>
                      </div>
                    </div>

                    {/* Exclude patterns */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                        Exclude (hide on these URLs):
                      </label>
                      <div className="space-y-2">
                        {(excludePatterns.length > 0 ? excludePatterns : ['']).map((pattern, i) => (
                          <div key={i} className="flex gap-2">
                            <Input
                              value={pattern}
                              onChange={(e) => {
                                const newPatterns = [...excludePatterns]
                                newPatterns[i] = e.target.value
                                setExcludePatterns(newPatterns)
                              }}
                              onBlur={updateURLFilter}
                              placeholder={regexMode ? '^/admin/.*' : '/admin/*'}
                              disabled={!canEdit}
                              className="flex-1 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newPatterns = excludePatterns.filter((_, idx) => idx !== i)
                                setExcludePatterns(newPatterns.length > 0 ? newPatterns : [''])
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
                          onClick={() => setExcludePatterns([...excludePatterns, ''])}
                          size="sm"
                          variant="secondary"
                          disabled={!canEdit}
                        >
                          <PlusIcon className="h-4 w-4 mr-1" />
                          Add Exclude Pattern
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Code sections */}
          <div className="space-y-2">
            {sections.map((section) => (
              <div
                key={section.key}
                onClick={() => handleSectionClick(section.key)}
                className="border rounded-lg p-3 transition-colors cursor-pointer hover:bg-gray-50 border-gray-300"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{section.icon}</span>
                      <span className={`text-sm font-medium ${canEdit ? 'text-gray-700' : 'text-gray-500'}`}>
                        {section.title}
                      </span>
                      {hasCode(section.key) && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          canEdit
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-200 text-gray-500'
                        }`}>
                          Has code
                        </span>
                      )}
                      {!canEdit && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                          Read-only
                        </span>
                      )}
                    </div>
                    <div className={`text-xs font-mono p-2 rounded mt-2 ${
                      canEdit
                        ? 'text-gray-500 bg-gray-100'
                        : 'text-gray-400 bg-gray-50'
                    }`}>
                      <pre className="whitespace-pre-wrap break-all">
                        {getCodePreview(code[section.key] || '')}
                      </pre>
                    </div>
                  </div>
                  {canEdit && <PencilIcon className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Code Editor */}
      <CustomCodeEditor
        isOpen={editingSection !== null}
        onClose={handleCloseDialog}
        section={editingSection as any}
        value={tempValue}
        onChange={setTempValue}
        onSave={handleSaveSection}
        readOnly={!canEdit}
      />
    </div>
  )
}
