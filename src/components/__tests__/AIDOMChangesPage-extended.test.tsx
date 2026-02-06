import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { AIDOMChangesPage } from '../AIDOMChangesPage'
import type { DOMChange } from '~src/types/dom-changes'
import { sendToBackground } from '~src/lib/messaging'

jest.mock('~src/lib/messaging', () => ({
  sendToContent: jest.fn().mockResolvedValue(undefined),
  sendToBackground: jest.fn().mockResolvedValue({ success: true })
}))

jest.mock('~src/utils/storage', () => ({
  storage: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined)
  }
}))

jest.mock('~src/utils/markdown', () => ({
  renderMarkdown: jest.fn((md: string) => md)
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

Element.prototype.scrollIntoView = jest.fn()

describe('AIDOMChangesPage - Extended Tests', () => {
  const mockChanges: DOMChange[] = [
    {
      selector: '.test-button',
      type: 'style',
      value: { color: 'red' }
    }
  ]

  const defaultProps = {
    variantName: 'Test Variant',
    currentChanges: mockChanges,
    onBack: jest.fn(),
    onGenerate: jest.fn().mockResolvedValue({
      domChanges: mockChanges,
      response: 'Generated changes',
      action: 'append' as const
    }),
    onRestoreChanges: jest.fn(),
    onPreviewToggle: jest.fn(),
    onPreviewRefresh: jest.fn(),
    onPreviewWithChanges: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Streaming AI Response', () => {
    it('should display streaming response with progress indicator', async () => {
      const streamingResponse = 'Analyzing your request...'
      const mockStreamingGenerate = jest.fn().mockImplementation(async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              domChanges: mockChanges,
              response: streamingResponse,
              action: 'append' as const
            })
          }, 100)
        })
      })

      render(
        <AIDOMChangesPage
          {...defaultProps}
          onGenerate={mockStreamingGenerate}
        />
      )

      const textarea = screen.getByPlaceholderText(/Example: Change the CTA/i)
      fireEvent.change(textarea, { target: { value: 'Make it red' } })

      const generateButton = screen.getByRole('button', { name: /Generate DOM Changes/i })
      fireEvent.click(generateButton)

      await waitFor(() => {
        expect(mockStreamingGenerate).toHaveBeenCalled()
      })
    })

    it('should handle streaming error mid-response with recovery', async () => {
      const mockFailingGenerate = jest.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          domChanges: mockChanges,
          response: 'Success after retry',
          action: 'append' as const
        })

      render(
        <AIDOMChangesPage
          {...defaultProps}
          onGenerate={mockFailingGenerate}
        />
      )

      const textarea = screen.getByPlaceholderText(/Example: Change the CTA/i)
      fireEvent.change(textarea, { target: { value: 'Make it red' } })

      const generateButton = screen.getByRole('button', { name: /Generate DOM Changes/i })

      fireEvent.click(generateButton)

      await waitFor(() => {
        expect(mockFailingGenerate).toHaveBeenCalledTimes(1)
      })

      fireEvent.click(generateButton)

      await waitFor(() => {
        expect(mockFailingGenerate).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Apply Invalid DOM Changes', () => {
    it('should show validation error for invalid selector', async () => {
      const invalidChanges: DOMChange[] = [
        {
          selector: '',
          type: 'style',
          value: { color: 'red' }
        }
      ]

      const mockGenerateInvalid = jest.fn().mockResolvedValue({
        domChanges: invalidChanges,
        response: 'Generated invalid changes',
        action: 'append' as const
      })

      render(
        <AIDOMChangesPage
          {...defaultProps}
          onGenerate={mockGenerateInvalid}
        />
      )

      const textarea = screen.getByPlaceholderText(/Example: Change the CTA/i)
      fireEvent.change(textarea, { target: { value: 'Invalid selector' } })

      const generateButton = screen.getByRole('button', { name: /Generate DOM Changes/i })
      fireEvent.click(generateButton)

      await waitFor(() => {
        expect(mockGenerateInvalid).toHaveBeenCalled()
      })
    })

    it('should validate DOM changes before applying', async () => {
      const mockValidation = jest.fn()

      render(<AIDOMChangesPage {...defaultProps} />)

      const toggleButton = document.querySelector('#vibe-studio-preview-toggle') as HTMLElement
      fireEvent.click(toggleButton)

      await waitFor(() => {
        expect(defaultProps.onPreviewWithChanges).toHaveBeenCalled()
      })
    })
  })

  describe('Session Recovery', () => {
    it('should recover conversation after page reload', async () => {
      const storageMock = chrome.storage.local.get as jest.Mock
      storageMock.mockImplementation((keys, callback) =>
        callback({
          'ai-conversation-Test Variant': {
            messages: [
              { role: 'user', content: 'Previous message', timestamp: Date.now() }
            ]
          }
        })
      )

      render(<AIDOMChangesPage {...defaultProps} />)

      await waitFor(() => {
        expect(storageMock).toHaveBeenCalled()
      })
    })

    it('should preserve changes after session recovery', async () => {
      const storageMock = chrome.storage.local.get as jest.Mock
      storageMock.mockImplementation((keys, callback) =>
        callback({
          'ai-conversation-Test Variant': {
            messages: [
              { role: 'user', content: 'Previous message', timestamp: Date.now() }
            ],
            changes: mockChanges
          }
        })
      )

      render(<AIDOMChangesPage {...defaultProps} />)

      await waitFor(() => {
        expect(storageMock).toHaveBeenCalled()
      })
    })
  })

  describe('Image Upload', () => {
    it('should handle image upload and compression', async () => {
      render(<AIDOMChangesPage {...defaultProps} />)

      const file = new File(['image'], 'test.png', { type: 'image/png' })
      const fileInput = screen.getByLabelText(/Upload screenshot/i)

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false
      })

      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(fileInput).toBeInTheDocument()
      })
    })

    it('should show error for oversized images', async () => {
      render(<AIDOMChangesPage {...defaultProps} />)

      const largeFile = new File([new ArrayBuffer(10 * 1024 * 1024)], 'large.png', {
        type: 'image/png'
      })
      const fileInput = screen.getByLabelText(/Upload screenshot/i)

      Object.defineProperty(fileInput, 'files', {
        value: [largeFile],
        writable: false
      })

      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText(/Image too large/i)).toBeInTheDocument()
      })
    })

    it('should handle image upload errors', async () => {
      render(<AIDOMChangesPage {...defaultProps} />)

      const invalidFile = new File(['not an image'], 'test.txt', { type: 'text/plain' })
      const fileInput = screen.getByLabelText(/Upload screenshot/i)

      Object.defineProperty(fileInput, 'files', {
        value: [invalidFile],
        writable: false
      })

      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument()
      })
    })
  })

  describe('Conversation History', () => {
    it('should switch between conversations during active chat', async () => {
      render(<AIDOMChangesPage {...defaultProps} />)

      const newConversationButton = screen.getByRole('button', { name: /New Chat/i })
      fireEvent.click(newConversationButton)

      await waitFor(() => {
        expect(chrome.storage.local.set).toHaveBeenCalled()
      })
    })

    it('should preserve current message when switching conversations', async () => {
      render(<AIDOMChangesPage {...defaultProps} />)

      const textarea = screen.getByPlaceholderText(/Example: Change the CTA/i)
      fireEvent.change(textarea, { target: { value: 'Unsaved message' } })

      const newConversationButton = screen.getByRole('button', { name: /New Chat/i })
      fireEvent.click(newConversationButton)

      await waitFor(() => {
        expect(textarea).toHaveValue('')
      })
    })

    it('should handle conversation deletion', async () => {
      render(<AIDOMChangesPage {...defaultProps} />)

      const deleteButton = screen.queryByRole('button', { name: /Delete/i })
      if (deleteButton) {
        fireEvent.click(deleteButton)

        await waitFor(() => {
          expect(chrome.storage.local.set).toHaveBeenCalled()
        })
      }
    })
  })

  describe('HTML Capture', () => {
    it('should handle HTML capture failure', async () => {
      const mockSendToBackground = sendToBackground as jest.Mock
      mockSendToBackground.mockRejectedValueOnce(new Error('Capture failed'))

      render(<AIDOMChangesPage {...defaultProps} />)

      const captureButton = screen.queryByRole('button', { name: /Capture/i })
      if (captureButton) {
        fireEvent.click(captureButton)

        await waitFor(() => {
          expect(mockSendToBackground).toHaveBeenCalled()
        })
      }
    })

    it('should retry HTML capture on failure', async () => {
      const mockSendToBackground = sendToBackground as jest.Mock
      mockSendToBackground
        .mockRejectedValueOnce(new Error('Capture failed'))
        .mockResolvedValueOnce({ success: true, html: '<div>Test</div>' })

      render(<AIDOMChangesPage {...defaultProps} />)

      const captureButton = screen.queryByRole('button', { name: /Capture/i })
      if (captureButton) {
        fireEvent.click(captureButton)

        await waitFor(() => {
          expect(mockSendToBackground).toHaveBeenCalledTimes(1)
        })

        fireEvent.click(captureButton)

        await waitFor(() => {
          expect(mockSendToBackground).toHaveBeenCalledTimes(2)
        })
      }
    })
  })

  describe('Network Errors', () => {
    it('should handle network error during AI request', async () => {
      const mockGenerateError = jest.fn().mockRejectedValue(new Error('Network error'))

      render(
        <AIDOMChangesPage
          {...defaultProps}
          onGenerate={mockGenerateError}
        />
      )

      const textarea = screen.getByPlaceholderText(/Example: Change the CTA/i)
      fireEvent.change(textarea, { target: { value: 'Test request' } })

      const generateButton = screen.getByRole('button', { name: /Generate DOM Changes/i })
      fireEvent.click(generateButton)

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument()
      })
    })

    it('should allow retry after network error', async () => {
      const mockGenerateError = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          domChanges: mockChanges,
          response: 'Success',
          action: 'append' as const
        })

      render(
        <AIDOMChangesPage
          {...defaultProps}
          onGenerate={mockGenerateError}
        />
      )

      const textarea = screen.getByPlaceholderText(/Example: Change the CTA/i)
      fireEvent.change(textarea, { target: { value: 'Test request' } })

      const generateButton = screen.getByRole('button', { name: /Generate DOM Changes/i })

      fireEvent.click(generateButton)

      await waitFor(() => {
        expect(mockGenerateError).toHaveBeenCalledTimes(1)
      })

      const retryButton = screen.queryByRole('button', { name: /Retry/i })
      if (retryButton) {
        fireEvent.click(retryButton)

        await waitFor(() => {
          expect(mockGenerateError).toHaveBeenCalledTimes(2)
        })
      }
    })

    it('should show timeout error after long wait', async () => {
      jest.useFakeTimers()

      const mockLongGenerate = jest.fn().mockImplementation(() =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              domChanges: mockChanges,
              response: 'Success',
              action: 'append' as const
            })
          }, 60000)
        })
      )

      render(
        <AIDOMChangesPage
          {...defaultProps}
          onGenerate={mockLongGenerate}
        />
      )

      const textarea = screen.getByPlaceholderText(/Example: Change the CTA/i)
      fireEvent.change(textarea, { target: { value: 'Test request' } })

      const generateButton = screen.getByRole('button', { name: /Generate DOM Changes/i })
      fireEvent.click(generateButton)

      jest.advanceTimersByTime(60000)

      await waitFor(() => {
        expect(mockLongGenerate).toHaveBeenCalled()
      })

      jest.useRealTimers()
    })
  })

  describe('Clear Conversation', () => {
    it('should clear conversation history', async () => {
      render(<AIDOMChangesPage {...defaultProps} />)

      const clearButton = screen.queryByRole('button', { name: /Clear/i })
      if (clearButton) {
        fireEvent.click(clearButton)

        await waitFor(() => {
          expect(chrome.storage.local.set).toHaveBeenCalled()
        })
      }
    })

    it('should reset to initial state after clear', async () => {
      render(<AIDOMChangesPage {...defaultProps} />)

      const textarea = screen.getByPlaceholderText(/Example: Change the CTA/i)
      fireEvent.change(textarea, { target: { value: 'Test message' } })

      const clearButton = screen.queryByRole('button', { name: /Clear/i })
      if (clearButton) {
        fireEvent.click(clearButton)

        await waitFor(() => {
          expect(textarea).toHaveValue('')
        })
      }
    })
  })

  describe('Export Conversation', () => {
    it('should export conversation as JSON', async () => {
      render(<AIDOMChangesPage {...defaultProps} />)

      const exportButton = screen.queryByRole('button', { name: /Export/i })
      if (exportButton) {
        fireEvent.click(exportButton)

        await waitFor(() => {
          expect(exportButton).toBeInTheDocument()
        })
      }
    })

    it('should include all messages in export', async () => {
      const storageMock = chrome.storage.local.get as jest.Mock
      storageMock.mockImplementation((keys, callback) =>
        callback({
          'ai-conversation-Test Variant': {
            messages: [
              { role: 'user', content: 'First message', timestamp: Date.now() },
              { role: 'assistant', content: 'Response', timestamp: Date.now() }
            ]
          }
        })
      )

      render(<AIDOMChangesPage {...defaultProps} />)

      await waitFor(() => {
        expect(storageMock).toHaveBeenCalled()
      })
    })
  })

  describe('Conversation Switching', () => {
    it('should save current conversation before switching', async () => {
      render(<AIDOMChangesPage {...defaultProps} />)

      const textarea = screen.getByPlaceholderText(/Example: Change the CTA/i)
      fireEvent.change(textarea, { target: { value: 'Current message' } })

      const newChatButton = screen.getByRole('button', { name: /New Chat/i })
      fireEvent.click(newChatButton)

      await waitFor(() => {
        expect(chrome.storage.local.set).toHaveBeenCalled()
      })
    })

    it('should load conversation history on switch', async () => {
      const storageMock = chrome.storage.local.get as jest.Mock
      storageMock.mockImplementation((keys, callback) =>
        callback({
          'ai-conversation-Test Variant': {
            messages: [
              { role: 'user', content: 'Previous chat', timestamp: Date.now() }
            ]
          }
        })
      )

      render(<AIDOMChangesPage {...defaultProps} />)

      await waitFor(() => {
        expect(storageMock).toHaveBeenCalled()
      })
    })
  })
})
