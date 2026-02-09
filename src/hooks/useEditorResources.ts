import { useState, useCallback, useEffect } from 'react'
import { debugLog, debugError } from '~src/utils/debug'
import { APIError } from '~src/types/errors'
import type {
  ABsmartlyConfig,
  Application,
  UnitType,
  Metric,
  ExperimentTag,
  ExperimentUser,
  ExperimentTeam
} from '~src/types/absmartly'

interface UseEditorResourcesParams {
  config: ABsmartlyConfig | null
  isAuthenticated: boolean
  getApplications: () => Promise<Application[]>
  getUnitTypes: () => Promise<UnitType[]>
  getMetrics: () => Promise<Metric[]>
  getExperimentTags: () => Promise<ExperimentTag[]>
  getOwners: () => Promise<ExperimentUser[]>
  getTeams: () => Promise<ExperimentTeam[]>
  requestPermissionsIfNeeded: (forceRequest: boolean) => Promise<boolean>
}

export function useEditorResources({
  config,
  isAuthenticated,
  getApplications,
  getUnitTypes,
  getMetrics,
  getExperimentTags,
  getOwners,
  getTeams,
  requestPermissionsIfNeeded
}: UseEditorResourcesParams) {
  const [applications, setApplications] = useState<Application[]>([])
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([])
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [tags, setTags] = useState<ExperimentTag[]>([])
  const [owners, setOwners] = useState<ExperimentUser[]>([])
  const [teams, setTeams] = useState<ExperimentTeam[]>([])

  const loadEditorResources = useCallback(async () => {
    debugLog('Loading editor resources...')
    try {
      const [apps, units, metricsData, tagsData, ownersData, teamsData] = await Promise.all([
        getApplications(),
        getUnitTypes(),
        getMetrics(),
        getExperimentTags(),
        getOwners(),
        getTeams()
      ])

      debugLog('Editor resources loaded:', {
        apps: apps?.length || 0,
        units: units?.length || 0,
        metricsData: metricsData?.length || 0,
        tagsData: tagsData?.length || 0,
        ownersData: ownersData?.length || 0,
        teamsData: teamsData?.length || 0
      })
      setApplications(apps || [])
      setUnitTypes(units || [])
      setMetrics(metricsData || [])
      setTags(tagsData || [])
      setOwners(ownersData || [])
      setTeams(teamsData || [])
    } catch (err: unknown) {
      const error = APIError.fromError(err)
      if (error.isAuthError || error.message === 'AUTH_EXPIRED') {
        debugLog('[loadEditorResources] AUTH_EXPIRED error detected')
        const permissionsGranted = await requestPermissionsIfNeeded(true)
        if (permissionsGranted) {
          debugLog('[loadEditorResources] Retrying after permissions granted...')
          setTimeout(() => loadEditorResources(), 500)
        }
      }
      debugError('Failed to load editor resources:', error)
    }
  }, [requestPermissionsIfNeeded, getApplications, getUnitTypes, getMetrics, getExperimentTags, getOwners, getTeams])

  useEffect(() => {
    if (config && isAuthenticated && unitTypes.length === 0) {
      debugLog('Loading editor resources (config available, authenticated, resources not loaded)')
      loadEditorResources()
    } else if (config && !isAuthenticated) {
      debugLog('Skipping editor resources load - not authenticated')
    }
  }, [config, isAuthenticated, unitTypes.length, loadEditorResources])

  return {
    applications,
    unitTypes,
    metrics,
    tags,
    owners,
    teams,
    loadEditorResources,
    setApplications
  }
}
