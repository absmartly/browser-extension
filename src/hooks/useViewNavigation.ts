import { useState, useCallback, useEffect } from "react"
import { localAreaStorage } from "~src/utils/storage"
import type { DOMChange, AIDOMGenerationResult } from "~src/types/dom-changes"
import type { View } from "~src/types/view"

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

  const handleNavigateToAI = useCallback((
    variantName: string,
    onGenerate: (prompt: string, images?: string[], conversationSession?: import('~src/types/absmartly').ConversationSession | null) => Promise<AIDOMGenerationResult>,
    currentChanges: DOMChange[],
    onRestoreChanges: (changes: DOMChange[]) => void,
    onPreviewToggle: (enabled: boolean) => void,
    onPreviewRefresh: () => void,
    onPreviewWithChanges: (enabled: boolean, changes: DOMChange[]) => void
  ) => {
    setAiDomContext({
      variantName,
      onGenerate,
      currentChanges,
      onRestoreChanges,
      onPreviewToggle,
      onPreviewRefresh,
      onPreviewWithChanges,
      previousView: view
    })
    setView('ai-dom-changes')
    setAutoNavigateToAI(null)
  }, [view])

  const handleBackFromAI = useCallback(() => {
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
