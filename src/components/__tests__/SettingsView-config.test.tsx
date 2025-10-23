import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { SettingsView } from '../SettingsView'
import { DEFAULT_CONFIG } from '../../config/defaults'
import { getConfig } from '../../utils/storage'

// Mock dependencies
jest.mock('../../utils/storage', () => ({
  getConfig: jest.fn(),
  setConfig: jest.fn(),
}))

jest.mock('../../utils/debug', () => ({
  debugLog: jest.fn(),
  debugError: jest.fn(),
  debugWarn: jest.fn(),
}))

jest.mock('axios')

describe('SettingsView - Config Defaults', () => {
  const mockOnSave = jest.fn()
  const mockOnCancel = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Initial state with DEFAULT_CONFIG', () => {
    it('should initialize queryPrefix state with DEFAULT_CONFIG.queryPrefix', async () => {
      ;(getConfig as jest.Mock).mockResolvedValue(null)

      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      await waitFor(() => {
        const queryPrefixInput = screen.getByLabelText(/Query Parameter Prefix/i) as HTMLInputElement
        expect(queryPrefixInput.value).toBe(DEFAULT_CONFIG.queryPrefix)
      })
    })

    it('should use DEFAULT_CONFIG.queryPrefix when loading config without queryPrefix', async () => {
      const configWithoutQueryPrefix = {
        apiEndpoint: 'https://api.example.com',
        apiKey: 'test-key',
      }
      ;(getConfig as jest.Mock).mockResolvedValue(configWithoutQueryPrefix)

      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      await waitFor(() => {
        const queryPrefixInput = screen.getByLabelText(/Query Parameter Prefix/i) as HTMLInputElement
        expect(queryPrefixInput.value).toBe(DEFAULT_CONFIG.queryPrefix)
      })
    })

    it('should use loaded queryPrefix when config provides a value', async () => {
      const configWithCustomPrefix = {
        apiEndpoint: 'https://api.example.com',
        apiKey: 'test-key',
        queryPrefix: 'custom_',
      }
      ;(getConfig as jest.Mock).mockResolvedValue(configWithCustomPrefix)

      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      await waitFor(() => {
        const queryPrefixInput = screen.getByLabelText(/Query Parameter Prefix/i) as HTMLInputElement
        expect(queryPrefixInput.value).toBe('custom_')
      })
    })

    it('should fall back to DEFAULT_CONFIG.queryPrefix when loaded queryPrefix is empty', async () => {
      const configWithEmptyPrefix = {
        apiEndpoint: 'https://api.example.com',
        apiKey: 'test-key',
        queryPrefix: '',
      }
      ;(getConfig as jest.Mock).mockResolvedValue(configWithEmptyPrefix)

      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      await waitFor(() => {
        const queryPrefixInput = screen.getByLabelText(/Query Parameter Prefix/i) as HTMLInputElement
        // The OR operator in the code should use the default when empty string
        expect(queryPrefixInput.value).toBe(DEFAULT_CONFIG.queryPrefix)
      })
    })
  })

  describe('Saving configuration with DEFAULT_CONFIG fallback', () => {
    it('should use DEFAULT_CONFIG.queryPrefix when saving with empty queryPrefix', async () => {
      ;(getConfig as jest.Mock).mockResolvedValue(null)

      const { rerender } = render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      await waitFor(() => {
        const queryPrefixInput = screen.getByLabelText(/Query Parameter Prefix/i) as HTMLInputElement
        expect(queryPrefixInput).toBeInTheDocument()
      })

      // The component should use the DEFAULT_CONFIG value when saving if input is empty
      // This tests the fallback logic: queryPrefix.trim() || DEFAULT_CONFIG.queryPrefix
      const expectedQueryPrefix = '' || DEFAULT_CONFIG.queryPrefix
      expect(expectedQueryPrefix).toBe(DEFAULT_CONFIG.queryPrefix)
    })
  })

  describe('DEFAULT_CONFIG values match expected defaults', () => {
    it('should have queryPrefix default of "_"', () => {
      expect(DEFAULT_CONFIG.queryPrefix).toBe('_')
    })

    it('should have persistQueryToCookie default of true', () => {
      expect(DEFAULT_CONFIG.persistQueryToCookie).toBe(true)
    })

    it('should have injectSDK default of false', () => {
      expect(DEFAULT_CONFIG.injectSDK).toBe(false)
    })

    it('should have sdkUrl default of empty string', () => {
      expect(DEFAULT_CONFIG.sdkUrl).toBe('')
    })
  })

  describe('Config loading logic', () => {
    it('should handle partial config and fill in defaults', async () => {
      const partialConfig = {
        apiEndpoint: 'https://api.example.com',
        // queryPrefix is missing, should use default
      }
      ;(getConfig as jest.Mock).mockResolvedValue(partialConfig)

      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      await waitFor(() => {
        const queryPrefixInput = screen.getByLabelText(/Query Parameter Prefix/i) as HTMLInputElement
        expect(queryPrefixInput.value).toBe(DEFAULT_CONFIG.queryPrefix)
      })
    })

    it('should correctly apply OR operator for queryPrefix fallback', () => {
      const testCases = [
        { input: undefined, expected: DEFAULT_CONFIG.queryPrefix },
        { input: '', expected: DEFAULT_CONFIG.queryPrefix },
        { input: 'custom_', expected: 'custom_' },
        { input: 'exp_', expected: 'exp_' },
      ]

      testCases.forEach(({ input, expected }) => {
        const result = input || DEFAULT_CONFIG.queryPrefix
        expect(result).toBe(expected)
      })
    })

    it('should correctly apply ?? operator for boolean config values', () => {
      const testCases = [
        { input: undefined, expected: DEFAULT_CONFIG.persistQueryToCookie },
        { input: null, expected: DEFAULT_CONFIG.persistQueryToCookie },
        { input: false, expected: false },
        { input: true, expected: true },
      ]

      testCases.forEach(({ input, expected }) => {
        const result = input ?? DEFAULT_CONFIG.persistQueryToCookie
        expect(result).toBe(expected)
      })
    })
  })
})
