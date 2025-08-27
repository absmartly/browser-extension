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
      const savedConfig = await getConfig()
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
    setExperimentFavorite
  }
}