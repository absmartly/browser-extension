import { renderHook, waitFor, act } from '@testing-library/react'
import { useConversationHistory } from '../useConversationHistory'
import * as aiConversationStorage from '~src/utils/ai-conversation-storage'
import * as aiConversationMigration from '~src/utils/ai-conversation-migration'
import * as htmlCapture from '~src/utils/html-capture'
import * as messaging from '~src/lib/messaging'
import type { ChatMessage, ConversationSession, StoredConversation } from '~src/types/absmartly'

jest.mock('~src/utils/ai-conversation-storage')
jest.mock('~src/utils/ai-conversation-migration')
jest.mock('~src/utils/html-capture')
jest.mock('~src/lib/messaging')

describe('useConversationHistory', () => {
  const mockVariantName = 'test-variant'
  let mockGetConversationList: jest.Mock
  let mockSaveConversation: jest.Mock
  let mockLoadConversation: jest.Mock
  let mockDeleteConversation: jest.Mock
  let mockSetActiveConversation: jest.Mock
  let mockNeedsMigration: jest.Mock
  let mockMigrateConversation: jest.Mock
  let mockCapturePageHTML: jest.Mock
  let mockSendToBackground: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    mockGetConversationList = jest.fn()
    mockSaveConversation = jest.fn()
    mockLoadConversation = jest.fn()
    mockDeleteConversation = jest.fn()
    mockSetActiveConversation = jest.fn()
    mockNeedsMigration = jest.fn()
    mockMigrateConversation = jest.fn()
    mockCapturePageHTML = jest.fn()
    mockSendToBackground = jest.fn()

    ;(aiConversationStorage.getConversationList as jest.Mock) = mockGetConversationList
    ;(aiConversationStorage.saveConversation as jest.Mock) = mockSaveConversation
    ;(aiConversationStorage.loadConversation as jest.Mock) = mockLoadConversation
    ;(aiConversationStorage.deleteConversation as jest.Mock) = mockDeleteConversation
    ;(aiConversationStorage.setActiveConversation as jest.Mock) = mockSetActiveConversation
    ;(aiConversationMigration.needsMigration as jest.Mock) = mockNeedsMigration
    ;(aiConversationMigration.migrateConversation as jest.Mock) = mockMigrateConversation
    ;(htmlCapture.capturePageHTML as jest.Mock) = mockCapturePageHTML
    ;(messaging.sendToBackground as jest.Mock) = mockSendToBackground

    mockNeedsMigration.mockResolvedValue(false)
    mockGetConversationList.mockResolvedValue([])
    mockCapturePageHTML.mockResolvedValue({
      html: '<html><body>test</body></html>',
      url: 'https://example.com',
      domStructure: 'body\n  test'
    })
    mockSendToBackground.mockResolvedValue({
      success: true,
      session: {
        id: 'session-id',
        htmlSent: true,
        messages: []
      }
    })
  })

  describe('Initialization', () => {
    it('should initialize with empty conversation when no active conversation exists', async () => {
      mockGetConversationList.mockResolvedValue([])

      const { result } = renderHook(() => useConversationHistory(mockVariantName))

      expect(result.current.isLoadingHistory).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoadingHistory).toBe(false)
      })

      expect(result.current.chatHistory).toEqual([])
      expect(result.current.conversationSession).toBeDefined()
      expect(result.current.currentConversationId).toBeTruthy()
      expect(result.current.currentConversationId.length).toBeGreaterThan(0)
      expect(mockCapturePageHTML).toHaveBeenCalled()
      expect(mockSendToBackground).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'AI_INITIALIZE_SESSION'
        })
      )
    })

    it('should load active conversation if one exists', async () => {
      const mockSession: ConversationSession = {
        id: 'session-1',
        htmlSent: true,
        messages: []
      }
      const mockMessages: ChatMessage[] = [
        { role: 'user', content: 'Hello', timestamp: Date.now() },
        { role: 'assistant', content: 'Hi there!', timestamp: Date.now() }
      ]
      const mockConversation: StoredConversation = {
        id: 'conv-1',
        variantName: mockVariantName,
        messages: mockMessages,
        conversationSession: mockSession,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: 2,
        firstUserMessage: 'Hello',
        isActive: true
      }

      mockGetConversationList.mockResolvedValue([
        { id: 'conv-1', firstUserMessage: 'Hello', messageCount: 2, createdAt: Date.now(), isActive: true }
      ])
      mockLoadConversation.mockResolvedValue(mockConversation)

      const { result } = renderHook(() => useConversationHistory(mockVariantName))

      await waitFor(() => {
        expect(result.current.isLoadingHistory).toBe(false)
      })

      expect(result.current.chatHistory).toEqual(mockMessages)
      expect(result.current.conversationSession).toEqual(mockSession)
      expect(result.current.currentConversationId).toBe('conv-1')
      expect(mockLoadConversation).toHaveBeenCalledWith(mockVariantName, 'conv-1')
    })

    it('should handle migration when needed', async () => {
      mockNeedsMigration.mockResolvedValue(true)
      mockGetConversationList.mockResolvedValue([])

      const { result } = renderHook(() => useConversationHistory(mockVariantName))

      await waitFor(() => {
        expect(result.current.isLoadingHistory).toBe(false)
      })

      expect(mockNeedsMigration).toHaveBeenCalledWith(mockVariantName)
      expect(mockMigrateConversation).toHaveBeenCalledWith(mockVariantName)
    })

    it('should handle migration failure during load', async () => {
      const migrationError = new Error('Migration failed')
      mockNeedsMigration.mockRejectedValue(migrationError)

      const { result } = renderHook(() => useConversationHistory(mockVariantName))

      await waitFor(() => {
        expect(result.current.isLoadingHistory).toBe(false)
      })

      expect(result.current.error).toBe('Migration failed')
    })

    it('should handle HTML capture failure during initialization', async () => {
      const captureError = new Error('Capture failed')
      mockCapturePageHTML.mockRejectedValue(captureError)
      mockGetConversationList.mockResolvedValue([])

      const { result } = renderHook(() => useConversationHistory(mockVariantName))

      await waitFor(() => {
        expect(result.current.isLoadingHistory).toBe(false)
      })

      expect(result.current.conversationSession).toBeDefined()
      expect(mockCapturePageHTML).toHaveBeenCalled()
    })

    it('should initialize HTML for loaded conversation if not sent', async () => {
      const mockSession: ConversationSession = {
        id: 'session-1',
        htmlSent: false,
        messages: []
      }
      const mockConversation: StoredConversation = {
        id: 'conv-1',
        variantName: mockVariantName,
        messages: [],
        conversationSession: mockSession,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: 0,
        firstUserMessage: 'Test',
        isActive: true
      }

      mockGetConversationList.mockResolvedValue([
        { id: 'conv-1', firstUserMessage: 'Test', messageCount: 0, createdAt: Date.now(), isActive: true }
      ])
      mockLoadConversation.mockResolvedValue(mockConversation)

      const { result } = renderHook(() => useConversationHistory(mockVariantName))

      await waitFor(() => {
        expect(result.current.isLoadingHistory).toBe(false)
      })

      await waitFor(() => {
        expect(mockCapturePageHTML).toHaveBeenCalled()
      })

      expect(mockSendToBackground).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'AI_INITIALIZE_SESSION',
          conversationSession: mockSession
        })
      )
    })
  })

  describe('handleNewChat', () => {
    it('should save current conversation before creating new chat', async () => {
      mockGetConversationList.mockResolvedValue([])
      mockSaveConversation.mockResolvedValue(undefined)

      const { result } = renderHook(() => useConversationHistory(mockVariantName))

      await waitFor(() => {
        expect(result.current.isLoadingHistory).toBe(false)
      })

      const initialConvId = result.current.currentConversationId

      const mockMessages: ChatMessage[] = [
        { role: 'user', content: 'Test message', timestamp: Date.now() }
      ]

      act(() => {
        result.current.setChatHistory(mockMessages)
      })

      await act(async () => {
        await result.current.handleNewChat()
      })

      await waitFor(() => {
        expect(mockSaveConversation).toHaveBeenCalled()
      })

      expect(result.current.chatHistory).toEqual([])
      expect(result.current.currentConversationId).not.toBe(initialConvId)
      expect(result.current.currentConversationId).toBeTruthy()
    })

    it('should not save empty conversation when creating new chat', async () => {
      mockGetConversationList.mockResolvedValue([])

      const { result } = renderHook(() => useConversationHistory(mockVariantName))

      await waitFor(() => {
        expect(result.current.isLoadingHistory).toBe(false)
      })

      await act(async () => {
        await result.current.handleNewChat()
      })

      expect(mockSaveConversation).not.toHaveBeenCalled()
    })

    it('should handle storage quota during save', async () => {
      mockGetConversationList.mockResolvedValue([])
      mockSaveConversation.mockRejectedValue(new Error('QuotaExceededError'))

      const { result } = renderHook(() => useConversationHistory(mockVariantName))

      await waitFor(() => {
        expect(result.current.isLoadingHistory).toBe(false)
      })

      act(() => {
        result.current.setChatHistory([{ role: 'user', content: 'Test', timestamp: Date.now() }])
      })

      await act(async () => {
        await result.current.handleNewChat()
      })

      expect(result.current.chatHistory).toEqual([])
    })
  })

  describe('switchConversation', () => {
    it('should save current conversation before switching', async () => {
      const mockSession: ConversationSession = {
        id: 'session-1',
        htmlSent: true,
        messages: []
      }
      const targetMessage = { role: 'user' as const, content: 'Previous conversation', timestamp: Date.now() }
      const targetConversation: StoredConversation = {
        id: 'conv-2',
        variantName: mockVariantName,
        messages: [targetMessage],
        conversationSession: mockSession,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: 1,
        firstUserMessage: 'Previous conversation',
        isActive: false
      }

      mockGetConversationList.mockResolvedValue([
        { id: 'conv-1', firstUserMessage: 'Current', messageCount: 0, createdAt: Date.now(), updatedAt: Date.now(), isActive: true },
        { id: 'conv-2', firstUserMessage: 'Previous', messageCount: 1, createdAt: Date.now(), updatedAt: Date.now(), isActive: false }
      ])
      mockLoadConversation.mockResolvedValue(targetConversation)

      const { result } = renderHook(() => useConversationHistory(mockVariantName))

      await waitFor(() => {
        expect(result.current.isLoadingHistory).toBe(false)
      })

      await act(async () => {
        result.current.setChatHistory([{ role: 'user', content: 'Current message', timestamp: Date.now() }])
      })

      await act(async () => {
        await result.current.switchConversation({
          id: 'conv-2',
          firstUserMessage: 'Previous',
          messageCount: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: false
        })
      })

      await waitFor(() => {
        expect(mockLoadConversation).toHaveBeenCalledWith(mockVariantName, 'conv-2')
      })

      await waitFor(() => {
        expect(result.current.chatHistory).toHaveLength(1)
      })

      expect(mockSetActiveConversation).toHaveBeenCalledWith(mockVariantName, 'conv-2')
      expect(result.current.chatHistory[0].content).toBe('Previous conversation')
    })

    it('should handle parallel conversation switches', async () => {
      const mockSession1: ConversationSession = {
        id: 'session-1',
        htmlSent: true,
        messages: []
      }
      const mockSession2: ConversationSession = {
        id: 'session-2',
        htmlSent: true,
        messages: []
      }

      mockGetConversationList.mockResolvedValue([])
      mockLoadConversation
        .mockResolvedValueOnce({
          id: 'conv-1',
          variantName: mockVariantName,
          messages: [{ role: 'user', content: 'Conv 1', timestamp: Date.now() }],
          conversationSession: mockSession1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messageCount: 1,
          firstUserMessage: 'Conv 1',
          isActive: false
        })
        .mockResolvedValueOnce({
          id: 'conv-2',
          variantName: mockVariantName,
          messages: [{ role: 'user', content: 'Conv 2', timestamp: Date.now() }],
          conversationSession: mockSession2,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messageCount: 1,
          firstUserMessage: 'Conv 2',
          isActive: false
        })

      const { result } = renderHook(() => useConversationHistory(mockVariantName))

      await waitFor(() => {
        expect(result.current.isLoadingHistory).toBe(false)
      })

      await act(async () => {
        const switch1 = result.current.switchConversation({
          id: 'conv-1',
          firstUserMessage: 'Conv 1',
          messageCount: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: false
        })
        const switch2 = result.current.switchConversation({
          id: 'conv-2',
          firstUserMessage: 'Conv 2',
          messageCount: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isActive: false
        })
        await Promise.all([switch1, switch2])
      })

      expect(mockLoadConversation).toHaveBeenCalledTimes(2)
    })
  })

  describe('handleDeleteConversation', () => {
    it('should delete conversation and create new session if deleting active', async () => {
      const mockConversation: StoredConversation = {
        id: 'conv-1',
        variantName: mockVariantName,
        messages: [{ role: 'user', content: 'Test', timestamp: Date.now() }],
        conversationSession: { id: 'session-1', htmlSent: true, messages: [] },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: 1,
        firstUserMessage: 'Test',
        isActive: true
      }

      mockGetConversationList.mockResolvedValue([
        { id: 'conv-1', firstUserMessage: 'Test', messageCount: 1, createdAt: Date.now(), updatedAt: Date.now(), isActive: true }
      ])
      mockLoadConversation.mockResolvedValue(mockConversation)

      const { result } = renderHook(() => useConversationHistory(mockVariantName))

      await waitFor(() => {
        expect(result.current.isLoadingHistory).toBe(false)
      })

      const initialConvId = result.current.currentConversationId

      await act(async () => {
        await result.current.handleDeleteConversation('conv-1')
      })

      await waitFor(() => {
        expect(mockDeleteConversation).toHaveBeenCalledWith(mockVariantName, 'conv-1')
      })

      expect(result.current.chatHistory).toEqual([])
      expect(result.current.currentConversationId).not.toBe(initialConvId)
      expect(result.current.currentConversationId).toBeTruthy()
    })

    it('should delete conversation without affecting active session', async () => {
      mockGetConversationList.mockResolvedValue([
        { id: 'conv-1', firstUserMessage: 'Active', messageCount: 1, createdAt: Date.now(), isActive: true },
        { id: 'conv-2', firstUserMessage: 'Old', messageCount: 1, createdAt: Date.now(), isActive: false }
      ])

      const { result } = renderHook(() => useConversationHistory(mockVariantName))

      await waitFor(() => {
        expect(result.current.isLoadingHistory).toBe(false)
      })

      const initialConvId = result.current.currentConversationId

      await act(async () => {
        await result.current.handleDeleteConversation('conv-2')
      })

      expect(mockDeleteConversation).toHaveBeenCalledWith(mockVariantName, 'conv-2')
      expect(result.current.currentConversationId).toBe(initialConvId)
    })
  })

  describe('refreshHTML', () => {
    it('should refresh HTML context successfully', async () => {
      mockGetConversationList.mockResolvedValue([])

      const { result } = renderHook(() => useConversationHistory(mockVariantName))

      await waitFor(() => {
        expect(result.current.isLoadingHistory).toBe(false)
      })

      mockCapturePageHTML.mockResolvedValue({
        html: '<html><body>refreshed</body></html>',
        url: 'https://example.com/new',
        domStructure: 'body\n  refreshed'
      })

      mockSendToBackground.mockResolvedValue({
        success: true,
        session: {
          id: 'session-id',
          htmlSent: true,
          messages: []
        }
      })

      let refreshResult: boolean = false
      await act(async () => {
        refreshResult = await result.current.refreshHTML()
      })

      expect(refreshResult).toBe(true)
      expect(mockCapturePageHTML).toHaveBeenCalled()
      expect(mockSendToBackground).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'AI_REFRESH_HTML'
        })
      )
    })

    it('should handle refresh failure', async () => {
      mockGetConversationList.mockResolvedValue([])

      const { result } = renderHook(() => useConversationHistory(mockVariantName))

      await waitFor(() => {
        expect(result.current.isLoadingHistory).toBe(false)
      })

      mockSendToBackground.mockResolvedValue({
        success: false,
        error: 'Refresh failed'
      })

      let refreshResult: boolean = true
      await act(async () => {
        refreshResult = await result.current.refreshHTML()
      })

      expect(refreshResult).toBe(false)
      expect(result.current.error).toBe('Refresh failed')
    })

    it('should return false when no active conversation', async () => {
      const { result } = renderHook(() => useConversationHistory(mockVariantName))

      await waitFor(() => {
        expect(result.current.isLoadingHistory).toBe(false)
      })

      act(() => {
        result.current.setConversationSession(null)
      })

      let refreshResult: boolean = true
      await act(async () => {
        refreshResult = await result.current.refreshHTML()
      })

      expect(refreshResult).toBe(false)
      expect(result.current.error).toBe('No active conversation to refresh')
    })
  })

  describe('saveCurrentConversation', () => {
    it('should save conversation with correct metadata', async () => {
      mockGetConversationList.mockResolvedValue([])

      const { result } = renderHook(() => useConversationHistory(mockVariantName))

      await waitFor(() => {
        expect(result.current.isLoadingHistory).toBe(false)
      })

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello', timestamp: Date.now() },
        { role: 'assistant', content: 'Hi!', timestamp: Date.now() }
      ]
      const session: ConversationSession = {
        id: 'session-1',
        htmlSent: true,
        messages: []
      }

      await act(async () => {
        await result.current.saveCurrentConversation(messages, session)
      })

      expect(mockSaveConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: result.current.currentConversationId,
          variantName: mockVariantName,
          messages,
          conversationSession: session,
          messageCount: 2,
          firstUserMessage: 'Hello',
          isActive: true
        })
      )
    })

    it('should handle storage errors', async () => {
      mockGetConversationList.mockResolvedValue([])
      mockSaveConversation.mockRejectedValue(new Error('Storage full'))

      const { result } = renderHook(() => useConversationHistory(mockVariantName))

      await waitFor(() => {
        expect(result.current.isLoadingHistory).toBe(false)
      })

      const messages: ChatMessage[] = [{ role: 'user', content: 'Test', timestamp: Date.now() }]
      const session: ConversationSession = {
        id: 'session-1',
        htmlSent: true,
        messages: []
      }

      await expect(async () => {
        await act(async () => {
          await result.current.saveCurrentConversation(messages, session)
        })
      }).rejects.toThrow('Storage full')
    })
  })

  describe('Cleanup on unmount', () => {
    it('should not cause errors on unmount with active conversation', async () => {
      mockGetConversationList.mockResolvedValue([])

      const { result, unmount } = renderHook(() => useConversationHistory(mockVariantName))

      await waitFor(() => {
        expect(result.current.isLoadingHistory).toBe(false)
      })

      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Session recovery after errors', () => {
    it('should recover from initialization error', async () => {
      mockGetConversationList.mockRejectedValueOnce(new Error('Network error'))

      const { result, rerender, unmount } = renderHook(
        (props) => useConversationHistory(props.variantName),
        { initialProps: { variantName: mockVariantName } }
      )

      await waitFor(() => {
        expect(result.current.error).toBe('Network error')
      })

      expect(result.current.isLoadingHistory).toBe(false)

      unmount()

      mockGetConversationList.mockResolvedValue([])
      mockNeedsMigration.mockResolvedValue(false)

      const { result: newResult } = renderHook(
        () => useConversationHistory('new-variant')
      )

      await waitFor(() => {
        expect(newResult.current.isLoadingHistory).toBe(false)
      }, { timeout: 3000 })

      await waitFor(() => {
        expect(newResult.current.conversationSession).toBeDefined()
      }, { timeout: 3000 })

      expect(newResult.current.error).toBeNull()
    })
  })
})
