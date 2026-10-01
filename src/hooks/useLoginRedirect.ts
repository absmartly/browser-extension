import { useCallback } from "react"

import type { BackgroundAPIClient } from "~src/lib/background-api-client"
import type { Experiment } from "~src/types/absmartly"
import { APIError } from "~src/types/errors"
import type { ExperimentFilters } from "~src/types/filters"
import { debugError, debugLog } from "~src/utils/debug"
import { setExperimentsCache } from "~src/utils/storage"

import { getFilteredExperiments } from "./useExperimentFilters"

interface UseLoginRedirectProps {
  client: BackgroundAPIClient
  pageSize: number
  filters: ExperimentFilters | null
  getExperiments: (
    params: Record<string, unknown>
  ) => Promise<{ experiments: Experiment[] }>
  loadExperiments: (
    force?: boolean,
    page?: number,
    pageSize?: number
  ) => Promise<void>
  setIsAuthExpired: (expired: boolean) => void
  setError: (error: string | null) => void
}

export function useLoginRedirect({
  client,
  pageSize,
  filters,
  getExperiments,
  loadExperiments,
  setIsAuthExpired,
  setError
}: UseLoginRedirectProps) {
  const handleLoginRedirect = useCallback(async () => {
    try {
      setError(null)

      debugLog("Attempting to refresh experiments before login redirect...")

      try {
        const response = await getFilteredExperiments(
          getExperiments,
          filters,
          1,
          pageSize
        )
        debugLog("Session is still valid, refreshing experiments")
        setIsAuthExpired(false)
        setError(null)

        const experimentsData = response.experiments || []

        try {
          await setExperimentsCache(experimentsData)
        } catch (cacheError) {
          debugLog("Failed to cache experiments:", cacheError)
        }

        loadExperiments(true, 1, pageSize)
      } catch (err) {
        const error = APIError.fromError(err)
        if (error.isAuthError || error.message === "AUTH_EXPIRED") {
          debugLog("Session is expired, opening login page")
          const result = await client.openLogin()

          if (!result?.authenticated) {
          }
        } else {
          setError("Failed to load experiments. Please check your connection.")
        }
      }
    } catch (err) {
      debugError("Failed to handle login:", err)
      setError("Failed to handle login. Please try again.")
    }
  }, [
    client,
    pageSize,
    filters,
    getExperiments,
    loadExperiments,
    setIsAuthExpired,
    setError
  ])

  return { handleLoginRedirect }
}
