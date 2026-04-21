import { renderHook, waitFor } from '@testing-library/react'
import { useExperimentInitialization } from '../useExperimentInitialization'
import { localAreaStorage } from '~src/utils/storage'
import type { ABsmartlyConfig, Application, UnitType } from '~src/types/absmartly'
import type { ExperimentFilters } from '~src/types/filters'

jest.mock('~src/utils/storage', () => ({
  localAreaStorage: {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined)
  },
  setExperimentsCache: jest.fn()
}))

jest.mock('~src/utils/debug', () => ({
  debugLog: jest.fn(),
  debugError: jest.fn()
}))

const defaultConfig: ABsmartlyConfig = {
  apiKey: 'test-key',
  apiEndpoint: 'https://api.test'
} as ABsmartlyConfig

const defaultFilters: ExperimentFilters = { state: ['created', 'ready'] }

interface HookDeps {
  config?: ABsmartlyConfig | null
  isAuthenticated?: boolean
  view?: string
  hasInitialized?: boolean
  experimentsLoading?: boolean
  filtersLoaded?: boolean
  filters?: ExperimentFilters | null
  applications?: Application[]
  unitTypes?: UnitType[]
  pageSize?: number
  loadExperiments?: jest.Mock
  loadEditorResources?: jest.Mock
  loadFavorites?: jest.Mock
  getApplications?: jest.Mock
  setApplications?: jest.Mock
  setFilters?: jest.Mock
  setHasInitialized?: jest.Mock
}

const renderInit = (overrides: HookDeps = {}) => {
  const deps = {
    config: overrides.config ?? defaultConfig,
    isAuthenticated: overrides.isAuthenticated ?? true,
    view: overrides.view ?? 'list',
    hasInitialized: overrides.hasInitialized ?? false,
    experimentsLoading: overrides.experimentsLoading ?? false,
    filtersLoaded: overrides.filtersLoaded ?? true,
    filters: overrides.filters ?? defaultFilters,
    applications: overrides.applications ?? [],
    unitTypes: overrides.unitTypes ?? [],
    pageSize: overrides.pageSize ?? 50,
    loadExperiments: overrides.loadExperiments ?? jest.fn().mockResolvedValue(undefined),
    loadEditorResources: overrides.loadEditorResources ?? jest.fn().mockResolvedValue(undefined),
    loadFavorites: overrides.loadFavorites ?? jest.fn().mockResolvedValue(undefined),
    getApplications: overrides.getApplications ?? jest.fn().mockResolvedValue([]),
    setApplications: overrides.setApplications ?? jest.fn(),
    setFilters: overrides.setFilters ?? jest.fn(),
    setHasInitialized: overrides.setHasInitialized ?? jest.fn()
  }

  const hook = renderHook(() =>
    useExperimentInitialization({
      config: deps.config,
      isAuthenticated: deps.isAuthenticated,
      view: deps.view,
      hasInitialized: deps.hasInitialized,
      experimentsLoading: deps.experimentsLoading,
      filtersLoaded: deps.filtersLoaded,
      filters: deps.filters,
      applications: deps.applications,
      unitTypes: deps.unitTypes,
      pageSize: deps.pageSize,
      setHasInitialized: deps.setHasInitialized,
      getApplications: deps.getApplications,
      setApplications: deps.setApplications,
      setFilters: deps.setFilters,
      loadExperiments: deps.loadExperiments,
      loadFavorites: deps.loadFavorites,
      loadEditorResources: deps.loadEditorResources
    })
  )

  return { hook, deps }
}

describe('useExperimentInitialization', () => {
  beforeEach(() => {
    ;(localAreaStorage.get as jest.Mock).mockReset().mockResolvedValue(null)
    ;(localAreaStorage.set as jest.Mock).mockReset().mockResolvedValue(undefined)
    ;(localAreaStorage.remove as jest.Mock).mockReset().mockResolvedValue(undefined)
  })

  describe('list-view initialization', () => {
    it('passes the loaded filters to loadExperiments on initial load (no pending app filter)', async () => {
      ;(localAreaStorage.get as jest.Mock).mockResolvedValue(null)
      const { deps } = renderInit()

      await waitFor(() => {
        expect(deps.loadExperiments).toHaveBeenCalled()
      })

      expect(deps.loadExperiments).toHaveBeenCalledWith(false, 1, 50, defaultFilters)
    })

    it('passes filters to loadExperiments when getApplications returns no apps', async () => {
      const getApplications = jest.fn().mockResolvedValue([])
      const { deps } = renderInit({ getApplications })

      await waitFor(() => {
        expect(deps.loadExperiments).toHaveBeenCalled()
      })

      expect(deps.loadExperiments).toHaveBeenCalledWith(false, 1, 50, defaultFilters)
    })

    it('passes filters to loadExperiments when getApplications throws', async () => {
      const getApplications = jest.fn().mockRejectedValue(new Error('boom'))
      const { deps } = renderInit({ getApplications })

      await waitFor(() => {
        expect(deps.loadExperiments).toHaveBeenCalled()
      })

      expect(deps.loadExperiments).toHaveBeenCalledWith(false, 1, 50, defaultFilters)
    })

    it('warms editor resources on list init so dropdowns are populated before the user opens an experiment', async () => {
      const { deps } = renderInit()

      await waitFor(() => {
        expect(deps.loadEditorResources).toHaveBeenCalled()
      })
    })

    it('loads favorites on list init', async () => {
      const { deps } = renderInit()

      await waitFor(() => {
        expect(deps.loadFavorites).toHaveBeenCalled()
      })
    })

    it('marks the session as initialized immediately so the effect does not re-fire', async () => {
      const { deps } = renderInit()

      await waitFor(() => {
        expect(deps.setHasInitialized).toHaveBeenCalledWith(true)
      })
    })

    it('augments filters with the pending application filter and persists them', async () => {
      const apps: Application[] = [{ id: 42, name: 'www' } as Application]
      const getApplications = jest.fn().mockResolvedValue(apps)
      ;(localAreaStorage.get as jest.Mock).mockImplementation((key: string) =>
        Promise.resolve(key === 'pendingApplicationFilter' ? 'www' : null)
      )

      const { deps } = renderInit({ getApplications })

      await waitFor(() => {
        expect(deps.setFilters).toHaveBeenCalled()
      })

      expect(deps.setFilters).toHaveBeenCalledWith({
        ...defaultFilters,
        applications: [42]
      })
      expect(localAreaStorage.set).toHaveBeenCalledWith('experimentFilters', {
        ...defaultFilters,
        applications: [42]
      })
      expect(localAreaStorage.remove).toHaveBeenCalledWith('pendingApplicationFilter')
      expect(deps.loadExperiments).toHaveBeenCalledWith(false, 1, 50, {
        ...defaultFilters,
        applications: [42]
      })
    })

    it('falls back to passing the base filters when the pending app is not found', async () => {
      const apps: Application[] = [{ id: 1, name: 'other' } as Application]
      const getApplications = jest.fn().mockResolvedValue(apps)
      ;(localAreaStorage.get as jest.Mock).mockImplementation((key: string) =>
        Promise.resolve(key === 'pendingApplicationFilter' ? 'www' : null)
      )

      const { deps } = renderInit({ getApplications })

      await waitFor(() => {
        expect(deps.loadExperiments).toHaveBeenCalled()
      })

      expect(deps.loadExperiments).toHaveBeenCalledWith(false, 1, 50, defaultFilters)
    })
  })

  describe('initialization gating', () => {
    it('does not initialize before filters are loaded', async () => {
      const { deps } = renderInit({ filtersLoaded: false, filters: null })

      await Promise.resolve()

      expect(deps.loadExperiments).not.toHaveBeenCalled()
      expect(deps.loadEditorResources).not.toHaveBeenCalled()
      expect(deps.setHasInitialized).not.toHaveBeenCalled()
    })

    it('does not initialize when the user is not authenticated', async () => {
      const { deps } = renderInit({ isAuthenticated: false })

      await Promise.resolve()

      expect(deps.loadExperiments).not.toHaveBeenCalled()
      expect(deps.loadEditorResources).not.toHaveBeenCalled()
    })

    it('does not re-initialize when hasInitialized is already true', async () => {
      const { deps } = renderInit({ hasInitialized: true })

      await Promise.resolve()

      expect(deps.loadExperiments).not.toHaveBeenCalled()
      expect(deps.loadEditorResources).not.toHaveBeenCalled()
    })

    it('does not initialize from a non-list view', async () => {
      const { deps } = renderInit({ view: 'detail' })

      await Promise.resolve()

      expect(deps.loadExperiments).not.toHaveBeenCalled()
    })
  })

  describe('create/edit view editor resources', () => {
    it('loads editor resources when entering create view without unit types', async () => {
      const { deps } = renderInit({
        view: 'create',
        hasInitialized: true,
        unitTypes: []
      })

      await waitFor(() => {
        expect(deps.loadEditorResources).toHaveBeenCalled()
      })
    })

    it('does not reload editor resources if unit types are already populated', async () => {
      const { deps } = renderInit({
        view: 'edit',
        hasInitialized: true,
        unitTypes: [{ id: 1, name: 'user', unit_type_id: 1 } as unknown as UnitType]
      })

      await Promise.resolve()

      expect(deps.loadEditorResources).not.toHaveBeenCalled()
    })
  })
})
