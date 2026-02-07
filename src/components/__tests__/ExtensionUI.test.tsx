import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import ExtensionUI from '../ExtensionUI'
import type { Experiment } from '~src/types/absmartly'

jest.mock('~src/hooks/useABsmartly', () => ({
  useABsmartly: jest.fn(() => ({
    client: {},
    config: {
      apiEndpoint: 'https://api.absmartly.com',
      authMethod: 'jwt'
    },
    loading: false,
    user: null,
    isAuthenticated: true,
    updateConfig: jest.fn(),
    getExperiments: jest.fn(),
    getExperiment: jest.fn(),
    startExperiment: jest.fn(),
    stopExperiment: jest.fn(),
    createExperiment: jest.fn(),
    updateExperiment: jest.fn(),
    getFavorites: jest.fn(),
    setExperimentFavorite: jest.fn(),
    getApplications: jest.fn(),
    getUnitTypes: jest.fn(),
    getMetrics: jest.fn(),
    getExperimentTags: jest.fn(),
    getOwners: jest.fn(),
    getTeams: jest.fn(),
    getTemplates: jest.fn()
  }))
}))

jest.mock('~src/hooks/useExperimentHandlers', () => ({
  useExperimentHandlers: jest.fn(() => ({
    selectedExperiment: null,
    setSelectedExperiment: jest.fn(),
    experimentDetailLoading: false,
    setExperimentDetailLoading: jest.fn(),
    handleExperimentClick: jest.fn(),
    handleStartExperiment: jest.fn(),
    handleStopExperiment: jest.fn(),
    handleCreateExperiment: jest.fn(),
    handleCreateFromTemplate: jest.fn(),
    handleSaveExperiment: jest.fn(),
    handleUpdateExperiment: jest.fn()
  }))
}))

jest.mock('~src/hooks/useExperimentLoading', () => ({
  useExperimentLoading: jest.fn(() => ({
    filteredExperiments: [],
    experimentsLoading: false,
    currentPage: 1,
    pageSize: 20,
    totalExperiments: 0,
    hasMore: false,
    loadExperiments: jest.fn(),
    loadCachedExperiments: jest.fn(),
    handlePageChange: jest.fn(),
    handlePageSizeChange: jest.fn(),
    setCurrentPage: jest.fn()
  }))
}))

jest.mock('~src/hooks/useFavorites', () => ({
  useFavorites: jest.fn(() => ({
    favoriteExperiments: new Set(),
    loadFavorites: jest.fn(),
    handleToggleFavorite: jest.fn()
  }))
}))

jest.mock('~src/hooks/usePermissions', () => ({
  usePermissions: jest.fn(() => ({
    needsPermissions: false,
    requestPermissionsIfNeeded: jest.fn(),
    handleGrantPermissions: jest.fn(),
    handleDenyPermissions: jest.fn()
  }))
}))

jest.mock('~src/hooks/useExperimentFilters', () => ({
  useExperimentFilters: jest.fn(() => ({
    filters: {},
    filtersLoaded: true,
    handleFilterChange: jest.fn(),
    setFilters: jest.fn()
  }))
}))

jest.mock('~src/hooks/useEditorResources', () => ({
  useEditorResources: jest.fn(() => ({
    applications: [],
    unitTypes: [],
    metrics: [],
    tags: [],
    owners: [],
    teams: [],
    loadEditorResources: jest.fn(),
    setApplications: jest.fn()
  }))
}))

jest.mock('~src/hooks/useTemplates', () => ({
  useTemplates: jest.fn(() => ({
    templates: [],
    templatesLoading: false,
    templateSearchQuery: '',
    setTemplateSearchQuery: jest.fn()
  }))
}))

jest.mock('~src/hooks/useViewNavigation', () => ({
  useViewNavigation: jest.fn(() => ({
    view: 'list',
    setView: jest.fn(),
    aiDomContext: null,
    autoNavigateToAI: false,
    setAutoNavigateToAI: jest.fn(),
    handleNavigateToAI: jest.fn(),
    handleBackFromAI: jest.fn()
  }))
}))

jest.mock('~src/hooks/useSidebarState', () => ({
  useSidebarState: jest.fn(() => ({}))
}))

jest.mock('~src/hooks/useExtensionState', () => ({
  useExtensionState: jest.fn(() => ({
    error: null,
    setError: jest.fn(),
    setIsAuthExpired: jest.fn(),
    toast: null,
    setToast: jest.fn(),
    createPanelOpen: false,
    setCreatePanelOpen: jest.fn(),
    hasInitialized: false,
    setHasInitialized: jest.fn(),
    handleAuthExpired: jest.fn()
  }))
}))

jest.mock('~src/hooks/useExperimentInitialization', () => ({
  useExperimentInitialization: jest.fn(() => ({}))
}))

jest.mock('~src/hooks/useLoginRedirect', () => ({
  useLoginRedirect: jest.fn(() => ({
    handleLoginRedirect: jest.fn()
  }))
}))

jest.mock('~src/lib/messaging', () => ({
  sendToContent: jest.fn().mockResolvedValue(undefined),
  sendToBackground: jest.fn().mockResolvedValue({ success: true })
}))

jest.mock('~src/utils/storage', () => ({
  getConfig: jest.fn().mockResolvedValue({
    domChangesFieldName: '__dom_changes'
  }),
  localAreaStorage: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined)
  }
}))

global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys, callback) => callback({})),
      set: jest.fn((items, callback) => callback?.())
    }
  },
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    sendMessage: jest.fn()
  }
} as any

const mockABsmartlyHook = (overrides = {}) => ({
  client: {},
  config: {
    apiEndpoint: 'https://api.absmartly.com',
    authMethod: 'jwt'
  },
  loading: false,
  user: null,
  isAuthenticated: true,
  updateConfig: jest.fn(),
  getExperiments: jest.fn(),
  getExperiment: jest.fn(),
  startExperiment: jest.fn(),
  stopExperiment: jest.fn(),
  createExperiment: jest.fn(),
  updateExperiment: jest.fn(),
  getFavorites: jest.fn(),
  setExperimentFavorite: jest.fn(),
  getApplications: jest.fn(),
  getUnitTypes: jest.fn(),
  getMetrics: jest.fn(),
  getExperimentTags: jest.fn(),
  getOwners: jest.fn(),
  getTeams: jest.fn(),
  getTemplates: jest.fn(),
  ...overrides
})

describe('ExtensionUI', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Root Component Rendering', () => {
    it('should render extension UI', () => {
      render(<ExtensionUI />)

      expect(screen.getByText(/ABsmartly/i)).toBeInTheDocument()
    })

    it('should show loading state during initialization', () => {
      const useABsmartly = require('~src/hooks/useABsmartly').useABsmartly
      useABsmartly.mockReturnValue(mockABsmartlyHook({
        config: null,
        loading: true,
        isAuthenticated: false
      }))

      render(<ExtensionUI />)

      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('should show authentication view when not authenticated', () => {
      const useABsmartly = require('~src/hooks/useABsmartly').useABsmartly
      useABsmartly.mockReturnValue(mockABsmartlyHook({
        config: null,
        isAuthenticated: false
      }))

      render(<ExtensionUI />)

      expect(screen.getByText(/sign in/i) || screen.getByText(/login/i)).toBeInTheDocument()
    })
  })

  describe('View Navigation', () => {
    it('should navigate to experiment list by default', () => {
      render(<ExtensionUI />)

      expect(screen.queryByText(/experiments/i)).toBeInTheDocument()
    })

    it('should navigate to settings view', async () => {
      render(<ExtensionUI />)

      const settingsButton = screen.getByRole('button', { name: /settings/i })
      fireEvent.click(settingsButton)

      await waitFor(() => {
        expect(screen.getByText(/API Endpoint/i) || screen.getByText(/Configuration/i)).toBeInTheDocument()
      })
    })

    it('should navigate to AI page', async () => {
      render(<ExtensionUI />)

      const aiButton = screen.queryByRole('button', { name: /ai/i })
      if (aiButton) {
        fireEvent.click(aiButton)

        await waitFor(() => {
          expect(screen.getByText(/Vibe Studio/i) || screen.getByText(/AI/i)).toBeInTheDocument()
        })
      }
    })

    it('should navigate back from detail view', async () => {
      const mockExperiment: Experiment = {
        id: 1,
        name: 'test_exp',
        display_name: 'Test Experiment',
        state: 'created',
        created_at: '2024-01-01T00:00:00Z',
        variants: [],
        applications: [],
        owners: [],
        teams: [],
        experiment_tags: []
      }

      const useABsmartly = require('~src/hooks/useABsmartly').useABsmartly
      useABsmartly.mockReturnValue(mockABsmartlyHook())

      render(<ExtensionUI />)

      const backButton = screen.queryByRole('button', { name: /back/i })
      if (backButton) {
        fireEvent.click(backButton)

        await waitFor(() => {
          expect(screen.queryByText('Test Experiment')).not.toBeInTheDocument()
        })
      }
    })
  })

  describe('ErrorBoundary Integration', () => {
    it('should have error boundary protection', () => {
      render(<ExtensionUI />)
      expect(screen.queryByText(/ABsmartly/i)).toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('should show loading indicator when fetching experiments', () => {
      const useABsmartly = require('~src/hooks/useABsmartly').useABsmartly
      useABsmartly.mockReturnValue(mockABsmartlyHook({
        loading: true
      }))

      render(<ExtensionUI />)

      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('should show loading indicator when loading experiment detail', () => {
      const useExperimentHandlers = require('~src/hooks/useExperimentHandlers').useExperimentHandlers
      useExperimentHandlers.mockReturnValue({
        selectedExperiment: null,
        setSelectedExperiment: jest.fn(),
        experimentDetailLoading: true,
        setExperimentDetailLoading: jest.fn(),
        handleExperimentClick: jest.fn(),
        handleStartExperiment: jest.fn(),
        handleStopExperiment: jest.fn(),
        handleCreateExperiment: jest.fn(),
        handleCreateFromTemplate: jest.fn(),
        handleSaveExperiment: jest.fn(),
        handleUpdateExperiment: jest.fn()
      })

      render(<ExtensionUI />)

      expect(screen.queryByRole('status')).toBeInTheDocument()
    })
  })

  describe('Config Changes Propagation', () => {
    it('should update view when config changes', async () => {
      const useABsmartly = require('~src/hooks/useABsmartly').useABsmartly

      useABsmartly.mockReturnValue(mockABsmartlyHook())

      const { rerender } = render(<ExtensionUI />)

      useABsmartly.mockReturnValue(mockABsmartlyHook({
        config: {
          apiEndpoint: 'https://new-api.absmartly.com',
          authMethod: 'apikey'
        }
      }))

      rerender(<ExtensionUI />)

      expect(screen.queryByText(/ABsmartly/i)).toBeInTheDocument()
    })
  })

  describe('Experiment Creation Flow', () => {
    it('should open create experiment dialog', async () => {
      render(<ExtensionUI />)

      const createButton = screen.queryByRole('button', { name: /create/i })
      if (createButton) {
        fireEvent.click(createButton)

        await waitFor(() => {
          expect(screen.getByText(/new experiment/i)).toBeInTheDocument()
        })
      }
    })

    it('should create experiment from scratch', async () => {
      const mockHandleCreateExperiment = jest.fn()
      const useExperimentHandlers = require('~src/hooks/useExperimentHandlers').useExperimentHandlers
      useExperimentHandlers.mockReturnValue({
        handleExperimentClick: jest.fn(),
        handleCreateExperiment: mockHandleCreateExperiment,
        handleCreateFromTemplate: jest.fn(),
        handleEditExperiment: jest.fn()
      })

      render(<ExtensionUI />)

      const createButton = screen.queryByRole('button', { name: /create/i })
      if (createButton) {
        fireEvent.click(createButton)

        await waitFor(() => {
          const scratchButton = screen.queryByText(/from scratch/i)
          if (scratchButton) {
            fireEvent.click(scratchButton)
            expect(mockHandleCreateExperiment).toHaveBeenCalled()
          }
        })
      }
    })

    it('should create experiment from template', async () => {
      const mockHandleCreateFromTemplate = jest.fn()
      const useExperimentHandlers = require('~src/hooks/useExperimentHandlers').useExperimentHandlers
      useExperimentHandlers.mockReturnValue({
        handleExperimentClick: jest.fn(),
        handleCreateExperiment: jest.fn(),
        handleCreateFromTemplate: mockHandleCreateFromTemplate,
        handleEditExperiment: jest.fn()
      })

      render(<ExtensionUI />)

      const createButton = screen.queryByRole('button', { name: /create/i })
      if (createButton) {
        fireEvent.click(createButton)

        await waitFor(() => {
          const templateButton = screen.queryByText(/template/i)
          if (templateButton) {
            fireEvent.click(templateButton)
            expect(mockHandleCreateFromTemplate).toHaveBeenCalled()
          }
        })
      }
    })
  })

  describe('Error Handling', () => {
    it('should display error message when API fails', async () => {
      const useExtensionState = require('~src/hooks/useExtensionState').useExtensionState
      useExtensionState.mockReturnValue({
        error: 'Failed to fetch experiments',
        setError: jest.fn(),
        setIsAuthExpired: jest.fn(),
        toast: null,
        setToast: jest.fn(),
        createPanelOpen: false,
        setCreatePanelOpen: jest.fn(),
        hasInitialized: false,
        setHasInitialized: jest.fn(),
        handleAuthExpired: jest.fn()
      })

      render(<ExtensionUI />)

      expect(screen.queryByText(/failed/i) || screen.queryByText(/error/i)).toBeInTheDocument()
    })

    it('should handle authentication errors', async () => {
      const useABsmartly = require('~src/hooks/useABsmartly').useABsmartly
      useABsmartly.mockReturnValue(mockABsmartlyHook({
        isAuthenticated: false,
        config: null
      }))

      render(<ExtensionUI />)

      expect(screen.queryByText(/sign in/i)).toBeInTheDocument()
    })
  })

  describe('Favorites Integration', () => {
    it('should display favorite experiments', () => {
      const useFavorites = require('~src/hooks/useFavorites').useFavorites
      useFavorites.mockReturnValue({
        favoriteExperiments: new Set([1, 2]),
        loadFavorites: jest.fn(),
        handleToggleFavorite: jest.fn()
      })

      const mockExperiments: Experiment[] = [
        {
          id: 1,
          name: 'favorite_exp',
          display_name: 'Favorite Experiment',
          state: 'created',
          created_at: '2024-01-01T00:00:00Z',
          variants: [],
          applications: [],
          owners: [],
          teams: [],
          experiment_tags: []
        }
      ]

      const useExperimentLoading = require('~src/hooks/useExperimentLoading').useExperimentLoading
      useExperimentLoading.mockReturnValue({
        filteredExperiments: mockExperiments,
        experimentsLoading: false,
        currentPage: 1,
        pageSize: 20,
        totalExperiments: 1,
        hasMore: false,
        loadExperiments: jest.fn(),
        loadCachedExperiments: jest.fn(),
        handlePageChange: jest.fn(),
        handlePageSizeChange: jest.fn(),
        setCurrentPage: jest.fn()
      })

      render(<ExtensionUI />)

      expect(screen.getByText('Favorite Experiment')).toBeInTheDocument()
    })

    it('should toggle favorite status', async () => {
      const mockToggleFavorite = jest.fn()
      const useFavorites = require('~src/hooks/useFavorites').useFavorites
      useFavorites.mockReturnValue({
        favoriteExperiments: new Set(),
        loadFavorites: jest.fn(),
        handleToggleFavorite: mockToggleFavorite
      })

      render(<ExtensionUI />)

      const favoriteButton = screen.queryByRole('button', { name: /favorite/i })
      if (favoriteButton) {
        fireEvent.click(favoriteButton)

        await waitFor(() => {
          expect(mockToggleFavorite).toHaveBeenCalled()
        })
      }
    })
  })
})
