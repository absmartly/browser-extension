import { useState, useEffect, useCallback } from 'react'
import { BackgroundAPIClient } from '~src/lib/background-api-client'
import { getConfig } from '~src/utils/storage'
import { debugLog } from '~src/utils/debug'
import type {
  ABsmartlyConfig,
  Experiment,
  Application,
  UnitType,
  Metric,
  ExperimentTag,
  ExperimentUser,
  ExperimentTeam
} from '~src/types/absmartly'

interface ExperimentParams {
  page?: number
  items?: number
  [key: string]: unknown
}

export function useABsmartly() {
  const [client] = useState(() => new BackgroundAPIClient())
  const [config, setConfig] = useState<ABsmartlyConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<ExperimentUser | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const checkAuth = useCallback(async () => {
    if (!config) return

    try {
      debugLog('[useABsmartly] Checking authentication...')
      const result = await chrome.runtime.sendMessage({ type: 'CHECK_AUTH' })

      if (result?.success && result?.data?.user) {
        debugLog('[useABsmartly] ✅ Authenticated as:', result.data.user.email)
        setUser(result.data.user)
        setIsAuthenticated(true)
      } else {
        debugLog('[useABsmartly] ❌ Not authenticated:', result?.error)
        setUser(null)
        setIsAuthenticated(false)
      }
    } catch (err) {
      debugLog('[useABsmartly] ❌ Auth check failed:', err)
      console.error('[useABsmartly] Unable to verify authentication:', err instanceof Error ? err.message : String(err))
      setUser(null)
      setIsAuthenticated(false)
    }
  }, [config])

  useEffect(() => {
    loadConfig()
  }, [])

  useEffect(() => {
    if (config && !isAuthenticated) {
      checkAuth()
    }
  }, [config, isAuthenticated, checkAuth])

  const loadConfig = async () => {
    try {
      let savedConfig = await getConfig()

      if (!savedConfig) {
        const envApiKey = process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY
        const envApiEndpoint = process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT
        const envApplicationName = process.env.PLASMO_PUBLIC_ABSMARTLY_APPLICATION_NAME

        if (envApiKey && envApiEndpoint) {
          savedConfig = {
            apiKey: envApiKey,
            apiEndpoint: envApiEndpoint,
            applicationName: envApplicationName,
            authMethod: 'apikey',
            domChangesFieldName: '__dom_changes'
          } as ABsmartlyConfig
          console.log('[useABsmartly] Using config from environment variables (not saved to storage)')
        }
      }

      if (savedConfig) {
        setConfig(savedConfig)
      }
    } catch (err) {
      const errorMessage = err instanceof Error
        ? `Configuration error: ${err.message}`
        : 'Failed to load configuration from storage'
      setError(errorMessage)
      console.error('[useABsmartly] Configuration load failed:', err)
      console.error('[useABsmartly] User will see:', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const updateConfig = useCallback((newConfig: ABsmartlyConfig) => {
    setConfig(newConfig)
  }, [])

  const getExperiments = useCallback(async (params?: ExperimentParams): Promise<{experiments: Experiment[], total?: number, hasMore?: boolean}> => {
    return client.getExperiments(params)
  }, [client])

  const getExperiment = useCallback(async (id: number): Promise<Experiment> => {
    return client.getExperiment(id)
  }, [client])

  const startExperiment = useCallback(async (id: number): Promise<Experiment> => {
    return client.startExperiment(id)
  }, [client])

  const stopExperiment = useCallback(async (id: number): Promise<Experiment> => {
    return client.stopExperiment(id)
  }, [client])

  const createExperiment = useCallback(async (experimentData: Partial<Experiment>): Promise<Experiment> => {
    return client.createExperiment(experimentData)
  }, [client])

  const updateExperiment = useCallback(async (id: number, experimentData: Partial<Experiment>): Promise<Experiment> => {
    return client.updateExperiment(id, experimentData)
  }, [client])

  const getFavorites = useCallback(async (): Promise<number[]> => {
    return client.getFavorites()
  }, [client])

  const setExperimentFavorite = useCallback(async (id: number, favorite: boolean): Promise<void> => {
    return client.setExperimentFavorite(id, favorite)
  }, [client])

  const getApplications = useCallback(async (): Promise<Application[]> => {
    return client.getApplications()
  }, [client])

  const getUnitTypes = useCallback(async (): Promise<UnitType[]> => {
    return client.getUnitTypes()
  }, [client])

  const getMetrics = useCallback(async (): Promise<Metric[]> => {
    return client.getMetrics()
  }, [client])

  const getExperimentTags = useCallback(async (): Promise<ExperimentTag[]> => {
    return client.getExperimentTags()
  }, [client])

  const getOwners = useCallback(async (): Promise<ExperimentUser[]> => {
    return client.getOwners()
  }, [client])

  const getTeams = useCallback(async (): Promise<ExperimentTeam[]> => {
    return client.getTeams()
  }, [client])

  const getTemplates = useCallback(async (type: 'test_template' | 'feature_template' | 'test_template,feature_template' = 'test_template'): Promise<Experiment[]> => {
    return client.getTemplates(type)
  }, [client])

  return {
    client,
    config,
    loading,
    error,
    user,
    isAuthenticated,
    updateConfig,
    checkAuth,
    getExperiments,
    getExperiment,
    startExperiment,
    stopExperiment,
    createExperiment,
    updateExperiment,
    getFavorites,
    setExperimentFavorite,
    getApplications,
    getUnitTypes,
    getMetrics,
    getExperimentTags,
    getOwners,
    getTeams,
    getTemplates
  }
}
