import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { SettingsView } from '../SettingsView'
import type { ABsmartlyConfig } from '~src/types/absmartly'
import * as storage from '~src/utils/storage'

jest.mock('~src/utils/storage', () => ({
  setConfig: jest.fn().mockResolvedValue(undefined),
  getConfig: jest.fn().mockResolvedValue({
    apiEndpoint: 'https://api.absmartly.com',
    apiKey: '',
    authMethod: 'jwt',
    applicationName: 'test-app',
    domChangesFieldName: '__dom_changes',
    sdkWindowProperty: 'absmartly',
    queryPrefix: 'absmartly_',
    persistQueryToCookie: false,
    aiProvider: 'anthropic-api',
    aiApiKey: '',
    llmModel: 'claude-sonnet-4-5-20250929',
    providerModels: {},
    providerEndpoints: {}
  })
}))

const mockUseSettingsFormReturn = {
  apiKey: '',
  setApiKey: jest.fn(),
  apiEndpoint: 'https://api.absmartly.com',
  setApiEndpoint: jest.fn(),
  applicationName: 'test-app',
  setApplicationName: jest.fn(),
  domChangesFieldName: '__dom_changes',
  setDomChangesFieldName: jest.fn(),
  authMethod: 'jwt' as const,
  setAuthMethod: jest.fn(),
  sdkWindowProperty: 'absmartly',
  setSdkWindowProperty: jest.fn(),
  queryPrefix: 'absmartly_',
  setQueryPrefix: jest.fn(),
  persistQueryToCookie: false,
  setPersistQueryToCookie: jest.fn(),
  aiProvider: 'anthropic-api' as const,
  setAiProvider: jest.fn(),
  aiApiKey: '',
  setAiApiKey: jest.fn(),
  llmModel: 'claude-sonnet-4-5-20250929',
  setLlmModel: jest.fn(),
  providerModels: {},
  setProviderModels: jest.fn(),
  customEndpoint: '',
  setCustomEndpoint: jest.fn(),
  providerEndpoints: {},
  setProviderEndpoints: jest.fn(),
  errors: {},
  setErrors: jest.fn(),
  loading: false,
  user: null,
  checkingAuth: false,
  avatarUrl: null,
  cookiePermissionGranted: true,
  showCookieConsentModal: false,
  setShowCookieConsentModal: jest.fn(),
  loadConfig: jest.fn(),
  checkAuthStatus: jest.fn(),
  normalizeEndpoint: jest.fn((endpoint: string) => endpoint),
  validateForm: jest.fn().mockResolvedValue(true),
  buildConfig: jest.fn().mockReturnValue({
    apiEndpoint: 'https://api.absmartly.com',
    apiKey: '',
    authMethod: 'jwt',
    applicationName: 'test-app'
  }),
  requestCookiePermission: jest.fn().mockResolvedValue(true)
}

jest.mock('~src/hooks/useSettingsForm', () => ({
  useSettingsForm: jest.fn(() => mockUseSettingsFormReturn)
}))

global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys, callback) => callback({})),
      set: jest.fn((items, callback) => callback?.())
    }
  },
  runtime: {
    sendMessage: jest.fn()
  },
  tabs: {
    create: jest.fn()
  }
} as any

describe('SettingsView', () => {
  const mockOnSave = jest.fn()
  const mockOnCancel = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
  })

  describe('Rendering', () => {
    it('should render settings form with all sections', () => {
      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      expect(screen.getByText('Settings')).toBeInTheDocument()
      expect(screen.getByLabelText(/ABsmartly Endpoint/i)).toBeInTheDocument()
      expect(screen.getByText(/Authentication Method/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Save Settings/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
    })

    it('should show loading state initially', () => {
      const { useSettingsForm } = require('~src/hooks/useSettingsForm')
      useSettingsForm.mockReturnValueOnce({
        ...mockUseSettingsFormReturn,
        loading: true
      })

      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      expect(screen.getByRole('status', { name: /Loading settings/i })).toBeInTheDocument()
    })

    it('should display error message when present', () => {
      const { useSettingsForm } = require('~src/hooks/useSettingsForm')
      useSettingsForm.mockReturnValueOnce({
        ...mockUseSettingsFormReturn,
        errors: { general: 'Failed to save settings' }
      })

      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      expect(screen.getByRole('alert')).toHaveTextContent('Failed to save settings')
    })
  })

  describe('API Endpoint', () => {
    it('should render endpoint input with correct value', () => {
      const { useSettingsForm } = require('~src/hooks/useSettingsForm')
      const mockSetApiEndpoint = jest.fn()
      useSettingsForm.mockReturnValueOnce({
        ...mockUseSettingsFormReturn,
        apiEndpoint: 'https://custom.api.com',
        setApiEndpoint: mockSetApiEndpoint
      })

      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      const input = screen.getByLabelText(/ABsmartly Endpoint/i) as HTMLInputElement
      expect(input.value).toBe('https://custom.api.com')
    })

    it('should show endpoint validation error', () => {
      const { useSettingsForm } = require('~src/hooks/useSettingsForm')
      useSettingsForm.mockReturnValueOnce({
        ...mockUseSettingsFormReturn,
        errors: { apiEndpoint: 'Invalid URL format' }
      })

      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      expect(screen.getByText('Invalid URL format')).toBeInTheDocument()
    })
  })

  describe('Authentication Method', () => {
    it('should render JWT and API Key radio buttons', () => {
      const { container } = render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      const jwtRadio = container.querySelector('#auth-method-jwt')
      const apiKeyRadio = container.querySelector('#auth-method-apikey')

      expect(jwtRadio).toBeInTheDocument()
      expect(apiKeyRadio).toBeInTheDocument()
    })

    it('should select JWT by default', () => {
      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      const jwtRadio = document.querySelector('#auth-method-jwt') as HTMLInputElement
      expect(jwtRadio.checked).toBe(true)
    })

    it('should switch to API Key method when selected', () => {
      const { useSettingsForm } = require('~src/hooks/useSettingsForm')
      const mockSetAuthMethod = jest.fn()
      useSettingsForm.mockReturnValueOnce({
        ...mockUseSettingsFormReturn,
        authMethod: 'jwt',
        setAuthMethod: mockSetAuthMethod
      })

      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      const apiKeyRadio = document.querySelector('#auth-method-apikey') as HTMLInputElement
      fireEvent.click(apiKeyRadio)

      expect(mockSetAuthMethod).toHaveBeenCalledWith('apikey')
    })

    it('should show correct helper text for JWT auth', () => {
      const { useSettingsForm } = require('~src/hooks/useSettingsForm')
      useSettingsForm.mockReturnValueOnce({
        ...mockUseSettingsFormReturn,
        authMethod: 'jwt'
      })

      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      expect(screen.getByText(/Uses JWT token from browser cookies/i)).toBeInTheDocument()
    })

    it('should show correct helper text for API Key auth', () => {
      const { useSettingsForm } = require('~src/hooks/useSettingsForm')
      useSettingsForm.mockReturnValueOnce({
        ...mockUseSettingsFormReturn,
        authMethod: 'apikey'
      })

      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      expect(screen.getByText(/Uses the API key configured below/i)).toBeInTheDocument()
    })
  })

  describe('API Key Input', () => {
    it('should render API Key input field', () => {
      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      const input = document.querySelector('#api-key-input') as HTMLInputElement
      expect(input).toBeInTheDocument()
      expect(input.type).toBe('password')
    })

    it('should show API Key as optional when JWT is selected', () => {
      const { useSettingsForm } = require('~src/hooks/useSettingsForm')
      useSettingsForm.mockReturnValueOnce({
        ...mockUseSettingsFormReturn,
        authMethod: 'jwt'
      })

      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      expect(screen.getByText(/API Key \(Optional\)/i)).toBeInTheDocument()
    })

    it('should show API Key as required when API Key auth is selected', () => {
      const { useSettingsForm } = require('~src/hooks/useSettingsForm')
      useSettingsForm.mockReturnValueOnce({
        ...mockUseSettingsFormReturn,
        authMethod: 'apikey'
      })

      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      expect(screen.getByText(/API Key \(Required\)/i)).toBeInTheDocument()
    })

    it('should show API Key validation error', () => {
      const { useSettingsForm } = require('~src/hooks/useSettingsForm')
      useSettingsForm.mockReturnValueOnce({
        ...mockUseSettingsFormReturn,
        errors: { apiKey: 'API Key is required' }
      })

      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      expect(screen.getByText('API Key is required')).toBeInTheDocument()
    })
  })

  describe('AI Provider', () => {
    it('should render AI provider section', () => {
      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      expect(screen.getByText(/AI Provider/i)).toBeInTheDocument()
    })
  })

  describe('Save Settings', () => {
    it('should save settings when form is valid', async () => {
      const { useSettingsForm } = require('~src/hooks/useSettingsForm')
      const mockValidateForm = jest.fn().mockResolvedValue(true)
      const mockBuildConfig = jest.fn().mockReturnValue({
        apiEndpoint: 'https://api.absmartly.com',
        apiKey: '',
        authMethod: 'jwt'
      })

      useSettingsForm.mockReturnValueOnce({
        ...mockUseSettingsFormReturn,
        validateForm: mockValidateForm,
        buildConfig: mockBuildConfig,
        apiEndpoint: 'https://api.absmartly.com'
      })

      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      const saveButton = document.querySelector('#save-settings-button') as HTMLElement
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockValidateForm).toHaveBeenCalled()
        expect(mockBuildConfig).toHaveBeenCalled()
        expect(storage.setConfig).toHaveBeenCalled()
        expect(mockOnSave).toHaveBeenCalled()
      })
    })

    it('should not save when form validation fails', async () => {
      const { useSettingsForm } = require('~src/hooks/useSettingsForm')
      const mockValidateForm = jest.fn().mockResolvedValue(false)

      useSettingsForm.mockReturnValueOnce({
        ...mockUseSettingsFormReturn,
        validateForm: mockValidateForm
      })

      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      const saveButton = document.querySelector('#save-settings-button') as HTMLElement
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockValidateForm).toHaveBeenCalled()
      })

      expect(storage.setConfig).not.toHaveBeenCalled()
      expect(mockOnSave).not.toHaveBeenCalled()
    })

    it('should store normalized endpoint in localStorage', async () => {
      const { useSettingsForm } = require('~src/hooks/useSettingsForm')
      const mockNormalizeEndpoint = jest.fn((endpoint) => `${endpoint}/v1`)

      useSettingsForm.mockReturnValueOnce({
        ...mockUseSettingsFormReturn,
        apiEndpoint: 'https://api.absmartly.com',
        normalizeEndpoint: mockNormalizeEndpoint
      })

      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      const saveButton = document.querySelector('#save-settings-button') as HTMLElement
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockNormalizeEndpoint).toHaveBeenCalledWith('https://api.absmartly.com')
        expect(localStorage.getItem('absmartly-endpoint')).toBe('https://api.absmartly.com/v1')
      })
    })

    it('should handle save error gracefully', async () => {
      const { useSettingsForm } = require('~src/hooks/useSettingsForm')
      const mockSetErrors = jest.fn()

      useSettingsForm.mockReturnValueOnce({
        ...mockUseSettingsFormReturn,
        setErrors: mockSetErrors
      })

      const setConfigMock = storage.setConfig as jest.Mock
      setConfigMock.mockRejectedValueOnce(new Error('Network error'))

      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      const saveButton = document.querySelector('#save-settings-button') as HTMLElement
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockSetErrors).toHaveBeenCalledWith({ general: 'Failed to save settings' })
      })
    })
  })

  describe('Cancel', () => {
    it('should call onCancel when cancel button is clicked', () => {
      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      const cancelButton = document.querySelector('#cancel-button') as HTMLElement
      fireEvent.click(cancelButton)

      expect(mockOnCancel).toHaveBeenCalled()
    })
  })

  describe('Test Connection', () => {
    it('should check auth status when refresh button is clicked', async () => {
      const { useSettingsForm } = require('~src/hooks/useSettingsForm')
      const mockCheckAuthStatus = jest.fn()

      useSettingsForm.mockReturnValue({
        ...mockUseSettingsFormReturn,
        checkAuthStatus: mockCheckAuthStatus,
        apiEndpoint: 'https://api.absmartly.com',
        apiKey: 'test-key',
        authMethod: 'apikey' as const
      })

      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      const refreshButton = screen.getByRole('button', { name: /Refresh/i })
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(mockCheckAuthStatus).toHaveBeenCalledWith(
          'https://api.absmartly.com',
          { apiKey: 'test-key', authMethod: 'apikey' }
        )
      })
    })
  })

  describe('Cookie Consent', () => {
    it('should show cookie consent modal when needed', () => {
      const { useSettingsForm } = require('~src/hooks/useSettingsForm')
      useSettingsForm.mockReturnValueOnce({
        ...mockUseSettingsFormReturn,
        showCookieConsentModal: true
      })

      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      expect(screen.getByText(/ABsmartly Access Required/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Grant Access/i })).toBeInTheDocument()
    })

    it('should request cookie permission on consent grant', async () => {
      const { useSettingsForm } = require('~src/hooks/useSettingsForm')
      const mockRequestCookiePermission = jest.fn().mockResolvedValue(true)
      const mockSetShowCookieConsentModal = jest.fn()
      const mockCheckAuthStatus = jest.fn()

      useSettingsForm.mockReturnValueOnce({
        ...mockUseSettingsFormReturn,
        showCookieConsentModal: true,
        requestCookiePermission: mockRequestCookiePermission,
        setShowCookieConsentModal: mockSetShowCookieConsentModal,
        checkAuthStatus: mockCheckAuthStatus,
        apiEndpoint: 'https://api.absmartly.com'
      })

      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      const grantButton = screen.getByRole('button', { name: /Grant/i })
      fireEvent.click(grantButton)

      await waitFor(() => {
        expect(mockRequestCookiePermission).toHaveBeenCalled()
        expect(mockSetShowCookieConsentModal).toHaveBeenCalledWith(false)
      })
    })

    it('should show error when cookie permission is denied', async () => {
      const { useSettingsForm } = require('~src/hooks/useSettingsForm')
      const mockRequestCookiePermission = jest.fn().mockResolvedValue(false)
      const mockSetErrors = jest.fn()

      useSettingsForm.mockReturnValueOnce({
        ...mockUseSettingsFormReturn,
        showCookieConsentModal: true,
        requestCookiePermission: mockRequestCookiePermission,
        setErrors: mockSetErrors
      })

      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      const grantButton = screen.getByRole('button', { name: /Grant/i })
      fireEvent.click(grantButton)

      await waitFor(() => {
        expect(mockSetErrors).toHaveBeenCalledWith(
          expect.objectContaining({
            general: expect.stringContaining('Cookie permission was denied')
          })
        )
      })
    })
  })

  describe('Authenticate', () => {
    it('should open ABsmartly login page in new tab', () => {
      const { useSettingsForm } = require('~src/hooks/useSettingsForm')
      useSettingsForm.mockReturnValueOnce({
        ...mockUseSettingsFormReturn,
        apiEndpoint: 'https://api.absmartly.com/v1'
      })

      render(<SettingsView onSave={mockOnSave} onCancel={mockOnCancel} />)

      const authenticateButtons = screen.getAllByRole('button', { name: /Authenticate/i })
      if (authenticateButtons.length > 0) {
        fireEvent.click(authenticateButtons[0])

        expect(chrome.tabs.create).toHaveBeenCalledWith({
          url: 'https://api.absmartly.com'
        })
      }
    })
  })
})
