import React from "react"
import { ErrorBoundary } from "~src/components/ErrorBoundary"
import { AIDOMChangesPage } from "~src/components/AIDOMChangesPage"
import { Button } from "~src/components/ui/Button"
import type { AIDOMContext } from "~src/types/dom-changes"

import { debugLog, debugWarn } from '~src/utils/debug'
interface AIDOMChangesViewProps {
  aiDomContext: AIDOMContext | null
  onBackFromAI: () => void
}

export function AIDOMChangesView({ aiDomContext, onBackFromAI }: AIDOMChangesViewProps) {
  if (!aiDomContext) {
    console.error('[AIDOMChangesView] Missing aiDomContext - this indicates a routing issue')
    return (
      <div id="ai-dom-changes-view-error" className="flex flex-col items-center justify-center h-screen p-8 bg-yellow-50">
        <div className="text-center max-w-md">
          <h2 id="ai-missing-context-heading" className="text-xl font-bold text-yellow-600 mb-4">
            Missing Context
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            AI chat context is missing. Please return and try again.
          </p>
          <Button onClick={onBackFromAI}>
            ← Go Back
          </Button>
        </div>
      </div>
    )
  }

  debugLog('[AIDOMChangesView] Rendering with context for variant:', aiDomContext.variantName)

  return (
    <div id="ai-dom-changes-view">
      <ErrorBoundary
        fallback={
          <div id="ai-dom-changes-view-error-boundary" className="flex flex-col items-center justify-center h-screen p-8 bg-red-50">
            <div className="text-center max-w-md">
              <h2 id="ai-error-heading" className="text-xl font-bold text-red-600 mb-4">
                AI Chat Failed to Load
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                The AI chat page encountered an error. Your changes are safe.
              </p>
              <Button id="return-to-variant-editor-button" onClick={onBackFromAI}>
                ← Return to Variant Editor
              </Button>
            </div>
          </div>
        }
      >
        <AIDOMChangesPage
          variantName={aiDomContext.variantName}
          currentChanges={aiDomContext.currentChanges}
          onBack={onBackFromAI}
          onGenerate={aiDomContext.onGenerate}
          onRestoreChanges={aiDomContext.onRestoreChanges}
          onPreviewToggle={aiDomContext.onPreviewToggle}
          onPreviewRefresh={aiDomContext.onPreviewRefresh}
          onPreviewWithChanges={aiDomContext.onPreviewWithChanges}
        />
      </ErrorBoundary>
    </div>
  )
}
