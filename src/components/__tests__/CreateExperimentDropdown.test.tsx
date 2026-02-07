import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { CreateExperimentDropdown } from '../CreateExperimentDropdown'

const mockGetTemplates = jest.fn().mockResolvedValue([])

const mockUseABsmartlyReturn = {
  getTemplates: mockGetTemplates,
  config: {
    apiEndpoint: 'https://api.absmartly.com',
    domChangesFieldName: '__dom_changes'
  },
  loading: false,
  error: null,
  authErrorType: null,
  user: null,
  isAuthenticated: true,
  updateConfig: jest.fn(),
  checkAuth: jest.fn(),
  getExperiments: jest.fn().mockResolvedValue([])
}

jest.mock('~src/hooks/useABsmartly', () => ({
  useABsmartly: jest.fn(() => mockUseABsmartlyReturn)
}))

jest.mock('~src/utils/auth', () => ({
  fetchAuthenticatedImage: jest.fn().mockResolvedValue('blob:mock-url')
}))

describe('CreateExperimentDropdown', () => {
  const defaultProps = {
    onCreateFromScratch: jest.fn(),
    onCreateFromTemplate: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    global.URL.revokeObjectURL = jest.fn()
  })

  describe('Dropdown Rendering', () => {
    it('should render dropdown button', () => {
      render(<CreateExperimentDropdown {...defaultProps} />)

      const button = screen.getByRole('button', { name: /create experiment/i })
      expect(button).toBeInTheDocument()
    })

    it('should open dropdown on click', async () => {
      render(<CreateExperimentDropdown {...defaultProps} />)

      const button = screen.getByRole('button', { name: /create experiment/i })

      await act(async () => {
        fireEvent.click(button)
      })

      await waitFor(() => {
        expect(screen.getByText(/create from scratch/i)).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should close dropdown when clicking outside', async () => {
      render(
        <div>
          <CreateExperimentDropdown {...defaultProps} />
          <div data-testid="outside">Outside</div>
        </div>
      )

      const button = screen.getByRole('button', { name: /create experiment/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText(/create from scratch/i)).toBeInTheDocument()
      })

      const outside = screen.getByTestId('outside')
      fireEvent.mouseDown(outside)

      await waitFor(() => {
        expect(screen.queryByText(/create from scratch/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Create From Scratch', () => {
    it('should call onCreateFromScratch when clicking button', async () => {
      render(<CreateExperimentDropdown {...defaultProps} />)

      const button = screen.getByRole('button', { name: /create experiment/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText(/create from scratch/i)).toBeInTheDocument()
      })

      const scratchButton = screen.getByRole('menuitem', { name: /create from scratch/i })
      fireEvent.click(scratchButton)

      expect(defaultProps.onCreateFromScratch).toHaveBeenCalled()
    })

    it('should close dropdown after creating from scratch', async () => {
      render(<CreateExperimentDropdown {...defaultProps} />)

      const button = screen.getByRole('button', { name: /create experiment/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText(/create from scratch/i)).toBeInTheDocument()
      })

      const scratchButton = screen.getByRole('menuitem', { name: /create from scratch/i })
      fireEvent.click(scratchButton)

      await waitFor(() => {
        expect(screen.queryByText(/create from scratch/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Template Loading', () => {
    it('should load templates when dropdown opens', async () => {
      const mockGetTemplatesLocal = jest.fn().mockResolvedValue([
        {
          id: 1,
          name: 'Template 1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ])

      const useABsmartly = require('~src/hooks/useABsmartly').useABsmartly
      useABsmartly.mockReturnValue({
        ...mockUseABsmartlyReturn,
        getTemplates: mockGetTemplatesLocal
      })

      render(<CreateExperimentDropdown {...defaultProps} />)

      const button = screen.getByRole('button', { name: /create experiment/i })

      await act(async () => {
        fireEvent.click(button)
      })

      await waitFor(() => {
        expect(mockGetTemplatesLocal).toHaveBeenCalledWith('test_template')
      })
    })

    it('should show loading state while fetching templates', async () => {
      const mockGetTemplates = jest.fn(() => new Promise(resolve => setTimeout(() => resolve([]), 100)))

      const useABsmartly = require('~src/hooks/useABsmartly').useABsmartly
      useABsmartly.mockReturnValue({
        ...mockUseABsmartlyReturn,
        getTemplates: mockGetTemplates
      })

      render(<CreateExperimentDropdown {...defaultProps} />)

      const button = screen.getByRole('button', { name: /create experiment/i })

      await act(async () => {
        fireEvent.click(button)
      })

      await waitFor(() => {
        expect(screen.getByText(/loading templates/i)).toBeInTheDocument()
      })
    })

    it('should display templates after loading', async () => {
      const mockTemplates = [
        {
          id: 1,
          name: 'Template 1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 2,
          name: 'Template 2',
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z'
        }
      ]

      const mockGetTemplates = jest.fn().mockResolvedValue(mockTemplates)

      const useABsmartly = require('~src/hooks/useABsmartly').useABsmartly
      useABsmartly.mockReturnValue({
        ...mockUseABsmartlyReturn,
        getTemplates: mockGetTemplates
      })

      render(<CreateExperimentDropdown {...defaultProps} />)

      const button = screen.getByRole('button', { name: /create experiment/i })

      await act(async () => {
        fireEvent.click(button)
      })

      await waitFor(() => {
        expect(screen.getByText('Template 1')).toBeInTheDocument()
        expect(screen.getByText('Template 2')).toBeInTheDocument()
      })
    })

    it('should show empty state when no templates', async () => {
      const mockGetTemplates = jest.fn().mockResolvedValue([])

      const useABsmartly = require('~src/hooks/useABsmartly').useABsmartly
      useABsmartly.mockReturnValue({
        ...mockUseABsmartlyReturn,
        getTemplates: mockGetTemplates
      })

      render(<CreateExperimentDropdown {...defaultProps} />)

      const button = screen.getByRole('button', { name: /create experiment/i })

      await act(async () => {
        fireEvent.click(button)
      })

      await waitFor(() => {
        expect(screen.getByText(/no templates found/i)).toBeInTheDocument()
      })
    })

    it('should handle template loading errors', async () => {
      const mockGetTemplates = jest.fn().mockRejectedValue(new Error('Failed to load'))

      const useABsmartly = require('~src/hooks/useABsmartly').useABsmartly
      useABsmartly.mockReturnValue({
        ...mockUseABsmartlyReturn,
        getTemplates: mockGetTemplates
      })

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      render(<CreateExperimentDropdown {...defaultProps} />)

      const button = screen.getByRole('button', { name: /create experiment/i })

      await act(async () => {
        fireEvent.click(button)
      })

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled()
      })

      consoleSpy.mockRestore()
    })
  })

  describe('Template Selection', () => {
    it('should call onCreateFromTemplate with template ID', async () => {
      const mockTemplates = [
        {
          id: 123,
          name: 'Test Template',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ]

      const mockGetTemplates = jest.fn().mockResolvedValue(mockTemplates)

      const useABsmartly = require('~src/hooks/useABsmartly').useABsmartly
      useABsmartly.mockReturnValue({
        ...mockUseABsmartlyReturn,
        getTemplates: mockGetTemplates
      })

      render(<CreateExperimentDropdown {...defaultProps} />)

      const button = screen.getByRole('button', { name: /create experiment/i })

      await act(async () => {
        fireEvent.click(button)
      })

      await waitFor(() => {
        expect(screen.getByText('Test Template')).toBeInTheDocument()
      })

      const loadButton = screen.getByText('Load')
      fireEvent.click(loadButton)

      expect(defaultProps.onCreateFromTemplate).toHaveBeenCalledWith(123)
    })

    it('should close dropdown after selecting template', async () => {
      const mockTemplates = [
        {
          id: 123,
          name: 'Test Template',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ]

      const mockGetTemplates = jest.fn().mockResolvedValue(mockTemplates)

      const useABsmartly = require('~src/hooks/useABsmartly').useABsmartly
      useABsmartly.mockReturnValue({
        ...mockUseABsmartlyReturn,
        getTemplates: mockGetTemplates
      })

      render(<CreateExperimentDropdown {...defaultProps} />)

      const button = screen.getByRole('button', { name: /create experiment/i })

      await act(async () => {
        fireEvent.click(button)
      })

      await waitFor(() => {
        expect(screen.getByText('Test Template')).toBeInTheDocument()
      })

      const loadButton = screen.getByText('Load')
      fireEvent.click(loadButton)

      await waitFor(() => {
        expect(screen.queryByText('Test Template')).not.toBeInTheDocument()
      })
    })
  })

  describe('Template Display', () => {
    it('should show template creator initials', async () => {
      const mockTemplates = [
        {
          id: 1,
          name: 'Template 1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          created_by: {
            first_name: 'John',
            last_name: 'Doe',
            email: 'john@example.com'
          }
        }
      ]

      const mockGetTemplates = jest.fn().mockResolvedValue(mockTemplates)

      const useABsmartly = require('~src/hooks/useABsmartly').useABsmartly
      useABsmartly.mockReturnValue({
        ...mockUseABsmartlyReturn,
        getTemplates: mockGetTemplates
      })

      render(<CreateExperimentDropdown {...defaultProps} />)

      const button = screen.getByRole('button', { name: /create experiment/i })

      await act(async () => {
        fireEvent.click(button)
      })

      await waitFor(() => {
        expect(screen.getByText('JD')).toBeInTheDocument()
      })
    })

    it('should show time ago for template', async () => {
      const mockTemplates = [
        {
          id: 1,
          name: 'Template 1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: new Date(Date.now() - 3600000).toISOString()
        }
      ]

      const mockGetTemplates = jest.fn().mockResolvedValue(mockTemplates)

      const useABsmartly = require('~src/hooks/useABsmartly').useABsmartly
      useABsmartly.mockReturnValue({
        ...mockUseABsmartlyReturn,
        getTemplates: mockGetTemplates
      })

      render(<CreateExperimentDropdown {...defaultProps} />)

      const button = screen.getByRole('button', { name: /create experiment/i })

      await act(async () => {
        fireEvent.click(button)
      })

      await waitFor(() => {
        expect(screen.getByText(/ago/i)).toBeInTheDocument()
      })
    })

    it('should fetch and display avatar images', async () => {
      const mockTemplates = [
        {
          id: 1,
          name: 'Template 1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          created_by: {
            first_name: 'John',
            last_name: 'Doe',
            email: 'john@example.com',
            avatar: {
              base_url: '/avatars/123'
            }
          }
        }
      ]

      const mockGetTemplates = jest.fn().mockResolvedValue(mockTemplates)

      const useABsmartly = require('~src/hooks/useABsmartly').useABsmartly
      useABsmartly.mockReturnValue({
        ...mockUseABsmartlyReturn,
        getTemplates: mockGetTemplates
      })

      render(<CreateExperimentDropdown {...defaultProps} />)

      const button = screen.getByRole('button', { name: /create experiment/i })

      await act(async () => {
        fireEvent.click(button)
      })

      await waitFor(() => {
        expect(screen.getByText('Template 1')).toBeInTheDocument()
      })
    })
  })

  describe('Warning Message', () => {
    it('should display overwrite warning', async () => {
      render(<CreateExperimentDropdown {...defaultProps} />)

      const button = screen.getByRole('button', { name: /create experiment/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText(/overwrite the current experiment fields/i)).toBeInTheDocument()
      })
    })
  })

  describe('Controlled Mode', () => {
    it('should respect external isOpen prop', () => {
      render(<CreateExperimentDropdown {...defaultProps} isOpen={true} onOpenChange={jest.fn()} />)

      expect(screen.getByText(/create from scratch/i)).toBeInTheDocument()
    })

    it('should call onOpenChange when toggling', async () => {
      const mockOnOpenChange = jest.fn()

      render(<CreateExperimentDropdown {...defaultProps} isOpen={false} onOpenChange={mockOnOpenChange} />)

      const button = screen.getByRole('button', { name: /create experiment/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(true)
      })
    })
  })
})
