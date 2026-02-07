import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ExperimentDetail } from '../ExperimentDetail'
import type { Experiment, ExperimentInjectionCode } from '~src/types/absmartly'
import * as messaging from '~src/lib/messaging'
import * as storage from '~src/utils/storage'
import * as storageCleanup from '~src/utils/storage-cleanup'

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
  },
  sessionStorage: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined)
  }
}))

jest.mock('~src/utils/storage-cleanup', () => ({
  clearAllExperimentStorage: jest.fn().mockResolvedValue(undefined)
}))

jest.mock('~src/hooks/useEditorStateRestoration', () => ({
  useEditorStateRestoration: jest.fn(() => ({
    isRestoring: false,
    restoredVariant: null,
    restoredChange: null,
    clearRestoration: jest.fn()
  }))
}))

jest.mock('~src/hooks/useVisualEditorCoordination', () => ({
  useVisualEditorCoordination: jest.fn(() => ({
    handleStartVisualEditor: jest.fn(),
    handleStopVisualEditor: jest.fn(),
    cleanup: jest.fn()
  }))
}))

jest.mock('~src/hooks/useExperimentVariants', () => ({
  useExperimentVariants: jest.fn(() => ({
    initialVariants: [
      { name: 'Control', config: JSON.stringify({ __dom_changes: [] }) },
      { name: 'Variant A', config: JSON.stringify({ __dom_changes: [] }) }
    ],
    currentVariants: [
      { name: 'Control', config: JSON.stringify({ __dom_changes: [] }) },
      { name: 'Variant A', config: JSON.stringify({ __dom_changes: [] }) }
    ],
    hasUnsavedChanges: false,
    setHasUnsavedChanges: jest.fn(),
    handleVariantsChange: jest.fn()
  }))
}))

jest.mock('~src/hooks/useExperimentSave', () => ({
  useExperimentSave: jest.fn(() => ({
    save: jest.fn().mockResolvedValue(undefined),
    saving: false,
    saveError: null
  }))
}))

jest.mock('~src/components/VariantList', () => ({
  VariantList: ({ initialVariants = [] }: any) => {
    return (
      <div data-testid="variant-list">
        {initialVariants.map((v: any, i: number) => (
          <div key={i} data-testid={`variant-${i}`}>{v.name}</div>
        ))}
      </div>
    )
  }
}))

jest.mock('~src/components/ExperimentMetadata', () => ({
  ExperimentMetadata: () => <div data-testid="experiment-metadata">Metadata</div>
}))

jest.mock('~src/components/ExperimentCodeInjection', () => ({
  ExperimentCodeInjection: () => <div data-testid="code-injection">Code Injection</div>
}))

jest.mock('~src/components/ExperimentDetail/ExperimentActions', () => ({
  ExperimentActions: () => <div data-testid="experiment-actions">Actions</div>
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

const mockExperiment: Experiment = {
  id: 123,
  name: 'test_experiment',
  display_name: 'Test Experiment',
  state: 'created',
  status: 'draft',
  percentage_of_traffic: 100,
  unit_type_id: 1,
  unit_type: { unit_type_id: 1, name: 'user_id' },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  variants: [
    {
      name: 'Control',
      config: JSON.stringify({
        __dom_changes: []
      })
    },
    {
      name: 'Variant A',
      config: JSON.stringify({
        __dom_changes: [
          {
            selector: '.btn',
            type: 'style',
            value: { color: 'red' }
          }
        ]
      })
    }
  ],
  applications: [],
  owners: [],
  teams: [],
  experiment_tags: []
}

describe('ExperimentDetail', () => {
  const defaultProps = {
    experiment: mockExperiment,
    onBack: jest.fn(),
    onStart: jest.fn(),
    onStop: jest.fn(),
    onUpdate: jest.fn(),
    loading: false,
    applications: [],
    unitTypes: [{ unit_type_id: 1, name: 'user_id' }],
    owners: [],
    teams: [],
    tags: [],
    onError: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render experiment with variants', () => {
      render(<ExperimentDetail {...defaultProps} />)

      expect(screen.getAllByText('Test Experiment')[0]).toBeInTheDocument()
      expect(screen.getByText('Control')).toBeInTheDocument()
      expect(screen.getByText('Variant A')).toBeInTheDocument()
    })

    it('should show loading state', () => {
      render(<ExperimentDetail {...defaultProps} loading={true} />)

      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('should display experiment state badge', () => {
      render(<ExperimentDetail {...defaultProps} />)

      expect(screen.getByText('Draft')).toBeInTheDocument()
    })
  })

  describe('Edit Experiment Name', () => {
    it('should enter edit mode when clicking display name', () => {
      const { container } = render(<ExperimentDetail {...defaultProps} />)

      const displayName = container.querySelector('h2')
      if (displayName) {
        fireEvent.click(displayName)
      }

      const input = screen.getByDisplayValue('Test Experiment')
      expect(input).toBeInTheDocument()
    })

    it('should save display name on check icon click', async () => {
      const { container } = render(<ExperimentDetail {...defaultProps} />)

      const displayName = container.querySelector('h2')
      if (displayName) {
        fireEvent.click(displayName)
      }

      const input = screen.getByDisplayValue('Test Experiment')
      fireEvent.change(input, { target: { value: 'Updated Name' } })

      const buttons = screen.getAllByRole('button')
      const saveButton = buttons.find(btn => btn.querySelector('svg'))
      if (saveButton) {
        fireEvent.click(saveButton)
      }

      await waitFor(() => {
        expect(defaultProps.onUpdate).toHaveBeenCalledWith(123, {
          display_name: 'Updated Name'
        })
      })
    })

    it('should cancel edit on X icon click', () => {
      const { container } = render(<ExperimentDetail {...defaultProps} />)

      const displayName = container.querySelector('h2')
      if (displayName) {
        fireEvent.click(displayName)
      }

      const input = screen.getByDisplayValue('Test Experiment')
      fireEvent.change(input, { target: { value: 'Updated Name' } })

      const cancelButtons = screen.getAllByRole('button', { name: '' })
      const cancelButton = cancelButtons[1]
      fireEvent.click(cancelButton)

      expect(screen.queryByDisplayValue('Updated Name')).not.toBeInTheDocument()
      expect(screen.getByText('Test Experiment')).toBeInTheDocument()
    })
  })

  describe('Unsaved Changes Warning', () => {
    it('should not show warning when navigating back with no changes', async () => {
      window.confirm = jest.fn(() => true)

      render(<ExperimentDetail {...defaultProps} />)

      const backButton = screen.getByRole('button', { name: /back/i })
      fireEvent.click(backButton)

      expect(window.confirm).not.toHaveBeenCalled()
      expect(defaultProps.onBack).toHaveBeenCalled()
    })

    it('should show confirmation dialog when navigating back with unsaved changes', async () => {
      window.confirm = jest.fn(() => true)

      render(<ExperimentDetail {...defaultProps} />)

      const displayName = screen.getByText('Test Experiment')
      fireEvent.click(displayName)

      const input = screen.getByDisplayValue('Test Experiment')
      fireEvent.change(input, { target: { value: 'Modified Name' } })

      const backButton = screen.getByRole('button', { name: /back/i })
      fireEvent.click(backButton)

      expect(window.confirm).toHaveBeenCalledWith('You have unsaved changes. Do you want to discard them?')
    })

    it('should clear storage when discarding changes', async () => {
      window.confirm = jest.fn(() => true)

      render(<ExperimentDetail {...defaultProps} />)

      const displayName = screen.getByText('Test Experiment')
      fireEvent.click(displayName)

      const input = screen.getByDisplayValue('Test Experiment')
      fireEvent.change(input, { target: { value: 'Modified Name' } })

      const backButton = screen.getByRole('button', { name: /back/i })
      fireEvent.click(backButton)

      await waitFor(() => {
        expect(storageCleanup.clearAllExperimentStorage).toHaveBeenCalledWith(123)
      })
    })

    it('should not navigate when user cancels discard', async () => {
      window.confirm = jest.fn(() => false)

      render(<ExperimentDetail {...defaultProps} />)

      const displayName = screen.getByText('Test Experiment')
      fireEvent.click(displayName)

      const input = screen.getByDisplayValue('Test Experiment')
      fireEvent.change(input, { target: { value: 'Modified Name' } })

      const backButton = screen.getByRole('button', { name: /back/i })
      fireEvent.click(backButton)

      expect(defaultProps.onBack).not.toHaveBeenCalled()
    })
  })

  describe('Save Experiment', () => {
    it('should save experiment with all form data', async () => {
      const mockSendMessage = jest.fn().mockResolvedValue({ success: true })
      global.chrome.runtime.sendMessage = mockSendMessage

      render(<ExperimentDetail {...defaultProps} />)

      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'UPDATE_EXPERIMENT'
          })
        )
      })
    })

    it('should clear storage after successful save', async () => {
      const mockSendMessage = jest.fn().mockResolvedValue({ success: true })
      global.chrome.runtime.sendMessage = mockSendMessage

      render(<ExperimentDetail {...defaultProps} />)

      const displayName = screen.getByText('Test Experiment')
      fireEvent.click(displayName)

      const input = screen.getByDisplayValue('Test Experiment')
      fireEvent.change(input, { target: { value: 'Updated' } })

      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(storageCleanup.clearAllExperimentStorage).toHaveBeenCalledWith(123)
      })
    })

    it('should handle save errors', async () => {
      const mockSendMessage = jest.fn().mockRejectedValue(new Error('Save failed'))
      global.chrome.runtime.sendMessage = mockSendMessage

      render(<ExperimentDetail {...defaultProps} />)

      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalledWith(expect.stringContaining('Save failed'))
      })
    })

    it('should disable save button during loading', () => {
      render(<ExperimentDetail {...defaultProps} loading={true} />)

      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      expect(saveButton).toBeDisabled()
    })

    it('should disable save button when experiment is running', () => {
      const runningExperiment: Experiment = { ...mockExperiment, state: 'running' as const }
      render(<ExperimentDetail {...defaultProps} experiment={runningExperiment} />)

      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      expect(saveButton).toBeDisabled()
    })

    it('should highlight save button when there are unsaved changes', async () => {
      render(<ExperimentDetail {...defaultProps} />)

      const displayName = screen.getByText('Test Experiment')
      fireEvent.click(displayName)

      const input = screen.getByDisplayValue('Test Experiment')
      fireEvent.change(input, { target: { value: 'Modified' } })

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /• Save Changes/i })
        expect(saveButton).toHaveClass('ring-2', 'ring-yellow-400')
      })
    })
  })

  describe('Variant Management', () => {
    it('should prevent concurrent save button clicks', async () => {
      const mockSendMessage = jest.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      )
      global.chrome.runtime.sendMessage = mockSendMessage

      render(<ExperimentDetail {...defaultProps} />)

      const saveButton = screen.getByRole('button', { name: /Save Changes/i })

      fireEvent.click(saveButton)
      fireEvent.click(saveButton)
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledTimes(1)
      })
    })

    it('should show warning when experiment is running', () => {
      const runningExperiment: Experiment = { ...mockExperiment, state: 'running' as const }
      render(<ExperimentDetail {...defaultProps} experiment={runningExperiment} />)

      expect(screen.getByText(/Experiment is running/i)).toBeInTheDocument()
      expect(screen.getByText(/Changes cannot be saved while the experiment is active/i)).toBeInTheDocument()
    })

    it('should show warning when experiment is in development', () => {
      const devExperiment: Experiment = { ...mockExperiment, state: 'development' as const }
      render(<ExperimentDetail {...defaultProps} experiment={devExperiment} />)

      expect(screen.getByText(/Experiment is in development/i)).toBeInTheDocument()
    })
  })

  describe('Cleanup on Navigation', () => {
    it('should stop visual editor on back navigation', async () => {
      render(<ExperimentDetail {...defaultProps} />)

      const backButton = screen.getByRole('button', { name: /back/i })
      fireEvent.click(backButton)

      await waitFor(() => {
        expect(messaging.sendToContent).toHaveBeenCalledWith({
          type: 'STOP_VISUAL_EDITOR'
        })
      })
    })

    it('should remove preview on back navigation', async () => {
      render(<ExperimentDetail {...defaultProps} />)

      const backButton = screen.getByRole('button', { name: /back/i })
      fireEvent.click(backButton)

      await waitFor(() => {
        expect(messaging.sendToContent).toHaveBeenCalledWith({
          type: 'ABSMARTLY_PREVIEW',
          action: 'remove',
          experimentName: 'test_experiment'
        })
      })
    })

    it('should continue navigation if cleanup fails', async () => {
      (messaging.sendToContent as jest.Mock).mockRejectedValue(new Error('Cleanup failed'))

      render(<ExperimentDetail {...defaultProps} />)

      const backButton = screen.getByRole('button', { name: /back/i })
      fireEvent.click(backButton)

      await waitFor(() => {
        expect(defaultProps.onBack).toHaveBeenCalled()
      })
    })
  })

  describe('Error States', () => {
    it('should handle storage clear errors gracefully', async () => {
      (storageCleanup.clearAllExperimentStorage as jest.Mock).mockRejectedValue(
        new Error('Storage error')
      )

      const mockSendMessage = jest.fn().mockResolvedValue({ success: true })
      global.chrome.runtime.sendMessage = mockSendMessage

      render(<ExperimentDetail {...defaultProps} />)

      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalled()
      })
    })

    it('should handle missing variant config', () => {
      const experimentWithoutConfig: Experiment = {
        ...mockExperiment,
        variants: [
          {
            name: 'Control',
            config: '{}'
          }
        ]
      }

      render(<ExperimentDetail {...defaultProps} experiment={experimentWithoutConfig} />)

      expect(screen.getByText('Control')).toBeInTheDocument()
    })
  })

  describe('Injection Code Handling', () => {
    it('should update injection code for control variant', async () => {
      render(<ExperimentDetail {...defaultProps} />)

      const injectionCode = {
        html: '<div>Test</div>',
        position: 'before' as const,
        selector: 'body'
      }

      const event = new CustomEvent('injection-code-change', { detail: injectionCode })
      window.dispatchEvent(event)

      await waitFor(() => {
        expect(screen.getByText('Control')).toBeInTheDocument()
      })
    })
  })
})
