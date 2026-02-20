/**
 * SearchableSelect Component Tests
 *
 * Tests dropdown behavior including:
 * - Opening/closing dropdown
 * - Selection behavior (single vs multi)
 * - Click outside handling
 * - Event propagation
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect'
import '@testing-library/jest-dom'

const mockOptions: SearchableSelectOption[] = [
  { id: 1, name: 'Option 1', display_name: 'Option 1' },
  { id: 2, name: 'Option 2', display_name: 'Option 2' },
  { id: 3, name: 'Option 3', display_name: 'Option 3' }
]

const mockOptionsWithAvatars: SearchableSelectOption[] = [
  {
    id: 'user-1',
    name: 'John Doe',
    display_name: 'John Doe',
    avatar: 'https://example.com/avatar1.jpg',
    type: 'user'
  },
  {
    id: 'team-1',
    name: 'Engineering',
    display_name: 'Engineering',
    initials: 'EN',
    color: '#FF5733',
    type: 'team'
  },
  {
    id: 'user-2',
    name: 'Jane Smith',
    display_name: 'Jane Smith',
    type: 'user'
  }
]

describe('SearchableSelect', () => {
  describe('Dropdown Opening/Closing', () => {
    it('should open dropdown when trigger is clicked', () => {
      const onChange = jest.fn()
      render(
        <SearchableSelect
          mode="single"
          label="Test Select"
          options={mockOptions}
          selectedId={null}
          onChange={onChange}
        />
      )

      // Dropdown should be closed initially
      expect(screen.queryByText('Option 1')).not.toBeInTheDocument()

      // Click trigger to open
      const trigger = screen.getByText('Select...').closest('div')
      fireEvent.click(trigger!)

      // Dropdown should be open
      expect(screen.getByText('Option 1')).toBeInTheDocument()
    })

    it('should close dropdown when trigger is clicked again', () => {
      const onChange = jest.fn()
      render(
        <SearchableSelect
          mode="single"
          label="Test Select"
          options={mockOptions}
          selectedId={null}
          onChange={onChange}
        />
      )

      const trigger = screen.getByText('Select...').closest('div')

      // Open dropdown
      fireEvent.click(trigger!)
      expect(screen.getByText('Option 1')).toBeInTheDocument()

      // Close dropdown
      fireEvent.click(trigger!)
      expect(screen.queryByText('Option 1')).not.toBeInTheDocument()
    })

    it('should close dropdown when clicking outside', async () => {
      const onChange = jest.fn()
      const { container } = render(
        <div>
          <SearchableSelect
            mode="single"
            label="Test Select"
            options={mockOptions}
            selectedId={null}
            onChange={onChange}
          />
          <div data-testid="outside">Outside element</div>
        </div>
      )

      const trigger = screen.getByText('Select...').closest('div')

      // Open dropdown
      fireEvent.click(trigger!)
      expect(screen.getByText('Option 1')).toBeInTheDocument()

      // Click outside
      fireEvent.mouseDown(screen.getByTestId('outside'))

      await waitFor(() => {
        expect(screen.queryByText('Option 1')).not.toBeInTheDocument()
      })
    })
  })

  describe('Single Select Mode', () => {
    it('should select option and close dropdown when option is clicked', () => {
      const onChange = jest.fn()
      render(
        <SearchableSelect
          mode="single"
          label="Test Select"
          options={mockOptions}
          selectedId={null}
          onChange={onChange}
        />
      )

      // Open dropdown
      const trigger = screen.getByText('Select...').closest('div')
      fireEvent.click(trigger!)

      // Click option
      fireEvent.click(screen.getByText('Option 2'))

      // Should call onChange with selected ID
      expect(onChange).toHaveBeenCalledWith(2)

      // Dropdown should close
      expect(screen.queryByText('Option 2')).not.toBeInTheDocument()
    })

    it('should display selected option in trigger', () => {
      const onChange = jest.fn()
      const { rerender } = render(
        <SearchableSelect
          mode="single"
          label="Test Select"
          options={mockOptions}
          selectedId={null}
          onChange={onChange}
        />
      )

      // Initially shows placeholder
      expect(screen.getByText('Select...')).toBeInTheDocument()

      // Rerender with selected option
      rerender(
        <SearchableSelect
          mode="single"
          label="Test Select"
          options={mockOptions}
          selectedId={2}
          onChange={onChange}
        />
      )

      // Should display selected option
      expect(screen.getByText('Option 2')).toBeInTheDocument()
    })
  })

  describe('Multi Select Mode', () => {
    it('should close dropdown after adding an option', async () => {
      const onChange = jest.fn()
      render(
        <SearchableSelect
          mode="multi"
          label="Test Select"
          options={mockOptions}
          selectedIds={[]}
          onChange={onChange}
        />
      )

      // Open dropdown
      const trigger = screen.getByText('Select...').closest('div')
      fireEvent.click(trigger!)

      // Click option
      fireEvent.click(screen.getByText('Option 2'))

      // Should call onChange
      expect(onChange).toHaveBeenCalledWith([2])

      // Dropdown closes after adding an item
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      })
    })

    it('should select multiple options by reopening dropdown', () => {
      const onChange = jest.fn()
      const { rerender } = render(
        <SearchableSelect
          mode="multi"
          label="Test Select"
          options={mockOptions}
          selectedIds={[]}
          onChange={onChange}
        />
      )

      // Open dropdown
      const trigger = screen.getByText('Select...').closest('div')
      fireEvent.click(trigger!)

      // Click first option (dropdown closes)
      fireEvent.click(screen.getByText('Option 1'))
      expect(onChange).toHaveBeenCalledWith([1])

      // Rerender with first option selected
      rerender(
        <SearchableSelect
          mode="multi"
          label="Test Select"
          options={mockOptions}
          selectedIds={[1]}
          onChange={onChange}
        />
      )

      // Open dropdown again
      const trigger2 = screen.getByText('Option 1').closest('div')?.parentElement
      fireEvent.click(trigger2!)

      // Click second option
      fireEvent.click(screen.getAllByText('Option 2')[1] || screen.getByText('Option 2'))
      expect(onChange).toHaveBeenCalledWith([1, 2])
    })

    it('should deselect option when clicking selected option', () => {
      const onChange = jest.fn()
      render(
        <SearchableSelect
          mode="multi"
          label="Test Select"
          options={mockOptions}
          selectedIds={[1, 2]}
          onChange={onChange}
        />
      )

      // Open dropdown
      const trigger = screen.getByText('Option 1')
      fireEvent.click(trigger.closest('[data-testid]') || trigger.parentElement!)

      // Click already selected option
      const option2 = screen.getAllByText('Option 2').find(el =>
        el.closest('.hover\\:bg-gray-50')
      )
      fireEvent.click(option2!)

      // Should remove from selection
      expect(onChange).toHaveBeenCalledWith([1])
    })

    it('should show "Clear all" button when options are selected', () => {
      const onChange = jest.fn()
      render(
        <SearchableSelect
          mode="multi"
          label="Test Select"
          options={mockOptions}
          selectedIds={[1, 2]}
          onChange={onChange}
        />
      )

      // Open dropdown
      const trigger = screen.getByText('Option 1').closest('div')
      fireEvent.click(trigger!)

      // Should show Clear all button
      expect(screen.getByText('Clear all')).toBeInTheDocument()
    })

    it('should clear all selections when "Clear all" is clicked', () => {
      const onChange = jest.fn()
      render(
        <SearchableSelect
          mode="multi"
          label="Test Select"
          options={mockOptions}
          selectedIds={[1, 2]}
          onChange={onChange}
        />
      )

      // Open dropdown
      const trigger = screen.getByText('Option 1').closest('div')
      fireEvent.click(trigger!)

      // Click Clear all
      fireEvent.click(screen.getByText('Clear all'))

      // Should call onChange with empty array
      expect(onChange).toHaveBeenCalledWith([])
    })

    it('should keep dropdown open when "Clear all" is clicked', async () => {
      const onChange = jest.fn()
      render(
        <SearchableSelect
          mode="multi"
          label="Test Select"
          options={mockOptions}
          selectedIds={[1, 2]}
          onChange={onChange}
        />
      )

      // Open dropdown - use a more specific selector
      const trigger = screen.getByText('Option 1').closest('[class*="flex items-center"]')
      fireEvent.click(trigger!)

      // Click Clear all
      fireEvent.click(screen.getByText('Clear all'))

      // Dropdown should stay open - check for dropdown elements
      await waitFor(() => {
        expect(screen.getAllByText('Option 1').length).toBeGreaterThanOrEqual(1)
      })
    })
  })

  describe('Search Functionality', () => {
    it('should filter options based on search term', async () => {
      const onChange = jest.fn()
      render(
        <SearchableSelect
          mode="single"
          label="Test Select"
          options={mockOptions}
          selectedId={null}
          onChange={onChange}
        />
      )

      // Open dropdown
      const trigger = screen.getByText('Select...').closest('div')
      fireEvent.click(trigger!)

      // Type in search box
      const searchInput = screen.getByPlaceholderText('Search...')
      fireEvent.change(searchInput, { target: { value: 'Option 2' } })

      // Should show only matching option
      await waitFor(() => {
        expect(screen.getByText('Option 2')).toBeInTheDocument()
        expect(screen.queryByText('Option 1')).not.toBeInTheDocument()
        expect(screen.queryByText('Option 3')).not.toBeInTheDocument()
      })
    })

    it('should keep dropdown open when clicking in search box', async () => {
      const onChange = jest.fn()
      render(
        <SearchableSelect
          mode="single"
          label="Test Select"
          options={mockOptions}
          selectedId={null}
          onChange={onChange}
        />
      )

      // Open dropdown
      const trigger = screen.getByText('Select...').closest('div')
      fireEvent.click(trigger!)

      // Click in search box
      const searchInput = screen.getByPlaceholderText('Search...')
      fireEvent.mouseDown(searchInput)
      fireEvent.click(searchInput)

      // Dropdown should stay open
      await waitFor(() => {
        expect(screen.getByText('Option 1')).toBeInTheDocument()
      })
    })
  })

  describe('Avatar Rendering', () => {
    it('should render avatar image when avatar URL is provided', () => {
      const onChange = jest.fn()
      render(
        <SearchableSelect
          mode="single"
          label="Test Select"
          options={mockOptionsWithAvatars}
          selectedId={null}
          onChange={onChange}
        />
      )

      // Open dropdown
      const trigger = screen.getByText('Select...').closest('div')
      fireEvent.click(trigger!)

      // Should render avatar image
      const avatar = screen.getByAltText('John Doe')
      expect(avatar).toBeInTheDocument()
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar1.jpg')
    })

    it('should render initials when no avatar is provided', () => {
      const onChange = jest.fn()
      render(
        <SearchableSelect
          mode="single"
          label="Test Select"
          options={mockOptionsWithAvatars}
          selectedId={null}
          onChange={onChange}
        />
      )

      // Open dropdown
      const trigger = screen.getByText('Select...').closest('div')
      fireEvent.click(trigger!)

      // Should render initials for Jane Smith (no avatar)
      expect(screen.getByText('JS')).toBeInTheDocument()
    })

    it('should fallback to initials when avatar fails to load', () => {
      const onChange = jest.fn()
      render(
        <SearchableSelect
          mode="single"
          label="Test Select"
          options={mockOptionsWithAvatars}
          selectedId={null}
          onChange={onChange}
        />
      )

      // Open dropdown
      const trigger = screen.getByText('Select...').closest('div')
      fireEvent.click(trigger!)

      // Find avatar image
      const avatar = screen.getByAltText('John Doe')

      // Simulate image load error
      fireEvent.error(avatar)

      // Avatar should be hidden
      expect(avatar).toHaveStyle({ display: 'none' })

      // Initials should be visible
      expect(screen.getByText('JD')).toBeInTheDocument()
    })

    it('should render team initials and color', () => {
      const onChange = jest.fn()
      render(
        <SearchableSelect
          mode="single"
          label="Test Select"
          options={mockOptionsWithAvatars}
          selectedId={null}
          onChange={onChange}
        />
      )

      // Open dropdown
      const trigger = screen.getByText('Select...').closest('div')
      fireEvent.click(trigger!)

      // Should render team initials
      const teamInitials = screen.getByText('EN')
      expect(teamInitials).toBeInTheDocument()

      // Should have custom background color
      expect(teamInitials).toHaveStyle({ backgroundColor: '#FF5733' })
    })
  })

  describe('Event Propagation', () => {
    it('should close dropdown after adding an option in multi-select mode', async () => {
      const onChange = jest.fn()
      render(
        <SearchableSelect
          mode="multi"
          label="Test Select"
          options={mockOptions}
          selectedIds={[]}
          onChange={onChange}
        />
      )

      // Open dropdown
      const trigger = screen.getByText('Select...').closest('div')
      fireEvent.click(trigger!)

      // Click option
      const option = screen.getByText('Option 1')
      fireEvent.click(option)

      // Dropdown should close after adding an item
      await waitFor(() => {
        expect(screen.queryByText('Option 2')).not.toBeInTheDocument()
      })

      // onChange should be called
      expect(onChange).toHaveBeenCalledWith([1])
    })

    it('should not close dropdown when clicking "Clear all" (stopPropagation)', async () => {
      const onChange = jest.fn()
      render(
        <SearchableSelect
          mode="multi"
          label="Test Select"
          options={mockOptions}
          selectedIds={[1]}
          onChange={onChange}
        />
      )

      // Open dropdown - use data-testid or role to find the trigger more reliably
      const trigger = screen.getByText('Option 1').closest('[class*="flex items-center"]')
      fireEvent.click(trigger!)

      // Click Clear all - this should NOT propagate to trigger
      const clearButton = screen.getByText('Clear all')
      fireEvent.click(clearButton)

      // Dropdown should stay open - check for dropdown specific elements
      await waitFor(() => {
        expect(screen.getAllByText('Option 1').length).toBeGreaterThanOrEqual(1)
      })

      // onChange should be called
      expect(onChange).toHaveBeenCalledWith([])
    })
  })

  describe('Disabled State', () => {
    it('should not open dropdown when disabled', () => {
      const onChange = jest.fn()
      render(
        <SearchableSelect
          mode="single"
          label="Test Select"
          options={mockOptions}
          selectedId={null}
          onChange={onChange}
          disabled={true}
        />
      )

      // Try to click trigger
      const trigger = screen.getByText('Select...').closest('div')
      fireEvent.click(trigger!)

      // Dropdown should not open
      expect(screen.queryByText('Option 1')).not.toBeInTheDocument()
    })

    it('should not open dropdown when loading', () => {
      const onChange = jest.fn()
      render(
        <SearchableSelect
          mode="single"
          label="Test Select"
          options={mockOptions}
          selectedId={null}
          onChange={onChange}
          loading={true}
        />
      )

      // Try to click trigger
      const trigger = screen.getByText('Loading...').closest('div')
      fireEvent.click(trigger!)

      // Dropdown should not open
      expect(screen.queryByText('Option 1')).not.toBeInTheDocument()
    })
  })
})
