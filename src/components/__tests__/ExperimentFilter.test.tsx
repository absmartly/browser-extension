import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ExperimentFilter } from '../ExperimentFilter'

global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys, callback) => callback({})),
      set: jest.fn((items, callback) => callback?.()),
      remove: jest.fn((keys, callback) => callback?.())
    }
  }
} as any

describe('ExperimentFilter', () => {
  const mockOnFilterChange = jest.fn()
  const mockUsers = [
    { id: 1, first_name: 'John', last_name: 'Doe' },
    { id: 2, first_name: 'Jane', last_name: 'Smith' }
  ]
  const mockTeams = [
    { id: 1, name: 'Engineering' },
    { id: 2, name: 'Marketing' }
  ]
  const mockTags = [
    { id: 1, tag: 'feature' },
    { id: 2, tag: 'bugfix' }
  ]
  const mockApplications = [
    { id: 1, name: 'web-app' },
    { id: 2, name: 'mobile-app' }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render search input', () => {
      render(<ExperimentFilter onFilterChange={mockOnFilterChange} />)

      expect(screen.getByPlaceholderText(/Search experiments/i)).toBeInTheDocument()
    })

    it('should render filter toggle button', () => {
      render(<ExperimentFilter onFilterChange={mockOnFilterChange} />)

      expect(screen.getByLabelText(/Toggle filters/i)).toBeInTheDocument()
    })

    it('should not show filter panel initially', () => {
      render(<ExperimentFilter onFilterChange={mockOnFilterChange} />)

      expect(screen.queryByText(/Experiment State/i)).not.toBeInTheDocument()
    })

    it('should expand filter panel when toggle is clicked', () => {
      render(<ExperimentFilter onFilterChange={mockOnFilterChange} />)

      const toggleButton = screen.getByLabelText(/Toggle filters/i)
      fireEvent.click(toggleButton)

      expect(screen.getByText(/Experiment State/i)).toBeInTheDocument()
    })
  })

  describe('Initial Filters', () => {
    it('should apply default state filters on mount', () => {
      render(<ExperimentFilter onFilterChange={mockOnFilterChange} />)

      expect(mockOnFilterChange).toHaveBeenCalledWith({
        state: ['created', 'ready']
      })
    })

    it('should apply initial filters from props', () => {
      const initialFilters = {
        state: ['running'],
        search: 'test'
      }

      render(
        <ExperimentFilter
          onFilterChange={mockOnFilterChange}
          initialFilters={initialFilters}
        />
      )

      expect(mockOnFilterChange).toHaveBeenCalledWith(initialFilters)
    })
  })

  describe('Search Filter', () => {
    it('should update search value on input change', () => {
      render(<ExperimentFilter onFilterChange={mockOnFilterChange} />)

      const searchInput = screen.getByPlaceholderText(/Search experiments/i)
      fireEvent.change(searchInput, { target: { value: 'test query' } })

      expect((searchInput as HTMLInputElement).value).toBe('test query')
    })

    it('should debounce search filter changes', async () => {
      jest.useFakeTimers()
      render(<ExperimentFilter onFilterChange={mockOnFilterChange} />)

      const searchInput = screen.getByPlaceholderText(/Search experiments/i)
      fireEvent.change(searchInput, { target: { value: 'test' } })

      expect(mockOnFilterChange).not.toHaveBeenCalledWith(
        expect.objectContaining({ search: 'test' })
      )

      jest.advanceTimersByTime(300)

      await waitFor(() => {
        expect(mockOnFilterChange).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'test' })
        )
      })

      jest.useRealTimers()
    })

    it('should clear search from filters when empty', async () => {
      jest.useFakeTimers()
      const initialFilters = { search: 'test', state: ['running'] }

      render(
        <ExperimentFilter
          onFilterChange={mockOnFilterChange}
          initialFilters={initialFilters}
        />
      )

      const searchInput = screen.getByPlaceholderText(/Search experiments/i)
      fireEvent.change(searchInput, { target: { value: '' } })

      jest.advanceTimersByTime(300)

      await waitFor(() => {
        expect(mockOnFilterChange).toHaveBeenCalledWith({ state: ['running'] })
      })

      jest.useRealTimers()
    })
  })

  describe('State Filter', () => {
    it('should render all experiment state options', () => {
      render(<ExperimentFilter onFilterChange={mockOnFilterChange} />)

      const toggleButton = screen.getByLabelText(/Toggle filters/i)
      fireEvent.click(toggleButton)

      expect(screen.getByText('Draft')).toBeInTheDocument()
      expect(screen.getByText('Ready')).toBeInTheDocument()
      expect(screen.getByText('Running')).toBeInTheDocument()
      expect(screen.getByText('Stopped')).toBeInTheDocument()
      expect(screen.getByText('Archived')).toBeInTheDocument()
    })

    it('should toggle state filter on click', () => {
      render(<ExperimentFilter onFilterChange={mockOnFilterChange} />)

      const toggleButton = screen.getByLabelText(/Toggle filters/i)
      fireEvent.click(toggleButton)

      const runningButton = screen.getByText('Running')
      fireEvent.click(runningButton)

      expect(mockOnFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({
          state: expect.arrayContaining(['running'])
        })
      )
    })

    it('should remove state from filter when clicked again', () => {
      render(<ExperimentFilter onFilterChange={mockOnFilterChange} />)

      const toggleButton = screen.getByLabelText(/Toggle filters/i)
      fireEvent.click(toggleButton)

      const draftButton = screen.getByText('Draft')
      fireEvent.click(draftButton)

      expect(mockOnFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({
          state: ['ready']
        })
      )
    })

    it('should allow multiple state selections', () => {
      render(<ExperimentFilter onFilterChange={mockOnFilterChange} />)

      const toggleButton = screen.getByLabelText(/Toggle filters/i)
      fireEvent.click(toggleButton)

      const runningButton = screen.getByText('Running')
      const stoppedButton = screen.getByText('Stopped')

      fireEvent.click(runningButton)
      fireEvent.click(stoppedButton)

      expect(mockOnFilterChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          state: expect.arrayContaining(['running', 'stopped'])
        })
      )
    })
  })

  describe('Significance Filter', () => {
    it('should render significance options', () => {
      render(<ExperimentFilter onFilterChange={mockOnFilterChange} />)

      const toggleButton = screen.getByLabelText(/Toggle filters/i)
      fireEvent.click(toggleButton)

      expect(screen.getByText('Positive')).toBeInTheDocument()
      expect(screen.getByText('Negative')).toBeInTheDocument()
      expect(screen.getByText('Neutral')).toBeInTheDocument()
      expect(screen.getByText('Inconclusive')).toBeInTheDocument()
    })

    it('should toggle significance filter', () => {
      render(<ExperimentFilter onFilterChange={mockOnFilterChange} />)

      const toggleButton = screen.getByLabelText(/Toggle filters/i)
      fireEvent.click(toggleButton)

      const positiveButton = screen.getByText('Positive')
      fireEvent.click(positiveButton)

      expect(mockOnFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({
          significance: ['positive']
        })
      )
    })
  })

  describe('Owner Filter', () => {
    it('should render owner select when users provided', () => {
      render(
        <ExperimentFilter
          onFilterChange={mockOnFilterChange}
          users={mockUsers}
        />
      )

      const toggleButton = screen.getByLabelText(/Toggle filters/i)
      fireEvent.click(toggleButton)

      expect(screen.getByText('Owners')).toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })

    it('should not render owner filter when no users provided', () => {
      render(<ExperimentFilter onFilterChange={mockOnFilterChange} />)

      const toggleButton = screen.getByLabelText(/Toggle filters/i)
      fireEvent.click(toggleButton)

      expect(screen.queryByText('Owners')).not.toBeInTheDocument()
    })
  })

  describe('Tag Filter', () => {
    it('should render tag buttons when tags provided', () => {
      render(
        <ExperimentFilter
          onFilterChange={mockOnFilterChange}
          tags={mockTags}
        />
      )

      const toggleButton = screen.getByLabelText(/Toggle filters/i)
      fireEvent.click(toggleButton)

      expect(screen.getByText('Tags')).toBeInTheDocument()
      expect(screen.getByText('feature')).toBeInTheDocument()
      expect(screen.getByText('bugfix')).toBeInTheDocument()
    })

    it('should toggle tag filter', () => {
      render(
        <ExperimentFilter
          onFilterChange={mockOnFilterChange}
          tags={mockTags}
        />
      )

      const toggleButton = screen.getByLabelText(/Toggle filters/i)
      fireEvent.click(toggleButton)

      const featureButton = screen.getByText('feature')
      fireEvent.click(featureButton)

      expect(mockOnFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: [1]
        })
      )
    })
  })

  describe('Application Filter', () => {
    it('should render application buttons when applications provided', () => {
      render(
        <ExperimentFilter
          onFilterChange={mockOnFilterChange}
          applications={mockApplications}
        />
      )

      const toggleButton = screen.getByLabelText(/Toggle filters/i)
      fireEvent.click(toggleButton)

      expect(screen.getByText('Applications')).toBeInTheDocument()
      expect(screen.getByText('web-app')).toBeInTheDocument()
      expect(screen.getByText('mobile-app')).toBeInTheDocument()
    })

    it('should toggle application filter', () => {
      render(
        <ExperimentFilter
          onFilterChange={mockOnFilterChange}
          applications={mockApplications}
        />
      )

      const toggleButton = screen.getByLabelText(/Toggle filters/i)
      fireEvent.click(toggleButton)

      const webAppButton = screen.getByText('web-app')
      fireEvent.click(webAppButton)

      expect(mockOnFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({
          applications: [1]
        })
      )
    })
  })

  describe('Boolean Filters', () => {
    it('should render boolean filter checkboxes', () => {
      render(<ExperimentFilter onFilterChange={mockOnFilterChange} />)

      const toggleButton = screen.getByLabelText(/Toggle filters/i)
      fireEvent.click(toggleButton)

      expect(screen.getByText('Issues & Alerts')).toBeInTheDocument()
      expect(screen.getByText('SRM')).toBeInTheDocument()
      expect(screen.getByText('Cleanup Needed')).toBeInTheDocument()
      expect(screen.getByText('Audience Mismatch')).toBeInTheDocument()
      expect(screen.getByText('Sample Size Reached')).toBeInTheDocument()
    })

    it('should toggle boolean filter', () => {
      render(<ExperimentFilter onFilterChange={mockOnFilterChange} />)

      const toggleButton = screen.getByLabelText(/Toggle filters/i)
      fireEvent.click(toggleButton)

      const srmCheckbox = screen.getByLabelText(/SRM/i) as HTMLInputElement
      fireEvent.click(srmCheckbox)

      expect(mockOnFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({
          sample_ratio_mismatch: true
        })
      )
    })

    it('should remove boolean filter when unchecked', () => {
      const initialFilters = {
        state: ['running'],
        sample_ratio_mismatch: true
      }

      render(
        <ExperimentFilter
          onFilterChange={mockOnFilterChange}
          initialFilters={initialFilters}
        />
      )

      const toggleButton = screen.getByLabelText(/Toggle filters/i)
      fireEvent.click(toggleButton)

      const srmCheckbox = screen.getByLabelText(/SRM/i) as HTMLInputElement
      fireEvent.click(srmCheckbox)

      expect(mockOnFilterChange).toHaveBeenCalledWith({
        state: ['running']
      })
    })
  })

  describe('Clear Filters', () => {
    it('should show clear button when filters are active', () => {
      const initialFilters = {
        state: ['running'],
        search: 'test'
      }

      render(
        <ExperimentFilter
          onFilterChange={mockOnFilterChange}
          initialFilters={initialFilters}
        />
      )

      const toggleButton = screen.getByLabelText(/Toggle filters/i)
      fireEvent.click(toggleButton)

      expect(screen.getByText(/Clear All Filters/i)).toBeInTheDocument()
    })

    it('should not show clear button when only default filters active', () => {
      render(<ExperimentFilter onFilterChange={mockOnFilterChange} />)

      const toggleButton = screen.getByLabelText(/Toggle filters/i)
      fireEvent.click(toggleButton)

      expect(screen.queryByText(/Clear All Filters/i)).not.toBeInTheDocument()
    })

    it('should reset to default filters on clear', () => {
      const initialFilters = {
        state: ['running'],
        search: 'test',
        tags: [1]
      }

      render(
        <ExperimentFilter
          onFilterChange={mockOnFilterChange}
          initialFilters={initialFilters}
        />
      )

      const toggleButton = screen.getByLabelText(/Toggle filters/i)
      fireEvent.click(toggleButton)

      const clearButton = screen.getByText(/Clear All Filters/i)
      fireEvent.click(clearButton)

      expect(mockOnFilterChange).toHaveBeenCalledWith({
        state: ['created', 'ready']
      })
    })

    it('should clear filters from storage on clear', () => {
      const initialFilters = {
        state: ['running'],
        search: 'test'
      }

      render(
        <ExperimentFilter
          onFilterChange={mockOnFilterChange}
          initialFilters={initialFilters}
        />
      )

      const toggleButton = screen.getByLabelText(/Toggle filters/i)
      fireEvent.click(toggleButton)

      const clearButton = screen.getByText(/Clear All Filters/i)
      fireEvent.click(clearButton)

      expect(chrome.storage.local.remove).toHaveBeenCalledWith('experimentFilters')
    })
  })

  describe('Active Filter Count', () => {
    it('should show badge with active filter count', () => {
      const initialFilters = {
        state: ['running'],
        search: 'test'
      }

      render(
        <ExperimentFilter
          onFilterChange={mockOnFilterChange}
          initialFilters={initialFilters}
        />
      )

      const badge = screen.getByText('2')
      expect(badge).toBeInTheDocument()
    })

    it('should not count default state filters in badge', () => {
      const initialFilters = {
        state: ['created', 'ready']
      }

      render(
        <ExperimentFilter
          onFilterChange={mockOnFilterChange}
          initialFilters={initialFilters}
        />
      )

      expect(screen.queryByText('1')).not.toBeInTheDocument()
    })

    it('should update badge count when filters change', () => {
      render(<ExperimentFilter onFilterChange={mockOnFilterChange} />)

      const toggleButton = screen.getByLabelText(/Toggle filters/i)
      fireEvent.click(toggleButton)

      const runningButton = screen.getByText('Running')
      fireEvent.click(runningButton)

      expect(screen.getByText('1')).toBeInTheDocument()
    })
  })

  describe('Filter Persistence', () => {
    it('should load initial filters on mount', () => {
      const initialFilters = {
        state: ['running'],
        search: 'test'
      }

      render(
        <ExperimentFilter
          onFilterChange={mockOnFilterChange}
          initialFilters={initialFilters}
        />
      )

      const searchInput = screen.getByPlaceholderText(/Search experiments/i)
      expect((searchInput as HTMLInputElement).value).toBe('test')
    })
  })
})
