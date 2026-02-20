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
  const [createPanelOpen, setCreatePanelOpen] = useState(false)
  const [hasInitialized, setHasInitialized] = useState(false)

  const handleAuthExpired = () => {
    setIsAuthExpired(true)
    setError('Your session has expired. Please log in again.')
  }

  return {
    error,
    setError,
    isAuthExpired,
    setIsAuthExpired,
    createPanelOpen,
    setCreatePanelOpen,
    hasInitialized,
    setHasInitialized,
    handleAuthExpired
  }
}
