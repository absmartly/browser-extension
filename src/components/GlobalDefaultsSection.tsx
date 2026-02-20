import React from 'react'
import { DOMChangeOptions } from './DOMChangeOptions'
import type { DOMChangesConfig } from '../types/dom-changes'

interface GlobalDefaultsSectionProps {
  config: DOMChangesConfig
  onConfigChange: (config: Partial<DOMChangesConfig>) => void
  canEdit: boolean
}

const GlobalDefaultsSection = React.memo(function GlobalDefaultsSection({ config, onConfigChange, canEdit }: GlobalDefaultsSectionProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200">
      {/* Header with toggle */}
      <button
        type="button"
        id="global-defaults-button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-100 transition-colors rounded-lg"
      >
        <span id="global-defaults-heading" className="text-xs font-medium text-gray-700">Global Defaults</span>
        <span className="text-gray-500">{isExpanded ? '−' : '+'}</span>
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-200 pt-3">
          <p className="text-xs text-gray-600 mb-3">
            Set default values for all DOM changes in this variant
          </p>
          <DOMChangeOptions
            important={config.important === true}
            waitForElement={config.waitForElement === true}
            persistStyle={config.persistStyle === true}
            observerRoot={config.observerRoot || ''}
            onImportantChange={(value) => onConfigChange({ important: value || undefined })}
            onWaitForElementChange={(value) => onConfigChange({ waitForElement: value || undefined })}
            onPersistStyleChange={(value) => onConfigChange({ persistStyle: value || undefined })}
            onObserverRootChange={(value) => onConfigChange({ observerRoot: value || undefined })}
            disabled={!canEdit}
            idPrefix="global-defaults"
          />
        </div>
      )}
    </div>
  )
})

export { GlobalDefaultsSection }
