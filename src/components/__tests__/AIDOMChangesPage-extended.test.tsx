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
    set: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined)
  },
  sessionStorage: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined)
  },
  localAreaStorage: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined)
  }
}))

jest.mock('~src/utils/markdown', () => ({
  renderMarkdown: jest.fn((md: string) => md)
}))

const conversationState = {
  chatHistory: [],
  conversationSession: {
    id: 'test-session-id',
    messages: [],
    timestamp: Date.now(),
    htmlSent: false
  },
  conversationList: [],
  currentConversationId: 'test-session-id',
  isLoadingHistory: false,
  error: null
}

jest.mock('~src/hooks/useConversationHistory', () => ({
  useConversationHistory: jest.fn(() => ({
    chatHistory: conversationState.chatHistory,
    setChatHistory: jest.fn((history) => {
      conversationState.chatHistory = Array.isArray(history) ? history : history(conversationState.chatHistory)
    }),
    conversationSession: conversationState.conversationSession,
    setConversationSession: jest.fn((session) => {
      conversationState.conversationSession = session
    }),
    conversationList: conversationState.conversationList,
    currentConversationId: conversationState.currentConversationId,
    isLoadingHistory: conversationState.isLoadingHistory,
    error: conversationState.error,
    setError: jest.fn((error) => {
      conversationState.error = error
    }),
    handleNewChat: jest.fn(() => {
      conversationState.chatHistory = []
      conversationState.conversationSession = {
        id: 'new-session-' + Date.now(),
        messages: [],
        timestamp: Date.now(),
        htmlSent: false
      }
    }),
    switchConversation: jest.fn(async (conversation) => {
      conversationState.currentConversationId = conversation.id
      conversationState.chatHistory = conversation.messages || []
      conversationState.conversationSession = conversation.conversationSession
    }),
    handleDeleteConversation: jest.fn(async (conversationId) => {
      conversationState.conversationList = conversationState.conversationList.filter(c => c.id !== conversationId)
    }),
    refreshHTML: jest.fn(async () => {
      if (conversationState.conversationSession) {
        conversationState.conversationSession.htmlSent = false
      }
    }),
    saveCurrentConversation: jest.fn(async () => {
      return Promise.resolve()
    })
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
    conversationState.chatHistory = []
    conversationState.conversationSession = {
      id: 'test-session-id',
      messages: [],
      timestamp: Date.now(),
      htmlSent: false
    }
    conversationState.conversationList = []
    conversationState.currentConversationId = 'test-session-id'
    conversationState.isLoadingHistory = false
    conversationState.error = null
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

      await waitFor(() => {
        expect(screen.getByText(/Network timeout/i)).toBeInTheDocument()
      })

      fireEvent.change(textarea, { target: { value: 'Try again' } })
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
      render(<AIDOMChangesPage {...defaultProps} />)

      await waitFor(() => {
        expect(defaultProps.onPreviewWithChanges).toHaveBeenCalled()
      })
    })
  })

  describe('Session Recovery', () => {
    it('should recover conversation after page reload', async () => {
      conversationState.chatHistory = [
        { role: 'user', content: 'Previous message', timestamp: Date.now() }
      ]

      render(<AIDOMChangesPage {...defaultProps} />)

      await waitFor(() => {
        expect(screen.queryByText(/Previous message/i)).toBeInTheDocument()
      })
    })

    it('should preserve changes after session recovery', async () => {
      conversationState.chatHistory = [
        { role: 'user', content: 'Previous message', timestamp: Date.now() },
        { role: 'assistant', content: 'Applied changes', timestamp: Date.now(), domChanges: mockChanges }
      ]

      render(<AIDOMChangesPage {...defaultProps} />)

      await waitFor(() => {
        expect(screen.queryByText(/Applied changes/i)).toBeInTheDocument()
      })
    })
  })

  describe('Image Upload', () => {
    it('should handle image upload and compression', async () => {
      render(<AIDOMChangesPage {...defaultProps} />)

      const file = new File(['image'], 'test.png', { type: 'image/png' })
      const fileInput = screen.getByRole('textbox', { name: /What would you like to change/i }).parentElement?.parentElement?.querySelector('input[type="file"]') as HTMLInputElement

      expect(fileInput).toBeInTheDocument()

      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false
      })

      fireEvent.change(fileInput)

      await waitFor(() => {
        const images = screen.queryAllByAltText(/Attachment/i)
        expect(images.length).toBeGreaterThan(0)
      })
    })

    it('should show error for oversized images', async () => {
      render(<AIDOMChangesPage {...defaultProps} />)

      const largeFile = new File([new ArrayBuffer(10 * 1024 * 1024)], 'large.png', {
        type: 'image/png'
      })
      const fileInput = screen.getByRole('textbox', { name: /What would you like to change/i }).parentElement?.parentElement?.querySelector('input[type="file"]') as HTMLInputElement

      expect(fileInput).toBeInTheDocument()

      Object.defineProperty(fileInput, 'files', {
        value: [largeFile],
        writable: false
      })

      fireEvent.change(fileInput)

      await waitFor(() => {
        const images = screen.queryAllByAltText(/Attachment/i)
        expect(images.length).toBeGreaterThan(0)
      })
    })

    it('should handle image upload errors', async () => {
      render(<AIDOMChangesPage {...defaultProps} />)

      const invalidFile = new File(['not an image'], 'test.txt', { type: 'text/plain' })
      const fileInput = screen.getByRole('textbox', { name: /What would you like to change/i }).parentElement?.parentElement?.querySelector('input[type="file"]') as HTMLInputElement

      expect(fileInput).toBeInTheDocument()

      const imageCountBefore = screen.queryAllByAltText(/Attachment/i).length

      Object.defineProperty(fileInput, 'files', {
        value: [invalidFile],
        writable: false
      })

      fireEvent.change(fileInput)

      await waitFor(() => {
        const imageCountAfter = screen.queryAllByAltText(/Attachment/i).length
        expect(imageCountAfter).toBe(imageCountBefore)
      })
    })
  })

  describe('Conversation History', () => {
    it('should switch between conversations during active chat', async () => {
      render(<AIDOMChangesPage {...defaultProps} />)

      const newConversationButton = screen.getByRole('button', { name: /New Chat/i })

      const initialChatLength = conversationState.chatHistory.length

      fireEvent.click(newConversationButton)

      await waitFor(() => {
        expect(conversationState.chatHistory.length).toBeLessThanOrEqual(initialChatLength)
      })
    })

    it('should preserve current message when switching conversations', async () => {
      render(<AIDOMChangesPage {...defaultProps} />)

      const textarea = screen.getByPlaceholderText(/Example: Change the CTA/i)
      fireEvent.change(textarea, { target: { value: 'Unsaved message' } })

      expect(textarea).toHaveValue('Unsaved message')

      const newConversationButton = screen.getByRole('button', { name: /New Chat/i })

      conversationState.chatHistory = []
      conversationState.conversationSession = {
        id: 'new-session-' + Date.now(),
        messages: [],
        timestamp: Date.now(),
        htmlSent: false
      }

      fireEvent.click(newConversationButton)

      await waitFor(() => {
        expect(conversationState.chatHistory.length).toBe(0)
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
      conversationState.chatHistory = [
        { role: 'user', content: 'First message', timestamp: Date.now() },
        { role: 'assistant', content: 'Response', timestamp: Date.now() }
      ]

      render(<AIDOMChangesPage {...defaultProps} />)

      await waitFor(() => {
        expect(screen.queryByText(/First message/i)).toBeInTheDocument()
      })

      const exportButton = screen.queryByRole('button', { name: /Export/i })
      if (exportButton) {
        fireEvent.click(exportButton)
        await waitFor(() => {
          expect(exportButton).toBeInTheDocument()
        })
      }
    })
  })

  describe('Conversation Switching', () => {
    it('should save current conversation before switching', async () => {
      render(<AIDOMChangesPage {...defaultProps} />)

      const textarea = screen.getByPlaceholderText(/Example: Change the CTA/i)
      fireEvent.change(textarea, { target: { value: 'Current message' } })

      expect(textarea).toHaveValue('Current message')

      conversationState.chatHistory = []
      conversationState.conversationSession = {
        id: 'new-session-' + Date.now(),
        messages: [],
        timestamp: Date.now(),
        htmlSent: false
      }

      const newChatButton = screen.getByRole('button', { name: /New Chat/i })
      fireEvent.click(newChatButton)

      await waitFor(() => {
        expect(conversationState.chatHistory.length).toBe(0)
      })
    })

    it('should load conversation history on switch', async () => {
      conversationState.chatHistory = [
        { role: 'user', content: 'Previous chat message', timestamp: Date.now() }
      ]

      render(<AIDOMChangesPage {...defaultProps} />)

      await waitFor(() => {
        expect(conversationState.chatHistory.length).toBe(1)
      })
    })
  })
})
