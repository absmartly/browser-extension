import React from 'react'
import { saveOverrides, reloadPageWithOverrides } from '~src/utils/overrides'

interface ReloadBannerProps {
  onReload: () => void
  onDismiss: () => void
  onClearAll?: () => Promise<void>
}

export const ReloadBanner = React.memo(function ReloadBanner({ onReload, onDismiss, onClearAll }: ReloadBannerProps) {
  const handleClearAll = async () => {
    if (window.confirm('Clear all experiment overrides?')) {
      if (onClearAll) {
        await onClearAll()
      } else {
        await saveOverrides({})
        await reloadPageWithOverrides()
      }
    }
  }

  return (
    <div className="bg-blue-50 border-b border-blue-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm text-blue-800">
          Experiment overrides changed. Reload to apply changes.
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onReload}
          className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
        >
          Reload Now
        </button>
        <button
          onClick={handleClearAll}
          className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-800 transition-colors"
        >
          Clear All
        </button>
        <button
          onClick={onDismiss}
          className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors"
        >
          Later
        </button>
      </div>
    </div>
  )
})
