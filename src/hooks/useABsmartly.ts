import { useState, useEffect, useCallback } from 'react'
import { BackgroundAPIClient } from '~src/lib/background-api-client'
import { getConfig } from '~src/utils/storage'
import type { ABsmartlyConfig, Experiment } from '~src/types/absmartly'

export function useABsmartly() {
  const [client] = useState(() => new BackgroundAPIClient())
  const [config, setConfig] = useState<ABsmartlyConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      let savedConfig = await getConfig()

      // If no config in storage, check environment variables
      if (!savedConfig) {
        const envApiKey = process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY
        const envApiEndpoint = process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT
        const envApplicationName = process.env.PLASMO_PUBLIC_ABSMARTLY_APPLICATION_NAME

        // If env vars are available, create config from them
        if (envApiKey && envApiEndpoint) {
          savedConfig = {
            apiKey: envApiKey,
            apiEndpoint: envApiEndpoint,
            applicationName: envApplicationName,
            authMethod: 'apikey',
            domChangesFieldName: '__dom_changes'
          }
          // Don't auto-save to storage - let user confirm in settings
          console.log('[useABsmartly] Using config from environment variables (not saved to storage)')
        }
      }

      if (savedConfig) {
        setConfig(savedConfig)
      }
    } catch (err) {
      setError('Failed to load configuration')
      console.error('Failed to load config:', err)
    } finally {
      setLoading(false)
    }
  }

  const updateConfig = useCallback((newConfig: ABsmartlyConfig) => {
    setConfig(newConfig)
  }, [])

  const getExperiments = useCallback(async (params?: any): Promise<{experiments: Experiment[], total?: number, hasMore?: boolean}> => {
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

  const createExperiment = useCallback(async (experimentData: any): Promise<Experiment> => {
    return client.createExperiment(experimentData)
  }, [client])

  const updateExperiment = useCallback(async (id: number, experimentData: any): Promise<Experiment> => {
    return client.updateExperiment(id, experimentData)
  }, [client])

  const getFavorites = useCallback(async (): Promise<number[]> => {
    return client.getFavorites()
  }, [client])

  const setExperimentFavorite = useCallback(async (id: number, favorite: boolean): Promise<void> => {
    return client.setExperimentFavorite(id, favorite)
  }, [client])

  const getApplications = useCallback(async (): Promise<any[]> => {
    return client.getApplications()
  }, [client])

  const getUnitTypes = useCallback(async (): Promise<any[]> => {
    return client.getUnitTypes()
  }, [client])

  const getMetrics = useCallback(async (): Promise<any[]> => {
    return client.getMetrics()
  }, [client])

  const getExperimentTags = useCallback(async (): Promise<any[]> => {
    return client.getExperimentTags()
  }, [client])

  const getOwners = useCallback(async (): Promise<any[]> => {
    return client.getOwners()
  }, [client])

  const getTeams = useCallback(async (): Promise<any[]> => {
    return client.getTeams()
  }, [client])

  const getTemplates = useCallback(async (type: 'test_template' | 'feature_template' | 'test_template,feature_template' = 'test_template'): Promise<any[]> => {
    return client.getTemplates(type)
  }, [client])

  return {
    client,
    config,
    loading,
    error,
    updateConfig,
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