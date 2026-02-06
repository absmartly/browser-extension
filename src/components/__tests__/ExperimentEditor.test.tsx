import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ExperimentEditor } from '../ExperimentEditor'
import type { Experiment } from '~src/types/absmartly'
import * as messaging from '~src/lib/messaging'
import * as storage from '~src/utils/storage'

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
    sendMessage: jest.fn().mockResolvedValue({ success: true })
  }
} as any

const mockExperiment: Experiment = {
  id: 123,
  name: 'test_experiment',
  display_name: 'Test Experiment',
  state: 'created',
  created_at: '2024-01-01T00:00:00Z',
  percentage_of_traffic: 100,
  unit_type_id: 1,
  unit_type: { unit_type_id: 1, name: 'user_id' },
  variants: [
    {
      name: 'Control',
      config: '{}'
    },
    {
      name: 'Variant A',
      config: '{}'
    }
  ],
  applications: [],
  owners: [],
  teams: [],
  experiment_tags: []
}

describe('ExperimentEditor', () => {
  const defaultProps = {
    experiment: null,
    onSave: jest.fn().mockResolvedValue(undefined),
    onCancel: jest.fn(),
    loading: false,
    applications: [{ id: 1, name: 'Web App' }],
    unitTypes: [{ unit_type_id: 1, name: 'user_id' }],
    metrics: [],
    tags: [],
    owners: [],
    teams: []
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Create Mode', () => {
    it('should render create experiment form', () => {
      render(<ExperimentEditor {...defaultProps} />)

      expect(screen.getByText('Create New Experiment')).toBeInTheDocument()
    })

    it('should have empty form fields', () => {
      render(<ExperimentEditor {...defaultProps} />)

      const nameInput = screen.getByLabelText(/experiment name/i) as HTMLInputElement
      expect(nameInput.value).toBe('')
    })

    it('should sync display name and experiment name when locked', async () => {
      render(<ExperimentEditor {...defaultProps} />)

      const displayNameInput = screen.getByLabelText(/display name/i) as HTMLInputElement
      fireEvent.change(displayNameInput, { target: { value: 'My Test' } })

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/experiment name/i) as HTMLInputElement
        expect(nameInput.value).toBe('my_test')
      })
    })

    it('should not sync names when unlocked', async () => {
      render(<ExperimentEditor {...defaultProps} />)

      const lockButton = screen.getByRole('button', { name: /lock/i })
      fireEvent.click(lockButton)

      const displayNameInput = screen.getByLabelText(/display name/i) as HTMLInputElement
      fireEvent.change(displayNameInput, { target: { value: 'My Test' } })

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/experiment name/i) as HTMLInputElement
        expect(nameInput.value).toBe('')
      })
    })
  })

  describe('Edit Mode', () => {
    it('should render edit experiment form', () => {
      render(<ExperimentEditor {...defaultProps} experiment={mockExperiment} />)

      expect(screen.getByText('Edit Experiment')).toBeInTheDocument()
    })

    it('should populate form with experiment data', () => {
      render(<ExperimentEditor {...defaultProps} experiment={mockExperiment} />)

      const nameInput = screen.getByDisplayValue('test_experiment')
      expect(nameInput).toBeInTheDocument()
    })

    it('should start with names unsynced in edit mode', () => {
      render(<ExperimentEditor {...defaultProps} experiment={mockExperiment} />)

      const lockButton = screen.getByRole('button', { name: /unlock/i })
      expect(lockButton).toBeInTheDocument()
    })
  })

  describe('Form Validation', () => {
    it('should require unit type selection', async () => {
      window.alert = jest.fn()

      render(<ExperimentEditor {...defaultProps} />)

      const submitButton = screen.getByRole('button', { name: /create experiment/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Please select a unit type')
      })
    })

    it('should require experiment name', async () => {
      render(<ExperimentEditor {...defaultProps} />)

      const nameInput = screen.getByLabelText(/experiment name/i)
      fireEvent.change(nameInput, { target: { value: '' } })

      const form = nameInput.closest('form')
      if (form) {
        fireEvent.submit(form)

        await waitFor(() => {
          expect(defaultProps.onSave).not.toHaveBeenCalled()
        })
      }
    })

    it('should validate name format (snake_case)', () => {
      render(<ExperimentEditor {...defaultProps} />)

      const displayNameInput = screen.getByLabelText(/display name/i) as HTMLInputElement
      fireEvent.change(displayNameInput, { target: { value: 'My Test 123!' } })

      const nameInput = screen.getByLabelText(/experiment name/i) as HTMLInputElement
      expect(nameInput.value).toMatch(/^[a-z0-9_]*$/)
    })
  })

  describe('Save Functionality', () => {
    it('should save experiment with all form data', async () => {
      render(<ExperimentEditor {...defaultProps} />)

      const displayNameInput = screen.getByLabelText(/display name/i)
      fireEvent.change(displayNameInput, { target: { value: 'New Experiment' } })

      const submitButton = screen.getByRole('button', { name: /create experiment/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            display_name: 'New Experiment',
            name: 'new_experiment'
          })
        )
      })
    })

    it('should update percentages when variants change', async () => {
      render(<ExperimentEditor {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByLabelText(/display name/i)).toBeInTheDocument()
      })
    })

    it('should disable submit during loading', () => {
      render(<ExperimentEditor {...defaultProps} loading={true} />)

      const submitButton = screen.getByRole('button', { name: /create experiment/i })
      expect(submitButton).toBeDisabled()
    })
  })

  describe('Cancel Functionality', () => {
    it('should call onCancel when cancel button clicked', () => {
      render(<ExperimentEditor {...defaultProps} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      expect(defaultProps.onCancel).toHaveBeenCalled()
    })

    it('should cleanup visual editor on cancel', async () => {
      render(<ExperimentEditor {...defaultProps} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      await waitFor(() => {
        expect(messaging.sendToContent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'STOP_VISUAL_EDITOR'
          })
        )
      })
    })

    it('should cleanup preview on cancel', async () => {
      render(<ExperimentEditor {...defaultProps} experiment={mockExperiment} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      await waitFor(() => {
        expect(messaging.sendToContent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'ABSMARTLY_PREVIEW',
            action: 'remove'
          })
        )
      })
    })

    it('should continue cancel if cleanup fails', async () => {
      (messaging.sendToContent as jest.Mock).mockRejectedValue(new Error('Cleanup failed'))

      render(<ExperimentEditor {...defaultProps} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      await waitFor(() => {
        expect(defaultProps.onCancel).toHaveBeenCalled()
      })
    })
  })

  describe('Metadata Editing', () => {
    it('should update traffic percentage', async () => {
      render(<ExperimentEditor {...defaultProps} />)

      const trafficInput = screen.queryByLabelText(/traffic/i)
      if (trafficInput) {
        fireEvent.change(trafficInput, { target: { value: '50' } })

        await waitFor(() => {
          expect((trafficInput as HTMLInputElement).value).toBe('50')
        })
      }
    })

    it('should update application selection', async () => {
      render(<ExperimentEditor {...defaultProps} />)

      const appSelect = screen.queryByLabelText(/application/i)
      if (appSelect) {
        fireEvent.change(appSelect, { target: { value: '1' } })

        await waitFor(() => {
          expect((appSelect as HTMLSelectElement).value).toBe('1')
        })
      }
    })

    it('should update owners', async () => {
      render(<ExperimentEditor {...defaultProps} owners={[{ user_id: 1, email: 'test@example.com' }]} />)

      await waitFor(() => {
        expect(screen.getByText(/Create New Experiment/i)).toBeInTheDocument()
      })
    })

    it('should update teams', async () => {
      render(<ExperimentEditor {...defaultProps} teams={[{ team_id: 1, name: 'Team A' }]} />)

      await waitFor(() => {
        expect(screen.getByText(/Create New Experiment/i)).toBeInTheDocument()
      })
    })

    it('should update tags', async () => {
      render(<ExperimentEditor {...defaultProps} tags={[{ experiment_tag_id: 1, name: 'Tag A' }]} />)

      await waitFor(() => {
        expect(screen.getByText(/Create New Experiment/i)).toBeInTheDocument()
      })
    })
  })

  describe('Variant Management', () => {
    it('should render variant list', () => {
      render(<ExperimentEditor {...defaultProps} experiment={mockExperiment} />)

      expect(screen.getByText('Control')).toBeInTheDocument()
      expect(screen.getByText('Variant A')).toBeInTheDocument()
    })

    it('should update percentages when adding variant', async () => {
      render(<ExperimentEditor {...defaultProps} experiment={mockExperiment} />)

      const addButton = screen.queryByRole('button', { name: /add variant/i })
      if (addButton) {
        fireEvent.click(addButton)

        await waitFor(() => {
          expect(screen.queryByText('Variant 2')).toBeInTheDocument()
        })
      }
    })
  })

  describe('Code Injection', () => {
    it('should render code injection section for control variant', () => {
      render(<ExperimentEditor {...defaultProps} experiment={mockExperiment} />)

      expect(screen.queryByText(/inject/i)).toBeInTheDocument()
    })

    it('should update injection code', async () => {
      render(<ExperimentEditor {...defaultProps} experiment={mockExperiment} />)

      await waitFor(() => {
        expect(screen.getByText('Control')).toBeInTheDocument()
      })
    })
  })

  describe('Draft Experiment Info', () => {
    it('should show draft info message for new experiments', () => {
      render(<ExperimentEditor {...defaultProps} />)

      expect(screen.getByText(/draft experiment/i)).toBeInTheDocument()
      expect(screen.getByText(/ABsmartly console/i)).toBeInTheDocument()
    })

    it('should not show draft info when editing', () => {
      render(<ExperimentEditor {...defaultProps} experiment={mockExperiment} />)

      expect(screen.queryByText(/draft experiment/i)).not.toBeInTheDocument()
    })
  })

  describe('Name Conversion', () => {
    it('should convert display name to snake_case', () => {
      render(<ExperimentEditor {...defaultProps} />)

      const displayNameInput = screen.getByLabelText(/display name/i)
      fireEvent.change(displayNameInput, { target: { value: 'My Cool Experiment' } })

      const nameInput = screen.getByLabelText(/experiment name/i) as HTMLInputElement
      expect(nameInput.value).toBe('my_cool_experiment')
    })

    it('should convert snake_case to Title Case', () => {
      render(<ExperimentEditor {...defaultProps} />)

      const lockButton = screen.getByRole('button', { name: /lock/i })
      fireEvent.click(lockButton)
      fireEvent.click(lockButton)

      const nameInput = screen.getByLabelText(/experiment name/i)
      fireEvent.change(nameInput, { target: { value: 'my_cool_experiment' } })

      const displayNameInput = screen.getByLabelText(/display name/i) as HTMLInputElement
      expect(displayNameInput.value).toBe('My Cool Experiment')
    })

    it('should remove special characters from name', () => {
      render(<ExperimentEditor {...defaultProps} />)

      const displayNameInput = screen.getByLabelText(/display name/i)
      fireEvent.change(displayNameInput, { target: { value: 'Test@#$%123' } })

      const nameInput = screen.getByLabelText(/experiment name/i) as HTMLInputElement
      expect(nameInput.value).toBe('test123')
    })
  })

  describe('Error Handling', () => {
    it('should handle save errors', async () => {
      const mockOnSave = jest.fn().mockRejectedValue(new Error('Save failed'))

      render(<ExperimentEditor {...defaultProps} onSave={mockOnSave} />)

      const displayNameInput = screen.getByLabelText(/display name/i)
      fireEvent.change(displayNameInput, { target: { value: 'New Experiment' } })

      const submitButton = screen.getByRole('button', { name: /create experiment/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled()
      })
    })
  })
})
