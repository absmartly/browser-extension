import React from 'react'
import { CheckIcon } from '@heroicons/react/24/solid'

interface CheckboxProps {
  id?: string
  checked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export function Checkbox({
  id,
  checked = false,
  onChange,
  disabled = false,
  className = ''
}: CheckboxProps) {
  return (
    <button
      id={id}
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`
        relative w-5 h-5 rounded border-2 transition-colors
        ${checked 
          ? 'bg-blue-600 border-blue-600' 
          : 'bg-white border-gray-300 hover:border-gray-400'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      {checked && (
        <CheckIcon className="absolute inset-0 w-3 h-3 m-auto text-white" />
      )}
    </button>
  )
}