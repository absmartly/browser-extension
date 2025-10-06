import React, { type ReactNode } from 'react'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { Logo } from './Logo'

interface HeaderProps {
  title: string | ReactNode
  onBack: () => void
  actions?: ReactNode
  config?: any
}

export function Header({ title, onBack, actions, config }: HeaderProps) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Logo config={config} />
        {typeof title === 'string' ? (
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        ) : (
          title
        )}
      </div>
      <div className="flex items-center gap-1">
        {actions}
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          aria-label="Go back"
          title="Go back"
        >
          <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
        </button>
      </div>
    </div>
  )
}
