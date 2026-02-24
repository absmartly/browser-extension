import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryStringOverridesSection } from '../QueryStringOverridesSection'
import { DEFAULT_CONFIG } from '../../../config/defaults'

describe('QueryStringOverridesSection', () => {
  const mockOnQueryPrefixChange = jest.fn()
  const mockOnPersistQueryToCookieChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering with DEFAULT_CONFIG', () => {
    it('should render with DEFAULT_CONFIG.queryPrefix as placeholder', () => {
      render(
        <QueryStringOverridesSection
          queryPrefix=""
          persistQueryToCookie={true}
          onQueryPrefixChange={mockOnQueryPrefixChange}
          onPersistQueryToCookieChange={mockOnPersistQueryToCookieChange}
        />
      )

      const input = screen.getByLabelText(/Query Parameter Prefix/i) as HTMLInputElement
      expect(input.placeholder).toBe(DEFAULT_CONFIG.queryPrefix)
    })

    it('should display example text with DEFAULT_CONFIG.queryPrefix', () => {
      render(
        <QueryStringOverridesSection
          queryPrefix=""
          persistQueryToCookie={true}
          onQueryPrefixChange={mockOnQueryPrefixChange}
          onPersistQueryToCookieChange={mockOnPersistQueryToCookieChange}
        />
      )

      const exampleText = screen.getByText(/Prefix for query parameters/i)
      expect(exampleText.textContent).toContain(`?${DEFAULT_CONFIG.queryPrefix}button_color=1`)
    })

    it('should render with correct default queryPrefix value "_"', () => {
      render(
        <QueryStringOverridesSection
          queryPrefix={DEFAULT_CONFIG.queryPrefix}
          persistQueryToCookie={true}
          onQueryPrefixChange={mockOnQueryPrefixChange}
          onPersistQueryToCookieChange={mockOnPersistQueryToCookieChange}
        />
      )

      const input = screen.getByLabelText(/Query Parameter Prefix/i) as HTMLInputElement
      expect(input.value).toBe('_')
    })
  })

  describe('Input interactions', () => {
    it('should call onQueryPrefixChange when input value changes', () => {
      render(
        <QueryStringOverridesSection
          queryPrefix={DEFAULT_CONFIG.queryPrefix}
          persistQueryToCookie={true}
          onQueryPrefixChange={mockOnQueryPrefixChange}
          onPersistQueryToCookieChange={mockOnPersistQueryToCookieChange}
        />
      )

      const input = screen.getByLabelText(/Query Parameter Prefix/i)
      fireEvent.change(input, { target: { value: 'custom_' } })

      expect(mockOnQueryPrefixChange).toHaveBeenCalledWith('custom_')
      expect(mockOnQueryPrefixChange).toHaveBeenCalledTimes(1)
    })

    it('should call onPersistQueryToCookieChange when checkbox is toggled', () => {
      render(
        <QueryStringOverridesSection
          queryPrefix={DEFAULT_CONFIG.queryPrefix}
          persistQueryToCookie={true}
          onQueryPrefixChange={mockOnQueryPrefixChange}
          onPersistQueryToCookieChange={mockOnPersistQueryToCookieChange}
        />
      )

      const checkbox = screen.getByRole('checkbox', { name: /Persist query string overrides to cookie/i })
      fireEvent.click(checkbox)

      expect(mockOnPersistQueryToCookieChange).toHaveBeenCalledWith(false)
      expect(mockOnPersistQueryToCookieChange).toHaveBeenCalledTimes(1)
    })
  })

  describe('Props display', () => {
    it('should display custom queryPrefix value when provided', () => {
      const customPrefix = 'exp_'
      render(
        <QueryStringOverridesSection
          queryPrefix={customPrefix}
          persistQueryToCookie={true}
          onQueryPrefixChange={mockOnQueryPrefixChange}
          onPersistQueryToCookieChange={mockOnPersistQueryToCookieChange}
        />
      )

      const input = screen.getByLabelText(/Query Parameter Prefix/i) as HTMLInputElement
      expect(input.value).toBe('exp_')
    })

    it('should show checkbox checked when persistQueryToCookie is true', () => {
      render(
        <QueryStringOverridesSection
          queryPrefix={DEFAULT_CONFIG.queryPrefix}
          persistQueryToCookie={true}
          onQueryPrefixChange={mockOnQueryPrefixChange}
          onPersistQueryToCookieChange={mockOnPersistQueryToCookieChange}
        />
      )

      const checkbox = screen.getByRole('checkbox', { name: /Persist query string overrides to cookie/i })
      expect(checkbox.getAttribute('aria-checked')).toBe('true')
    })

    it('should show checkbox unchecked when persistQueryToCookie is false', () => {
      render(
        <QueryStringOverridesSection
          queryPrefix={DEFAULT_CONFIG.queryPrefix}
          persistQueryToCookie={false}
          onQueryPrefixChange={mockOnQueryPrefixChange}
          onPersistQueryToCookieChange={mockOnPersistQueryToCookieChange}
        />
      )

      const checkbox = screen.getByRole('checkbox', { name: /Persist query string overrides to cookie/i })
      expect(checkbox.getAttribute('aria-checked')).toBe('false')
    })
  })

  describe('Component structure', () => {
    it('should render section heading', () => {
      render(
        <QueryStringOverridesSection
          queryPrefix={DEFAULT_CONFIG.queryPrefix}
          persistQueryToCookie={true}
          onQueryPrefixChange={mockOnQueryPrefixChange}
          onPersistQueryToCookieChange={mockOnPersistQueryToCookieChange}
        />
      )

      expect(screen.getByText('Query String Overrides')).toBeInTheDocument()
    })

    it('should render input label', () => {
      render(
        <QueryStringOverridesSection
          queryPrefix={DEFAULT_CONFIG.queryPrefix}
          persistQueryToCookie={true}
          onQueryPrefixChange={mockOnQueryPrefixChange}
          onPersistQueryToCookieChange={mockOnPersistQueryToCookieChange}
        />
      )

      expect(screen.getByLabelText(/Query Parameter Prefix/i)).toBeInTheDocument()
    })

    it('should render helper text for query prefix', () => {
      render(
        <QueryStringOverridesSection
          queryPrefix={DEFAULT_CONFIG.queryPrefix}
          persistQueryToCookie={true}
          onQueryPrefixChange={mockOnQueryPrefixChange}
          onPersistQueryToCookieChange={mockOnPersistQueryToCookieChange}
        />
      )

      expect(screen.getByText(/Prefix for query parameters/i)).toBeInTheDocument()
    })

    it('should render helper text for persist to cookie checkbox', () => {
      render(
        <QueryStringOverridesSection
          queryPrefix={DEFAULT_CONFIG.queryPrefix}
          persistQueryToCookie={true}
          onQueryPrefixChange={mockOnQueryPrefixChange}
          onPersistQueryToCookieChange={mockOnPersistQueryToCookieChange}
        />
      )

      expect(screen.getByText(/When enabled, query string overrides will be saved to a cookie/i)).toBeInTheDocument()
    })
  })

  describe('DEFAULT_CONFIG integration', () => {
    it('should correctly use DEFAULT_CONFIG placeholder value', () => {
      expect(DEFAULT_CONFIG.queryPrefix).toBe('_')
      
      render(
        <QueryStringOverridesSection
          queryPrefix=""
          persistQueryToCookie={true}
          onQueryPrefixChange={mockOnQueryPrefixChange}
          onPersistQueryToCookieChange={mockOnPersistQueryToCookieChange}
        />
      )

      const input = screen.getByLabelText(/Query Parameter Prefix/i) as HTMLInputElement
      expect(input.placeholder).toBe('_')
    })

    it('should display correct example with DEFAULT_CONFIG value', () => {
      expect(DEFAULT_CONFIG.queryPrefix).toBe('_')
      
      render(
        <QueryStringOverridesSection
          queryPrefix=""
          persistQueryToCookie={true}
          onQueryPrefixChange={mockOnQueryPrefixChange}
          onPersistQueryToCookieChange={mockOnPersistQueryToCookieChange}
        />
      )

      const exampleText = screen.getByText(/Prefix for query parameters/i)
      expect(exampleText.textContent).toBe('Prefix for query parameters (e.g., ?_button_color=1)')
    })
  })

  describe('Memoization', () => {
    it('should be wrapped with React.memo', () => {
      // React.memo components don't automatically get a displayName
      // Check if it's a memoized component by verifying it's not just a plain function
      expect(QueryStringOverridesSection).toBeDefined()
      // Memoized components have $$typeof property
      expect((QueryStringOverridesSection as any).$$typeof).toBeDefined()
    })
  })
})
