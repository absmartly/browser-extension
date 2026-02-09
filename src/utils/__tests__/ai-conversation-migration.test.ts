import { needsMigration, migrateConversation } from '../ai-conversation-migration'
import { getConversations, saveConversation } from '../ai-conversation-storage'
import type { ChatMessage } from '~src/types/absmartly'
import { unsafeVariantName } from '~src/types/branded'

jest.mock('@plasmohq/storage', () => {
  const mockGet = jest.fn()
  const mockSet = jest.fn()
  const mockRemove = jest.fn()

  return {
    Storage: jest.fn(() => ({
      get: mockGet,
      set: mockSet,
      remove: mockRemove
    }))
  }
})

jest.mock('../ai-conversation-storage', () => ({
  getConversations: jest.fn(),
  saveConversation: jest.fn()
}))

describe('ai-conversation-migration', () => {
  let mockStorage: any

  beforeEach(() => {
    jest.clearAllMocks()
    const { Storage } = require('@plasmohq/storage')
    mockStorage = new Storage()
  })

  const createMockChatMessage = (overrides?: Partial<ChatMessage>): ChatMessage => ({
    role: 'user',
    content: 'Test message',
    timestamp: Date.now(),
    id: 'msg-1',
    ...overrides
  })

  describe('needsMigration', () => {
    it('should return true when old data exists and new conversations are empty', async () => {
      const oldMessages = [
        createMockChatMessage({ role: 'user', content: 'Hello' }),
        createMockChatMessage({ role: 'assistant', content: 'Hi there' })
      ]
      mockStorage.get.mockResolvedValue(JSON.stringify(oldMessages))
      ;(getConversations as jest.Mock).mockResolvedValue([])

      const result = await needsMigration(unsafeVariantName('variant-a'))

      expect(result).toBe(true)
      expect(mockStorage.get).toHaveBeenCalledWith('ai-chat-variant-a')
    })

    it('should return false when no old data exists', async () => {
      mockStorage.get.mockResolvedValue(null)
      ;(getConversations as jest.Mock).mockResolvedValue([])

      const result = await needsMigration(unsafeVariantName('variant-a'))

      expect(result).toBe(false)
    })

    it('should return false when new conversations already exist', async () => {
      const oldMessages = [createMockChatMessage()]
      mockStorage.get.mockResolvedValue(JSON.stringify(oldMessages))
      ;(getConversations as jest.Mock).mockResolvedValue([
        { id: 'conv-1', variantName: 'variant-a' }
      ])

      const result = await needsMigration(unsafeVariantName('variant-a'))

      expect(result).toBe(false)
    })

    it('should return false when old data is empty string', async () => {
      mockStorage.get.mockResolvedValue('')
      ;(getConversations as jest.Mock).mockResolvedValue([])

      const result = await needsMigration(unsafeVariantName('variant-a'))

      expect(result).toBe(false)
    })

    it('should handle errors gracefully and return false', async () => {
      mockStorage.get.mockRejectedValue(new Error('Storage error'))

      const result = await needsMigration(unsafeVariantName('variant-a'))

      expect(result).toBe(false)
    })
  })

  describe('migrateConversation', () => {
    it('should migrate old chat messages to new conversation format', async () => {
      const oldMessages: ChatMessage[] = [
        createMockChatMessage({ role: 'user', content: 'What is the meaning of life?' }),
        createMockChatMessage({ role: 'assistant', content: '42' }),
        createMockChatMessage({ role: 'user', content: 'Thanks!' })
      ]
      mockStorage.get.mockResolvedValue(JSON.stringify(oldMessages))

      await migrateConversation(unsafeVariantName('variant-a'))

      expect(saveConversation).toHaveBeenCalledTimes(1)

      const savedConversation = (saveConversation as jest.Mock).mock.calls[0][0]
      expect(savedConversation.variantName).toBe('variant-a')
      expect(savedConversation.messages).toEqual(oldMessages)
      expect(savedConversation.messageCount).toBe(3)
      expect(savedConversation.firstUserMessage).toBe('What is the meaning of life?')
      expect(savedConversation.isActive).toBe(true)
      expect(savedConversation.id).toBeDefined()
      expect(savedConversation.conversationSession.id).toBeDefined()

      expect(mockStorage.remove).toHaveBeenCalledWith('ai-chat-variant-a')
    })

    it('should truncate first user message to 50 characters', async () => {
      const longMessage = 'This is a very long message that should be truncated to exactly fifty characters for the preview'
      const oldMessages: ChatMessage[] = [
        createMockChatMessage({ role: 'user', content: longMessage })
      ]
      mockStorage.get.mockResolvedValue(JSON.stringify(oldMessages))

      await migrateConversation(unsafeVariantName('variant-a'))

      const savedConversation = (saveConversation as jest.Mock).mock.calls[0][0]
      expect(savedConversation.firstUserMessage).toBe('This is a very long message that should be truncat')
      expect(savedConversation.firstUserMessage.length).toBe(50)
    })

    it('should use fallback message when no user messages exist', async () => {
      const oldMessages: ChatMessage[] = [
        createMockChatMessage({ role: 'assistant', content: 'Hello' })
      ]
      mockStorage.get.mockResolvedValue(JSON.stringify(oldMessages))

      await migrateConversation(unsafeVariantName('variant-a'))

      const savedConversation = (saveConversation as jest.Mock).mock.calls[0][0]
      expect(savedConversation.firstUserMessage).toBe('Migrated conversation')
    })

    it('should skip migration when no old data exists', async () => {
      mockStorage.get.mockResolvedValue(null)

      await migrateConversation(unsafeVariantName('variant-a'))

      expect(saveConversation).not.toHaveBeenCalled()
      expect(mockStorage.remove).not.toHaveBeenCalled()
    })

    it('should skip migration and cleanup when old data is empty array', async () => {
      mockStorage.get.mockResolvedValue(JSON.stringify([]))

      await migrateConversation(unsafeVariantName('variant-a'))

      expect(saveConversation).not.toHaveBeenCalled()
      expect(mockStorage.remove).toHaveBeenCalledWith('ai-chat-variant-a')
    })

    it('should skip migration and cleanup when old data is invalid JSON', async () => {
      mockStorage.get.mockResolvedValue('invalid-json')

      await expect(migrateConversation(unsafeVariantName('variant-a'))).rejects.toThrow()
      expect(saveConversation).not.toHaveBeenCalled()
      expect(mockStorage.remove).not.toHaveBeenCalled()
    })

    it('should skip migration and cleanup when old data is not an array', async () => {
      mockStorage.get.mockResolvedValue(JSON.stringify({ invalid: 'structure' }))

      await migrateConversation(unsafeVariantName('variant-a'))

      expect(saveConversation).not.toHaveBeenCalled()
      expect(mockStorage.remove).toHaveBeenCalledWith('ai-chat-variant-a')
    })

    it('should create unique IDs for conversation and session', async () => {
      const oldMessages: ChatMessage[] = [
        createMockChatMessage({ role: 'user', content: 'Test' })
      ]
      mockStorage.get.mockResolvedValue(JSON.stringify(oldMessages))

      await migrateConversation(unsafeVariantName('variant-a'))

      const savedConversation = (saveConversation as jest.Mock).mock.calls[0][0]
      expect(savedConversation.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      expect(savedConversation.conversationSession.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      expect(savedConversation.id).not.toBe(savedConversation.conversationSession.id)
    })

    it('should initialize conversation session correctly', async () => {
      const oldMessages: ChatMessage[] = [
        createMockChatMessage({ role: 'user', content: 'Test' })
      ]
      mockStorage.get.mockResolvedValue(JSON.stringify(oldMessages))

      await migrateConversation(unsafeVariantName('variant-a'))

      const savedConversation = (saveConversation as jest.Mock).mock.calls[0][0]
      expect(savedConversation.conversationSession.htmlSent).toBe(false)
      expect(savedConversation.conversationSession.messages).toEqual([])
    })

    it('should set timestamps correctly', async () => {
      const oldMessages: ChatMessage[] = [
        createMockChatMessage({ role: 'user', content: 'Test' })
      ]
      mockStorage.get.mockResolvedValue(JSON.stringify(oldMessages))

      const beforeTime = Date.now()
      await migrateConversation(unsafeVariantName('variant-a'))
      const afterTime = Date.now()

      const savedConversation = (saveConversation as jest.Mock).mock.calls[0][0]
      expect(savedConversation.createdAt).toBeGreaterThanOrEqual(beforeTime)
      expect(savedConversation.createdAt).toBeLessThanOrEqual(afterTime)
      expect(savedConversation.updatedAt).toBeGreaterThanOrEqual(beforeTime)
      expect(savedConversation.updatedAt).toBeLessThanOrEqual(afterTime)
    })

    it('should preserve all message data including images and metadata', async () => {
      const oldMessages: ChatMessage[] = [
        createMockChatMessage({
          role: 'user',
          content: 'Check this out',
          images: ['data:image/png;base64,abc123'],
          domChangesSnapshot: [
            { selector: '.test', type: 'text', value: 'Test' }
          ]
        }),
        createMockChatMessage({
          role: 'assistant',
          content: 'I see that',
          aiResponse: 'Full AI response'
        })
      ]
      mockStorage.get.mockResolvedValue(JSON.stringify(oldMessages))

      await migrateConversation(unsafeVariantName('variant-a'))

      const savedConversation = (saveConversation as jest.Mock).mock.calls[0][0]
      expect(savedConversation.messages).toEqual(oldMessages)
      expect(savedConversation.messages[0].images).toEqual(['data:image/png;base64,abc123'])
      expect(savedConversation.messages[0].domChangesSnapshot).toBeDefined()
      expect(savedConversation.messages[1].aiResponse).toBe('Full AI response')
    })

    it('should handle migration with multiple user messages correctly', async () => {
      const oldMessages: ChatMessage[] = [
        createMockChatMessage({ role: 'user', content: 'First question' }),
        createMockChatMessage({ role: 'assistant', content: 'First answer' }),
        createMockChatMessage({ role: 'user', content: 'Second question' }),
        createMockChatMessage({ role: 'assistant', content: 'Second answer' })
      ]
      mockStorage.get.mockResolvedValue(JSON.stringify(oldMessages))

      await migrateConversation(unsafeVariantName('variant-a'))

      const savedConversation = (saveConversation as jest.Mock).mock.calls[0][0]
      expect(savedConversation.firstUserMessage).toBe('First question')
      expect(savedConversation.messageCount).toBe(4)
    })

    it('should handle errors during migration', async () => {
      const oldMessages: ChatMessage[] = [
        createMockChatMessage({ role: 'user', content: 'Test' })
      ]
      mockStorage.get.mockResolvedValue(JSON.stringify(oldMessages))
      ;(saveConversation as jest.Mock).mockRejectedValue(new Error('Save failed'))

      await expect(migrateConversation(unsafeVariantName('variant-a'))).rejects.toThrow('Save failed')

      expect(mockStorage.remove).not.toHaveBeenCalled()
    })
  })
})
