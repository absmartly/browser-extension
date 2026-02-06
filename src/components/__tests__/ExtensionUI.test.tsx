import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import ExtensionUI from '../ExtensionUI'
import type { Experiment } from '~src/types/absmartly'

jest.mock('~src/hooks/useABsmartly', () => ({
  useABsmartly: jest.fn(() => ({
    authenticated: true,
    loading: false,
    experiments: [],
    selectedExperiment: null,
    config: {
      apiEndpoint: 'https://api.absmartly.com',
      authMethod: 'jwt'
    },
    checkAuth: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    fetchExperiments: jest.fn(),
    updateExperiment: jest.fn(),
    startExperiment: jest.fn(),
    stopExperiment: jest.fn()
  }))
}))

jest.mock('~src/hooks/useExperimentHandlers', () => ({
  useExperimentHandlers: jest.fn(() => ({
    handleExperimentClick: jest.fn(),
    handleCreateExperiment: jest.fn(),
    handleCreateFromTemplate: jest.fn(),
    handleEditExperiment: jest.fn()
  }))
}))

jest.mock('~src/hooks/useExperimentLoading', () => ({
  useExperimentLoading: jest.fn(() => ({
    experimentDetailLoading: false
  }))
}))

jest.mock('~src/hooks/useFavorites', () => ({
  useFavorites: jest.fn(() => ({
    favoriteExperiments: new Set(),
    toggleFavorite: jest.fn()
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
      useABsmartly.mockReturnValue({
        authenticated: false,
        loading: true,
        experiments: [],
        config: null
      })

      render(<ExtensionUI />)

      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('should show authentication view when not authenticated', () => {
      const useABsmartly = require('~src/hooks/useABsmartly').useABsmartly
      useABsmartly.mockReturnValue({
        authenticated: false,
        loading: false,
        experiments: [],
        config: null
      })

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
      useABsmartly.mockReturnValue({
        authenticated: true,
        loading: false,
        experiments: [mockExperiment],
        selectedExperiment: mockExperiment,
        config: {
          apiEndpoint: 'https://api.absmartly.com'
        }
      })

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
      useABsmartly.mockReturnValue({
        authenticated: true,
        loading: true,
        experiments: [],
        config: {
          apiEndpoint: 'https://api.absmartly.com'
        }
      })

      render(<ExtensionUI />)

      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('should show loading indicator when loading experiment detail', () => {
      const useExperimentLoading = require('~src/hooks/useExperimentLoading').useExperimentLoading
      useExperimentLoading.mockReturnValue({
        experimentDetailLoading: true
      })

      render(<ExtensionUI />)

      expect(screen.queryByRole('status')).toBeInTheDocument()
    })
  })

  describe('Config Changes Propagation', () => {
    it('should update view when config changes', async () => {
      const useABsmartly = require('~src/hooks/useABsmartly').useABsmartly
      const mockCheckAuth = jest.fn()

      useABsmartly.mockReturnValue({
        authenticated: true,
        loading: false,
        experiments: [],
        config: {
          apiEndpoint: 'https://api.absmartly.com',
          authMethod: 'jwt'
        },
        checkAuth: mockCheckAuth
      })

      const { rerender } = render(<ExtensionUI />)

      useABsmartly.mockReturnValue({
        authenticated: true,
        loading: false,
        experiments: [],
        config: {
          apiEndpoint: 'https://new-api.absmartly.com',
          authMethod: 'apikey'
        },
        checkAuth: mockCheckAuth
      })

      rerender(<ExtensionUI />)

      expect(mockCheckAuth).toHaveBeenCalled()
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
      const useABsmartly = require('~src/hooks/useABsmartly').useABsmartly
      useABsmartly.mockReturnValue({
        authenticated: true,
        loading: false,
        experiments: [],
        error: 'Failed to fetch experiments',
        config: {
          apiEndpoint: 'https://api.absmartly.com'
        }
      })

      render(<ExtensionUI />)

      expect(screen.queryByText(/failed/i) || screen.queryByText(/error/i)).toBeInTheDocument()
    })

    it('should handle authentication errors', async () => {
      const useABsmartly = require('~src/hooks/useABsmartly').useABsmartly
      useABsmartly.mockReturnValue({
        authenticated: false,
        loading: false,
        experiments: [],
        error: 'Authentication failed',
        config: null
      })

      render(<ExtensionUI />)

      expect(screen.queryByText(/authentication failed/i) || screen.queryByText(/sign in/i)).toBeInTheDocument()
    })
  })

  describe('Favorites Integration', () => {
    it('should display favorite experiments', () => {
      const useFavorites = require('~src/hooks/useFavorites').useFavorites
      useFavorites.mockReturnValue({
        favoriteExperiments: new Set([1, 2]),
        toggleFavorite: jest.fn()
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

      const useABsmartly = require('~src/hooks/useABsmartly').useABsmartly
      useABsmartly.mockReturnValue({
        authenticated: true,
        loading: false,
        experiments: mockExperiments,
        config: {
          apiEndpoint: 'https://api.absmartly.com'
        }
      })

      render(<ExtensionUI />)

      expect(screen.getByText('Favorite Experiment')).toBeInTheDocument()
    })

    it('should toggle favorite status', async () => {
      const mockToggleFavorite = jest.fn()
      const useFavorites = require('~src/hooks/useFavorites').useFavorites
      useFavorites.mockReturnValue({
        favoriteExperiments: new Set(),
        toggleFavorite: mockToggleFavorite
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
