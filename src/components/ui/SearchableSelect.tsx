import React, { useState, useRef, useEffect } from 'react'
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

export interface SearchableSelectOption {
  id: number | string
  name: string
  display_name?: string
  type?: 'user' | 'team'
  color?: string
}

interface BaseSelectProps {
  label: string
  options: SearchableSelectOption[]
  placeholder?: string
  loading?: boolean
  disabled?: boolean
  renderOption?: (option: SearchableSelectOption, isSelected: boolean, onSelect: () => void) => React.ReactNode
  renderSelectedOption?: (option: SearchableSelectOption, onRemove?: (e: React.MouseEvent) => void) => React.ReactNode
  showSearch?: boolean
  required?: boolean
  'data-testid'?: string
  id?: string
}

interface SingleSelectProps extends BaseSelectProps {
  mode: 'single'
  selectedId: number | string | null
  onChange: (selectedId: number | string | null) => void
}

interface MultiSelectProps extends BaseSelectProps {
  mode: 'multi'
  selectedIds: (number | string)[]
  onChange: (selectedIds: (number | string)[]) => void
}

type SearchableSelectProps = SingleSelectProps | MultiSelectProps

export function SearchableSelect(props: SearchableSelectProps) {
  const {
    label,
    options,
    placeholder = "Select...",
    loading = false,
    disabled = false,
    renderOption,
    renderSelectedOption,
    showSearch = true,
    required = false,
    mode,
    'data-testid': dataTestId,
    id
  } = props

  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOptions = mode === 'single'
    ? (props.selectedId ? options.filter(opt => opt.id === props.selectedId) : [])
    : options.filter(opt => props.selectedIds.includes(opt.id))

  const filteredOptions = options.filter(opt =>
    (opt.display_name || opt.name).toLowerCase().includes(searchTerm.toLowerCase())
  )

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectOption = (optionId: number | string) => {
    if (mode === 'single') {
      props.onChange(optionId)
      setIsOpen(false)
      setSearchTerm('')
    } else {
      if (props.selectedIds.includes(optionId)) {
        props.onChange(props.selectedIds.filter(id => id !== optionId))
      } else {
        props.onChange([...props.selectedIds, optionId])
      }
    }
  }

  const handleRemoveOption = (optionId: number | string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (mode === 'single') {
      props.onChange(null)
    } else {
      props.onChange(props.selectedIds.filter(id => id !== optionId))
    }
  }

  const handleClearAll = () => {
    if (mode === 'multi') {
      props.onChange([])
      setSearchTerm('')
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getDefaultColor = (index: number) => {
    const colors = [
      'bg-blue-500',
      'bg-purple-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-indigo-500',
      'bg-pink-500',
      'bg-orange-500'
    ]
    return colors[index % colors.length]
  }

  const defaultRenderOption = (option: SearchableSelectOption, isSelected: boolean, onSelect: () => void) => {
    const initials = getInitials(option.display_name || option.name)
    const colorClass = option.color || getDefaultColor(options.indexOf(option))

    return (
      <div
        key={option.id}
        className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 ${
          isSelected ? 'bg-blue-50' : ''
        }`}
        onClick={onSelect}
      >
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full ${colorClass} flex items-center justify-center text-white text-xs font-medium`}>
            {initials}
          </div>
          <span className="text-sm text-gray-900">{option.display_name || option.name}</span>
        </div>
        {isSelected && (
          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    )
  }

  const defaultRenderSelectedOption = (option: SearchableSelectOption, onRemove?: (e: React.MouseEvent) => void) => {
    const initials = getInitials(option.display_name || option.name)
    const colorClass = option.color || getDefaultColor(options.indexOf(option))

    return (
      <div
        key={option.id}
        className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-gray-300 rounded-md text-sm"
      >
        <div className={`w-5 h-5 rounded-full ${colorClass} flex items-center justify-center text-white text-[10px] font-medium`}>
          {initials}
        </div>
        <span className="text-gray-900">{option.display_name || option.name}</span>
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-gray-400 hover:text-gray-600"
            disabled={disabled}
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }

  const isSelected = (optionId: number | string) => {
    return mode === 'single'
      ? props.selectedId === optionId
      : props.selectedIds.includes(optionId)
  }

  return (
    <div className="relative" ref={containerRef} data-testid={dataTestId}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div
        id={id ? `${id}-trigger` : undefined}
        className={`min-h-[42px] w-full border border-gray-300 rounded-md bg-white px-3 py-2 cursor-pointer ${
          disabled ? 'bg-gray-50 cursor-not-allowed' : ''
        }`}
        onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
        data-testid={dataTestId ? `${dataTestId}-trigger` : undefined}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2 flex-1">
            {selectedOptions.length > 0 ? (
              mode === 'single' ? (
                renderSelectedOption
                  ? renderSelectedOption(selectedOptions[0], !required && !disabled ? (e) => handleRemoveOption(selectedOptions[0].id, e) : undefined)
                  : defaultRenderSelectedOption(selectedOptions[0], !required && !disabled ? (e) => handleRemoveOption(selectedOptions[0].id, e) : undefined)
              ) : (
                selectedOptions.map(opt =>
                  renderSelectedOption
                    ? renderSelectedOption(opt, (e) => handleRemoveOption(opt.id, e))
                    : defaultRenderSelectedOption(opt, (e) => handleRemoveOption(opt.id, e))
                )
              )
            ) : (
              <span className="text-gray-400 text-sm">{loading ? 'Loading...' : placeholder}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isOpen ? (
              <ChevronUpIcon className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDownIcon className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {isOpen && !loading && !disabled && (
        <div id={id ? `${id}-dropdown` : undefined} className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-hidden" data-testid={dataTestId ? `${dataTestId}-dropdown` : undefined}>
          {showSearch && (
            <div className="p-2 border-b border-gray-200">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt =>
                renderOption
                  ? renderOption(opt, isSelected(opt.id), () => handleSelectOption(opt.id))
                  : defaultRenderOption(opt, isSelected(opt.id), () => handleSelectOption(opt.id))
              )
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">
                No options found
              </div>
            )}
          </div>

          {mode === 'multi' && selectedOptions.length > 0 && (
            <div className="p-2 border-t border-gray-200">
              <button
                onClick={handleClearAll}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
