import React, { useState, useRef, useEffect } from 'react'
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

export interface MultiSelectOption {
  id: number | string
  name: string
  display_name?: string
  type?: 'user' | 'team'
  color?: string
}

interface MultiSelectProps {
  label: string
  options: MultiSelectOption[]
  selectedIds: (number | string)[]
  onChange: (selectedIds: (number | string)[]) => void
  placeholder?: string
  loading?: boolean
  disabled?: boolean
  renderOption?: (option: MultiSelectOption) => React.ReactNode
  renderSelectedOption?: (option: MultiSelectOption) => React.ReactNode
  showSearch?: boolean
}

export function MultiSelect({
  label,
  options,
  selectedIds,
  onChange,
  placeholder = "Select...",
  loading = false,
  disabled = false,
  renderOption,
  renderSelectedOption,
  showSearch = true
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOptions = options.filter(opt => selectedIds.includes(opt.id))
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

  const handleToggleOption = (optionId: number | string) => {
    if (selectedIds.includes(optionId)) {
      onChange(selectedIds.filter(id => id !== optionId))
    } else {
      onChange([...selectedIds, optionId])
    }
  }

  const handleRemoveOption = (optionId: number | string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(selectedIds.filter(id => id !== optionId))
  }

  const handleClearAll = () => {
    onChange([])
    setSearchTerm('')
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

  const defaultRenderOption = (option: MultiSelectOption) => {
    const isSelected = selectedIds.includes(option.id)
    const initials = getInitials(option.display_name || option.name)
    const colorClass = option.color || getDefaultColor(options.indexOf(option))

    return (
      <div
        key={option.id}
        className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 ${
          isSelected ? 'bg-blue-50' : ''
        }`}
        onClick={() => handleToggleOption(option.id)}
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

  const defaultRenderSelectedOption = (option: MultiSelectOption) => {
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
        <button
          onClick={(e) => handleRemoveOption(option.id, e)}
          className="text-gray-400 hover:text-gray-600"
          disabled={disabled}
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      <div
        className={`min-h-[42px] w-full border border-gray-300 rounded-md bg-white px-3 py-2 cursor-pointer ${
          disabled ? 'bg-gray-50 cursor-not-allowed' : ''
        }`}
        onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2 flex-1">
            {selectedOptions.length > 0 ? (
              selectedOptions.map(opt => 
                renderSelectedOption ? renderSelectedOption(opt) : defaultRenderSelectedOption(opt)
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
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-hidden">
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
                renderOption ? renderOption(opt) : defaultRenderOption(opt)
              )
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">
                No options found
              </div>
            )}
          </div>

          {selectedOptions.length > 0 && (
            <div className="p-2 border-t border-gray-200">
              <button
                onClick={handleClearAll}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
