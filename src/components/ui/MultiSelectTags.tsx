import React, { useState, useRef, KeyboardEvent } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface MultiSelectTagsProps {
  currentClasses: string[]
  onAddClass: (className: string) => void
  onRemoveClass: (className: string) => void
  placeholder?: string
  className?: string
  pillColor?: 'blue' | 'green' | 'red'
}

export function MultiSelectTags({ 
  currentClasses, 
  onAddClass, 
  onRemoveClass,
  placeholder = "Type class name and press Enter...",
  className = "",
  pillColor = 'blue'
}: MultiSelectTagsProps) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const pillColors = {
    blue: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
    green: 'bg-green-100 text-green-800 hover:bg-green-200',
    red: 'bg-red-100 text-red-800 hover:bg-red-200'
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault()
      const trimmedValue = inputValue.trim()
      
      // Don't add if already exists
      if (!currentClasses.includes(trimmedValue)) {
        onAddClass(trimmedValue)
      }
      
      setInputValue('')
    }
  }

  const handleRemoveClass = (className: string) => {
    onRemoveClass(className)
  }

  return (
    <div className={`border rounded-md p-2 min-h-[42px] focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 ${className}`}>
      <div className="flex flex-wrap gap-1.5 items-center">
        {/* Display current classes as pills */}
        {currentClasses.map((className) => (
          <span
            key={className}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${pillColors[pillColor].split(' ').slice(0, 2).join(' ')}`}
          >
            {className}
            <button
              type="button"
              onClick={() => handleRemoveClass(className)}
              className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full transition-colors ${pillColors[pillColor].split(' ')[2]}`}
              aria-label={`Remove ${className}`}
            >
              <XMarkIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
        
        {/* Input for adding new classes */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={currentClasses.length === 0 ? placeholder : "Add class..."}
          className="flex-1 min-w-[120px] outline-none text-sm bg-transparent placeholder:text-gray-400"
        />
      </div>
    </div>
  )
}