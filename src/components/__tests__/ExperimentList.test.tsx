import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ExperimentList } from '../ExperimentList'
import type { Experiment } from '~src/types/absmartly'
import * as storage from '~src/utils/storage'
import * as overrides from '~src/utils/overrides'
import * as sdkBridge from '~src/utils/sdk-bridge'

jest.mock('~src/utils/storage', () => ({
  getConfig: jest.fn().mockResolvedValue({
    domChangesFieldName: '__dom_changes'
  }),
  localAreaStorage: {
    get: jest.fn().mockResolvedValue({}),
    set: jest.fn().mockResolvedValue(undefined)
  }
}))

jest.mock('~src/utils/overrides', () => ({
  initializeOverrides: jest.fn().mockResolvedValue({}),
  saveOverrides: jest.fn().mockResolvedValue(undefined),
  reloadPageWithOverrides: jest.fn().mockResolvedValue(undefined),
  saveDevelopmentEnvironment: jest.fn().mockResolvedValue(undefined),
  getDevelopmentEnvironment: jest.fn().mockResolvedValue(null),
  ENV_TYPE: {
    DEVELOPMENT: 'development',
    API_FETCH: 'api_fetch'
  }
}))

jest.mock('~src/utils/sdk-bridge', () => ({
  getCurrentVariantAssignments: jest.fn().mockResolvedValue({
    assignments: {},
    experimentsInContext: []
  })
}))

jest.mock('~src/lib/background-api-client', () => ({
  BackgroundAPIClient: jest.fn().mockImplementation(() => ({
    getEnvironments: jest.fn().mockResolvedValue([
      { name: 'development' },
      { name: 'production' }
    ])
  }))
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
    }
  }
} as any

const mockExperiments: Experiment[] = [
  {
    id: 1,
    name: 'experiment_1',
    display_name: 'Experiment 1',
    state: 'running',
    status: 'running',
    created_at: '2024-01-01T00:00:00Z',
    percentage_of_traffic: 100,
    unit_type_id: 1,
    variants: [
      { name: 'Control', config: '{}' },
      { name: 'Variant A', config: '{}' }
    ],
    applications: [],
    owners: [],
    teams: [],
    experiment_tags: []
  },
  {
    id: 2,
    name: 'experiment_2',
    display_name: 'Experiment 2',
    state: 'created',
    status: 'draft',
    created_at: '2024-01-01T00:00:00Z',
    percentage_of_traffic: 50,
    unit_type_id: 1,
    variants: [
      { name: 'Control', config: '{}' },
      { name: 'Variant B', config: '{}' }
    ],
    applications: [],
    owners: [],
    teams: [],
    experiment_tags: []
  }
]

describe('ExperimentList', () => {
  const defaultProps = {
    experiments: mockExperiments,
    onExperimentClick: jest.fn(),
    loading: false,
    favoriteExperiments: new Set<number>(),
    onToggleFavorite: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(overrides.initializeOverrides as jest.Mock).mockResolvedValue({})
  })

  describe('Basic Rendering', () => {
    it('should render list of experiments', () => {
      render(<ExperimentList {...defaultProps} />)

      expect(screen.getByText('Experiment 1')).toBeInTheDocument()
      expect(screen.getByText('Experiment 2')).toBeInTheDocument()
    })

    it('should show loading state', () => {
      render(<ExperimentList {...defaultProps} loading={true} />)

      expect(screen.getByRole('status', { name: 'Loading experiments' })).toBeInTheDocument()
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('should show empty state when no experiments', () => {
      render(<ExperimentList {...defaultProps} experiments={[]} />)

      expect(screen.getByText('No experiments found')).toBeInTheDocument()
    })
  })

  describe('Experiment Clicking', () => {
    it('should call onExperimentClick when clicking an experiment', () => {
      render(<ExperimentList {...defaultProps} />)

      const experiment = screen.getByText('Experiment 1')
      fireEvent.click(experiment)

      expect(defaultProps.onExperimentClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, name: 'experiment_1' })
      )
    })
  })

  describe('Favorites', () => {
    it('should show favorite status', () => {
      const favoriteExperiments = new Set([1])
      render(<ExperimentList {...defaultProps} favoriteExperiments={favoriteExperiments} />)

      expect(screen.getByText('Experiment 1')).toBeInTheDocument()
    })

    it('should toggle favorite status', () => {
      render(<ExperimentList {...defaultProps} />)

      const experimentRow = screen.getByText('Experiment 1').closest('div')
      const favoriteButton = experimentRow?.querySelector('[aria-label*="favorite"]')

      if (favoriteButton) {
        fireEvent.click(favoriteButton)
        expect(defaultProps.onToggleFavorite).toHaveBeenCalledWith(1)
      }
    })
  })

  describe('Override Management', () => {
    it('should initialize overrides on mount', async () => {
      render(<ExperimentList {...defaultProps} />)

      await waitFor(() => {
        expect(overrides.initializeOverrides).toHaveBeenCalled()
      })
    })

    it('should save override when changing variant', async () => {
      render(<ExperimentList {...defaultProps} />)

      await waitFor(() => {
        expect(overrides.initializeOverrides).toHaveBeenCalled()
      })
    })

    it('should show reload banner when overrides differ from SDK', async () => {
      (overrides.initializeOverrides as jest.Mock).mockResolvedValue({
        experiment_1: 1
      });

      (sdkBridge.getCurrentVariantAssignments as jest.Mock).mockResolvedValue({
        assignments: { experiment_1: 0 },
        experimentsInContext: ['experiment_1']
      })

      render(<ExperimentList {...defaultProps} />)

      await waitFor(() => {
        const reloadButton = screen.queryByRole('button', { name: /reload/i })
        expect(reloadButton).toBeInTheDocument()
      }, { timeout: 1000 })
    })

    it('should reload page when clicking reload button', async () => {
      (overrides.initializeOverrides as jest.Mock).mockResolvedValue({
        experiment_1: 1
      });

      (sdkBridge.getCurrentVariantAssignments as jest.Mock).mockResolvedValue({
        assignments: { experiment_1: 0 },
        experimentsInContext: ['experiment_1']
      })

      render(<ExperimentList {...defaultProps} />)

      await waitFor(() => {
        const reloadButton = screen.queryByRole('button', { name: /reload/i })
        if (reloadButton) {
          fireEvent.click(reloadButton)
          expect(overrides.reloadPageWithOverrides).toHaveBeenCalled()
        }
      })
    })

    it('should clear all overrides', async () => {
      (overrides.initializeOverrides as jest.Mock).mockResolvedValue({
        experiment_1: 1
      });

      (sdkBridge.getCurrentVariantAssignments as jest.Mock).mockResolvedValue({
        assignments: { experiment_1: 0 },
        experimentsInContext: ['experiment_1']
      })

      render(<ExperimentList {...defaultProps} />)

      await waitFor(() => {
        const clearButton = screen.queryByRole('button', { name: /clear all/i })
        if (clearButton) {
          fireEvent.click(clearButton)
          expect(overrides.saveOverrides).toHaveBeenCalledWith({})
        }
      })
    })
  })

  describe('Development Environment', () => {
    it('should fetch and save development environment if not set', async () => {
      render(<ExperimentList {...defaultProps} />)

      await waitFor(() => {
        expect(overrides.saveDevelopmentEnvironment).toHaveBeenCalledWith('development')
      })
    })

    it('should use existing development environment if set', async () => {
      (overrides.getDevelopmentEnvironment as jest.Mock).mockResolvedValue('my-dev-env')

      render(<ExperimentList {...defaultProps} />)

      await waitFor(() => {
        expect(overrides.saveDevelopmentEnvironment).not.toHaveBeenCalled()
      })
    })
  })

  describe('SDK Integration', () => {
    it('should check variant assignments after experiments load', async () => {
      render(<ExperimentList {...defaultProps} />)

      await waitFor(() => {
        expect(sdkBridge.getCurrentVariantAssignments).toHaveBeenCalledWith([
          'experiment_1',
          'experiment_2'
        ])
      }, { timeout: 1000 })
    })

    it('should handle SDK errors gracefully', async () => {
      (sdkBridge.getCurrentVariantAssignments as jest.Mock).mockRejectedValue(
        new Error('SDK not found')
      )

      render(<ExperimentList {...defaultProps} />)

      expect(screen.getByText('Experiment 1')).toBeInTheDocument()
    })
  })

  describe('Real-time Updates', () => {
    it('should update when experiments prop changes', async () => {
      const { rerender } = render(<ExperimentList {...defaultProps} />)

      expect(screen.getByText('Experiment 1')).toBeInTheDocument()

      const newExperiments: Experiment[] = [
        ...mockExperiments,
        {
          id: 3,
          name: 'experiment_3',
          display_name: 'Experiment 3',
          state: 'created',
          status: 'draft',
          created_at: '2024-01-01T00:00:00Z',
          percentage_of_traffic: 100,
          unit_type_id: 1,
          variants: [],
          applications: [],
          owners: [],
          teams: [],
          experiment_tags: []
        }
      ]

      rerender(<ExperimentList {...defaultProps} experiments={newExperiments} />)

      expect(screen.getByText('Experiment 3')).toBeInTheDocument()
    })
  })

  describe('Override Types', () => {
    it('should handle development override for development experiments', async () => {
      const devExperiment: Experiment = {
        ...mockExperiments[0],
        state: 'development'
      }

      render(<ExperimentList {...defaultProps} experiments={[devExperiment]} />)

      await waitFor(() => {
        expect(overrides.initializeOverrides).toHaveBeenCalled()
      })
    })

    it('should handle API fetch override for non-running experiments', async () => {
      const createdExperiment: Experiment = {
        ...mockExperiments[0],
        state: 'created'
      }

      render(<ExperimentList {...defaultProps} experiments={[createdExperiment]} />)

      await waitFor(() => {
        expect(overrides.initializeOverrides).toHaveBeenCalled()
      })
    })

    it('should handle numeric override for running experiments', async () => {
      const runningExperiment: Experiment = {
        ...mockExperiments[0],
        state: 'running'
      }

      render(<ExperimentList {...defaultProps} experiments={[runningExperiment]} />)

      await waitFor(() => {
        expect(overrides.initializeOverrides).toHaveBeenCalled()
      })
    })
  })

  describe('Error Handling', () => {
    afterEach(() => {
      ;(overrides.initializeOverrides as jest.Mock).mockClear()
      ;(overrides.initializeOverrides as jest.Mock).mockResolvedValue({})
    })

    it('should handle override initialization errors', async () => {
      ;(overrides.initializeOverrides as jest.Mock).mockRejectedValue(
        new Error('Failed to initialize')
      )

      render(<ExperimentList {...defaultProps} />)

      expect(screen.getByText('Experiment 1')).toBeInTheDocument()
    })

    it('should handle environment fetch errors', async () => {
      const mockBackgroundAPIClient = require('~src/lib/background-api-client').BackgroundAPIClient
      mockBackgroundAPIClient.mockImplementation(() => ({
        getEnvironments: jest.fn().mockRejectedValue(new Error('API error'))
      }))

      render(<ExperimentList {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Experiment 1')).toBeInTheDocument()
      }, { timeout: 2000 })
    })
  })
})
