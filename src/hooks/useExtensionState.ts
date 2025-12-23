import { useState, useEffect } from "react"
import { debugLog } from '~src/utils/debug'
import type { ABsmartlyConfig } from "~src/types/absmartly"

interface UseExtensionStateProps {
  config: ABsmartlyConfig | null
  view: string
  currentPage: number
  setCurrentPage: (page: number) => void
}

export function useExtensionState({
  config,
  view,
  currentPage,
  setCurrentPage
}: UseExtensionStateProps) {
  const [error, setError] = useState<string | null>(null)
  const [isAuthExpired, setIsAuthExpired] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [createPanelOpen, setCreatePanelOpen] = useState(false)
  const [hasInitialized, setHasInitialized] = useState(false)

  useEffect(() => {
    if (view === 'list' && currentPage !== 1) {
      setCurrentPage(1)
    }
  }, [view, currentPage, setCurrentPage])

  const handleAuthExpired = () => {
    setIsAuthExpired(true)
    setError('Your session has expired. Please log in again.')
  }

  const handleToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type })
  }

  return {
    error,
    setError,
    isAuthExpired,
    setIsAuthExpired,
    toast,
    setToast,
    createPanelOpen,
    setCreatePanelOpen,
    hasInitialized,
    setHasInitialized,
    handleAuthExpired,
    handleToast
  }
}
