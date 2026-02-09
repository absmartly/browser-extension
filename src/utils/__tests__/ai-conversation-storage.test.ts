import {
  getConversations,
  saveConversation,
  loadConversation,
  deleteConversation,
  getConversationList,
  setActiveConversation
} from '../ai-conversation-storage'
import type { StoredConversation, ConversationSession, ChatMessage } from '~src/types/absmartly'
import * as idbStorage from '../indexeddb-storage'
import { unsafeSessionId, unsafeConversationId, unsafeVariantName } from '~src/types/branded'

jest.mock('../indexeddb-storage')

const mockIdbStorage = idbStorage as jest.Mocked<typeof idbStorage>

describe('ai-conversation-storage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const createMockConversation = (overrides?: Partial<StoredConversation>): StoredConversation => {
    const defaultSession: ConversationSession = {
      id: unsafeSessionId('session-123'),
      htmlSent: false,
      messages: []
    }

    const defaultMessage: ChatMessage = {
      role: 'user',
      content: 'Test message',
      timestamp: Date.now(),
      id: 'msg-1'
    }

    return {
      id: unsafeConversationId('conv-123'),
      variantName: unsafeVariantName('variant-a'),
      messages: [defaultMessage],
      conversationSession: defaultSession,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 1,
      firstUserMessage: 'Test message',
      isActive: false,
      ...overrides
    }
  }

  describe('getConversations', () => {
    it('should delegate to idbStorage.getConversations', async () => {
      const mockConversations = [createMockConversation()]
      mockIdbStorage.getConversations.mockResolvedValue(mockConversations)

      const result = await getConversations(unsafeVariantName('variant-a'))

      expect(mockIdbStorage.getConversations).toHaveBeenCalledWith(unsafeVariantName('variant-a'))
      expect(result).toEqual(mockConversations)
    })

    it('should return empty array on error', async () => {
      mockIdbStorage.getConversations.mockRejectedValue(new Error('DB error'))

      const result = await getConversations(unsafeVariantName('variant-a'))

      expect(result).toEqual([])
    })
  })

  describe('saveConversation', () => {
    it('should delegate to idbStorage.saveConversation', async () => {
      mockIdbStorage.saveConversation.mockResolvedValue(undefined)
      const conversation = createMockConversation()

      await saveConversation(conversation)

      expect(mockIdbStorage.saveConversation).toHaveBeenCalled()
    })

    it('should throw quota exceeded error when storage fails with quota message', async () => {
      mockIdbStorage.saveConversation.mockRejectedValue(new Error('quota exceeded'))

      const conversation = createMockConversation()

      await expect(saveConversation(conversation)).rejects.toThrow(
        /Storage quota exceeded/
      )
    })

    it('should re-throw other errors', async () => {
      mockIdbStorage.saveConversation.mockRejectedValue(new Error('Other error'))

      const conversation = createMockConversation()

      await expect(saveConversation(conversation)).rejects.toThrow('Other error')
    })
  })

  describe('loadConversation', () => {
    it('should delegate to idbStorage.loadConversation', async () => {
      const mockConversation = createMockConversation()
      mockIdbStorage.loadConversation.mockResolvedValue(mockConversation)

      const result = await loadConversation('variant-a', 'conv-123')

      expect(mockIdbStorage.loadConversation).toHaveBeenCalledWith('variant-a', 'conv-123')
      expect(result).toEqual(mockConversation)
    })

    it('should return null on error', async () => {
      mockIdbStorage.loadConversation.mockRejectedValue(new Error('DB error'))

      const result = await loadConversation('variant-a', 'conv-123')

      expect(result).toBeNull()
    })

    it('should return null when conversation not found', async () => {
      mockIdbStorage.loadConversation.mockResolvedValue(null)

      const result = await loadConversation('variant-a', 'non-existent')

      expect(result).toBeNull()
    })
  })

  describe('deleteConversation', () => {
    it('should delegate to idbStorage.deleteConversation', async () => {
      mockIdbStorage.deleteConversation.mockResolvedValue(undefined)

      await deleteConversation('variant-a', 'conv-123')

      expect(mockIdbStorage.deleteConversation).toHaveBeenCalledWith('variant-a', 'conv-123')
    })

    it('should re-throw errors', async () => {
      mockIdbStorage.deleteConversation.mockRejectedValue(new Error('DB error'))

      await expect(deleteConversation('variant-a', 'conv-123')).rejects.toThrow('DB error')
    })
  })

  describe('getConversationList', () => {
    it('should delegate to idbStorage.getConversationList', async () => {
      const mockListItems = [
        { id: unsafeConversationId('conv-1'), createdAt: Date.now(), updatedAt: Date.now(), messageCount: 1, firstUserMessage: 'Test', isActive: false },
        { id: unsafeConversationId('conv-2'), createdAt: Date.now(), updatedAt: Date.now(), messageCount: 2, firstUserMessage: 'Test 2', isActive: true }
      ]
      mockIdbStorage.getConversationList.mockResolvedValue(mockListItems)

      const result = await getConversationList(unsafeVariantName('variant-a'))

      expect(mockIdbStorage.getConversationList).toHaveBeenCalledWith(unsafeVariantName('variant-a'))
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe(unsafeConversationId('conv-1'))
      expect(result[1].id).toBe(unsafeConversationId('conv-2'))
    })

    it('should return empty array on error', async () => {
      mockIdbStorage.getConversationList.mockRejectedValue(new Error('DB error'))

      const result = await getConversationList(unsafeVariantName('variant-a'))

      expect(result).toEqual([])
    })
  })

  describe('setActiveConversation', () => {
    it('should delegate to idbStorage.setActiveConversation', async () => {
      mockIdbStorage.setActiveConversation.mockResolvedValue(undefined)

      await setActiveConversation('variant-a', 'conv-123')

      expect(mockIdbStorage.setActiveConversation).toHaveBeenCalledWith('variant-a', 'conv-123')
    })

    it('should re-throw errors', async () => {
      mockIdbStorage.setActiveConversation.mockRejectedValue(new Error('DB error'))

      await expect(setActiveConversation('variant-a', 'conv-123')).rejects.toThrow('DB error')
    })
  })
})
