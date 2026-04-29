import { useCallback, useEffect, useState } from "react"

import type {
  ABsmartlyConfig,
  Application,
  ExperimentTag,
  ExperimentTeam,
  ExperimentUser,
  Metric,
  UnitType
} from "~src/types/absmartly"
import { APIError } from "~src/types/errors"
import { debugError, debugLog } from "~src/utils/debug"
import {
  getEditorResourcesCache,
  setEditorResourcesCache
} from "~src/utils/storage"

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
    debugLog("Loading editor resources...")
    try {
      const [apps, units, metricsData, tagsData, ownersData, teamsData] =
        await Promise.all([
          getApplications(),
          getUnitTypes(),
          getMetrics(),
          getExperimentTags(),
          getOwners(),
          getTeams()
        ])

      debugLog("Editor resources loaded:", {
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

      // Persist for next sidebar mount — under workers=4 + 4 CI shards
      // the six concurrent /v1/* calls take 30-90s; reading from cache
      // unblocks the dropdowns immediately.
      await setEditorResourcesCache({
        applications: apps,
        unitTypes: units,
        metrics: metricsData,
        tags: tagsData,
        owners: ownersData,
        teams: teamsData
      })
    } catch (err: unknown) {
      const error = APIError.fromError(err)
      if (error.isAuthError || error.message === "AUTH_EXPIRED") {
        debugLog("[loadEditorResources] AUTH_EXPIRED error detected")
        const permissionsGranted = await requestPermissionsIfNeeded(true)
        if (permissionsGranted) {
          debugLog(
            "[loadEditorResources] Retrying after permissions granted..."
          )
          setTimeout(() => loadEditorResources(), 500)
        }
      }
      debugError("Failed to load editor resources:", error)
    }
  }, [
    requestPermissionsIfNeeded,
    getApplications,
    getUnitTypes,
    getMetrics,
    getExperimentTags,
    getOwners,
    getTeams
  ])

  // Cache hydration vs fresh fetch race: both effects below run after the
  // initial render with `unitTypes.length === 0`. If the fresh-fetch effect
  // doesn't gate on cache hydration, it fires loadEditorResources() in
  // parallel with the cache read — wasting an API call and racing the
  // dropdown's enable state. Track hydration in a state flag so the fetch
  // effect can wait until the cache has had its chance to populate the
  // store.
  const [cacheHydrated, setCacheHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false
    void getEditorResourcesCache().then((cached) => {
      if (cancelled) return
      if (cached) {
        if (cached.applications) setApplications(cached.applications)
        if (cached.unitTypes) setUnitTypes(cached.unitTypes)
        if (cached.metrics) setMetrics(cached.metrics)
        if (cached.tags) setTags(cached.tags)
        if (cached.owners) setOwners(cached.owners)
        if (cached.teams) setTeams(cached.teams)
      }
      setCacheHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!cacheHydrated) return
    if (config && isAuthenticated && unitTypes.length === 0) {
      debugLog(
        "Loading editor resources (config available, authenticated, resources not loaded)"
      )
      loadEditorResources()
    } else if (config && !isAuthenticated) {
      debugLog("Skipping editor resources load - not authenticated")
    }
  }, [
    cacheHydrated,
    config,
    isAuthenticated,
    unitTypes.length,
    loadEditorResources
  ])

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
