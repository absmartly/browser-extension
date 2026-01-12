import { useState } from "react"
import type { ABsmartlyConfig } from "~src/types/absmartly"

interface UseExtensionStateProps {
  config: ABsmartlyConfig | null
}

export function useExtensionState({
  config
}: UseExtensionStateProps) {
  const [error, setError] = useState<string | null>(null)
  const [isAuthExpired, setIsAuthExpired] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [createPanelOpen, setCreatePanelOpen] = useState(false)
  const [hasInitialized, setHasInitialized] = useState(false)

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
