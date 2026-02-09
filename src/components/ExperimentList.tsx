import React, { useState, useEffect, useCallback } from 'react'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'
import type { Experiment } from '~src/types/absmartly'
import { ReloadBanner } from './experiment-list/ReloadBanner'
import {
  type ExperimentOverrides,
  type OverrideValue,
  ENV_TYPE,
  initializeOverrides,
  saveOverrides,
  reloadPageWithOverrides,
  saveDevelopmentEnvironment,
  getDevelopmentEnvironment
} from '~src/utils/overrides'
import { getCurrentVariantAssignments, type VariantAssignments } from '~src/utils/sdk-bridge'
import { getConfig } from '~src/utils/storage'
import { ExperimentListItem } from './experiment/ExperimentListItem'

interface ExperimentListProps {
  experiments: Experiment[]
  onExperimentClick: (experiment: Experiment) => void
  loading?: boolean
  favoriteExperiments?: Set<number>
  onToggleFavorite?: (experimentId: number) => void
}

export function ExperimentList({ experiments, onExperimentClick, loading, favoriteExperiments = new Set(), onToggleFavorite }: ExperimentListProps) {
  const [overrides, setOverrides] = useState<ExperimentOverrides>({})
  const [showReloadBanner, setShowReloadBanner] = useState(false)
  const [realVariants, setRealVariants] = useState<VariantAssignments>({})
  const [experimentsInContext, setExperimentsInContext] = useState<string[]>([])
  const [developmentEnv, setDevelopmentEnv] = useState<string | null>(null)
  const [domFieldName, setDomFieldName] = useState<string>('__dom_changes')

  useEffect(() => {
    const init = async () => {
      try {
        const config = await getConfig()
        const fieldName = config?.domChangesFieldName || '__dom_changes'
        setDomFieldName(fieldName)

        const loadedOverrides = await initializeOverrides()
        setOverrides(loadedOverrides)
      } catch (error) {
        debugError('Failed to initialize overrides:', error)
      }

      let devEnv = await getDevelopmentEnvironment()
      if (!devEnv) {
        try {
          const { BackgroundAPIClient } = await import('~src/lib/background-api-client')
          const client = new BackgroundAPIClient()

          const environments = await client.getEnvironments()
          debugLog('Fetched environments:', environments)

          const firstDevEnv = environments.find(env => env.name.toLowerCase().includes('dev'))
          if (firstDevEnv) {
            devEnv = firstDevEnv.name
            await saveDevelopmentEnvironment(firstDevEnv.name)
            debugLog('Saved development environment:', firstDevEnv.name)
          }
        } catch (error) {
          debugWarn('Failed to fetch environments:', error)
        }
      }
      setDevelopmentEnv(devEnv)
    }
    init()
  }, [])

  useEffect(() => {
    if (experiments.length > 0) {
      const experimentNames = experiments.map(exp => exp.name)

      const checkAssignments = async () => {
        const data = await getCurrentVariantAssignments(experimentNames)
        setRealVariants(data.assignments)
        setExperimentsInContext(data.experimentsInContext)
        debugLog('SDK data:', data)

        const hasActiveOverrides = Object.entries(overrides).some(([expName, overrideValue]) => {
          const variant = typeof overrideValue === 'number' ? overrideValue : overrideValue.variant
          const sdkVariant = data.assignments[expName]

          debugLog(`Comparing override for ${expName}: override=${variant}, sdk=${sdkVariant}`)

          return sdkVariant !== undefined && sdkVariant !== variant
        })

        debugLog('Has active overrides after comparison:', hasActiveOverrides)
        setShowReloadBanner(hasActiveOverrides)
      }

      const timeoutId = setTimeout(checkAssignments, 500)

      return () => clearTimeout(timeoutId)
    }
  }, [experiments, overrides])

  const handleOverrideChange = useCallback(async (experimentName: string, variantIndex: number, experiment: Experiment) => {
    const newOverrides = { ...overrides }
    if (variantIndex === -1) {
      delete newOverrides[experimentName]
    } else {
      const status = experiment.state || experiment.status || 'created'
      let overrideValue: number | OverrideValue = variantIndex
      debugLog('[ABsmartly] handleOverrideChange - experiment:', experimentName, 'status:', status, 'variantIndex:', variantIndex)

      if (status === 'development') {
        overrideValue = {
          variant: variantIndex,
          env: ENV_TYPE.DEVELOPMENT,
          id: experiment.id
        }
        debugLog('[ABsmartly] Setting development override:', overrideValue)
      } else if (status !== 'running' && status !== 'full_on') {
        overrideValue = {
          variant: variantIndex,
          env: ENV_TYPE.API_FETCH,
          id: experiment.id
        }
        debugLog('[ABsmartly] Setting non-running override:', overrideValue)
      }

      newOverrides[experimentName] = overrideValue
    }
    debugLog('[ABsmartly] New overrides to save:', newOverrides)
    setOverrides(newOverrides)

    await saveOverrides(newOverrides)

    const hasActiveOverrides = Object.entries(newOverrides).some(([expName, overrideValue]) => {
      const variant = typeof overrideValue === 'number' ? overrideValue : overrideValue.variant
      return realVariants[expName] !== variant
    })

    setShowReloadBanner(hasActiveOverrides)
  }, [overrides, realVariants])

  const handleReload = useCallback(async () => {
    await reloadPageWithOverrides()
    setShowReloadBanner(false)
  }, [])

  const handleClearAll = useCallback(async () => {
    await saveOverrides({})
    setOverrides({})
    setShowReloadBanner(false)
    await reloadPageWithOverrides()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div role="status" aria-label="Loading experiments">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    )
  }

  if (experiments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No experiments found
      </div>
    )
  }

  return (
    <div>
      {showReloadBanner && (
        <ReloadBanner
          onReload={handleReload}
          onDismiss={() => setShowReloadBanner(false)}
          onClearAll={handleClearAll}
        />
      )}

      <div className="divide-y divide-gray-200">
        {experiments.map((experiment) => (
          <ExperimentListItem
            key={experiment.id}
            experiment={experiment}
            overrides={overrides}
            realVariants={realVariants}
            experimentsInContext={experimentsInContext}
            domFieldName={domFieldName}
            isFavorite={favoriteExperiments.has(experiment.id)}
            onExperimentClick={onExperimentClick}
            onToggleFavorite={(experimentId) => onToggleFavorite?.(experimentId)}
            onOverrideChange={handleOverrideChange}
          />
        ))}
      </div>
    </div>
  )
}
