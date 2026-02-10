import { useState, useCallback, useEffect, useRef } from "react"
import { localAreaStorage } from "~src/utils/storage"
import type { DOMChange, AIDOMGenerationResult } from "~src/types/dom-changes"
import type { View } from "~src/types/view"

import { debugLog, debugWarn } from '~src/utils/debug'
interface AIDOMContext {
  variantName: string
  onGenerate: (prompt: string, images?: string[], conversationSession?: import('~src/types/absmartly').ConversationSession | null) => Promise<AIDOMGenerationResult>
  currentChanges: DOMChange[]
  onRestoreChanges: (changes: DOMChange[]) => void
  onPreviewToggle: (enabled: boolean) => void
  onPreviewRefresh: () => void
  onPreviewWithChanges: (enabled: boolean, changes: DOMChange[]) => void
  previousView: View
}

export function useViewNavigation() {
  const [view, setView] = useState<View>('list')
  const [aiDomContext, setAiDomContext] = useState<AIDOMContext | null>(null)
  const [autoNavigateToAI, setAutoNavigateToAI] = useState<string | null>(null)
  const isNavigatingToAIRef = useRef(false)

  useEffect(() => {
    if (view !== 'ai-dom-changes') {
      isNavigatingToAIRef.current = false
    }
  }, [view])

  const handleNavigateToAI = useCallback((
    variantName: string,
    onGenerate: (prompt: string, images?: string[], conversationSession?: import('~src/types/absmartly').ConversationSession | null) => Promise<AIDOMGenerationResult>,
    currentChanges: DOMChange[],
    onRestoreChanges: (changes: DOMChange[]) => void,
    onPreviewToggle: (enabled: boolean) => void,
    onPreviewRefresh: () => void,
    onPreviewWithChanges: (enabled: boolean, changes: DOMChange[]) => void
  ) => {
    debugLog('[useViewNavigation] handleNavigateToAI called for variant:', variantName)
    debugLog('[useViewNavigation] Current view:', view)
    if (view === 'ai-dom-changes' || isNavigatingToAIRef.current) {
      debugLog('[useViewNavigation] Already navigating or in AI view, skipping')
      return
    }
    isNavigatingToAIRef.current = true
    debugLog('[useViewNavigation] Setting aiDomContext and navigating to ai-dom-changes view')

    const context = {
      variantName,
      onGenerate,
      currentChanges,
      onRestoreChanges,
      onPreviewToggle,
      onPreviewRefresh,
      onPreviewWithChanges,
      previousView: view
    }

    setAiDomContext(context)
    setView('ai-dom-changes')
    setAutoNavigateToAI(null)

    debugLog('[useViewNavigation] Navigation complete. New view should be: ai-dom-changes')
  }, [view])

  const handleBackFromAI = useCallback(() => {
    isNavigatingToAIRef.current = false
    if (aiDomContext) {
      setView(aiDomContext.previousView)
    } else {
      setView('list')
    }
  }, [aiDomContext])

  useEffect(() => {
    const storage = localAreaStorage
    const state = {
      view: view === 'ai-dom-changes' ? 'detail' : view,
      aiVariantName: view === 'ai-dom-changes' ? aiDomContext?.variantName : null,
    }
    storage.set('sidebarState', state)
  }, [view, aiDomContext])

  return {
    view,
    setView,
    aiDomContext,
    autoNavigateToAI,
    setAutoNavigateToAI,
    handleNavigateToAI,
    handleBackFromAI
  }
}
