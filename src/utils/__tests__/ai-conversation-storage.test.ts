import {
  getConversations,
  saveConversation,
  loadConversation,
  deleteConversation,
  getConversationList,
  setActiveConversation
} from '../ai-conversation-storage'
import type { StoredConversation, ConversationSession, ChatMessage } from '~src/types/absmartly'

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

describe('ai-conversation-storage', () => {
  let mockStorage: any

  beforeEach(() => {
    jest.clearAllMocks()
    const { Storage } = require('@plasmohq/storage')
    mockStorage = new Storage()
  })

  const createMockConversation = (overrides?: Partial<StoredConversation>): StoredConversation => {
    const defaultSession: ConversationSession = {
      id: 'session-123',
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
      id: 'conv-123',
      variantName: 'variant-a',
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
    it('should return empty array when no conversations exist', async () => {
      mockStorage.get.mockResolvedValue(null)

      const result = await getConversations('variant-a')

      expect(result).toEqual([])
      expect(mockStorage.get).toHaveBeenCalledWith('ai-conversations-variant-a')
    })

    it('should return conversations array from storage', async () => {
      const mockConv1 = createMockConversation({ id: 'conv-1' })
      const mockConv2 = createMockConversation({ id: 'conv-2' })
      const storedData = JSON.stringify({
        conversations: [mockConv1, mockConv2],
        version: 1
      })

      mockStorage.get.mockResolvedValue(storedData)

      const result = await getConversations('variant-a')

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('conv-1')
      expect(result[1].id).toBe('conv-2')
    })

    it('should handle corrupted storage data gracefully', async () => {
      mockStorage.get.mockResolvedValue('invalid-json')

      const result = await getConversations('variant-a')

      expect(result).toEqual([])
    })

    it('should return empty array when storage contains invalid structure', async () => {
      mockStorage.get.mockResolvedValue(JSON.stringify({ invalid: 'structure' }))

      const result = await getConversations('variant-a')

      expect(result).toEqual([])
    })
  })

  describe('saveConversation', () => {
    it('should create new conversation when it does not exist', async () => {
      mockStorage.get.mockResolvedValue(null)
      const newConv = createMockConversation()

      await saveConversation(newConv)

      expect(mockStorage.set).toHaveBeenCalledTimes(1)
      const setCall = mockStorage.set.mock.calls[0]
      expect(setCall[0]).toBe('ai-conversations-variant-a')

      const savedData = JSON.parse(setCall[1])
      expect(savedData.conversations).toHaveLength(1)
      expect(savedData.conversations[0].id).toBe('conv-123')
      expect(savedData.version).toBe(1)
    })

    it('should update existing conversation', async () => {
      const existingConv = createMockConversation({ id: 'conv-123', messageCount: 1 })
      const storedData = JSON.stringify({
        conversations: [existingConv],
        version: 1
      })
      mockStorage.get.mockResolvedValue(storedData)

      const updatedConv = createMockConversation({
        id: 'conv-123',
        messageCount: 2,
        firstUserMessage: 'Updated message'
      })

      await saveConversation(updatedConv)

      const setCall = mockStorage.set.mock.calls[0]
      const savedData = JSON.parse(setCall[1])
      expect(savedData.conversations).toHaveLength(1)
      expect(savedData.conversations[0].messageCount).toBe(2)
      expect(savedData.conversations[0].firstUserMessage).toBe('Updated message')
    })

    it('should set createdAt and updatedAt timestamps for new conversations', async () => {
      mockStorage.get.mockResolvedValue(null)
      const newConv = createMockConversation()
      delete (newConv as any).createdAt

      const beforeTime = Date.now()
      await saveConversation(newConv)
      const afterTime = Date.now()

      const setCall = mockStorage.set.mock.calls[0]
      const savedData = JSON.parse(setCall[1])
      const savedConv = savedData.conversations[0]

      expect(savedConv.createdAt).toBeGreaterThanOrEqual(beforeTime)
      expect(savedConv.createdAt).toBeLessThanOrEqual(afterTime)
      expect(savedConv.updatedAt).toBeGreaterThanOrEqual(beforeTime)
      expect(savedConv.updatedAt).toBeLessThanOrEqual(afterTime)
    })

    it('should update updatedAt timestamp for existing conversations', async () => {
      const oldTimestamp = Date.now() - 10000
      const existingConv = createMockConversation({
        id: 'conv-123',
        createdAt: oldTimestamp,
        updatedAt: oldTimestamp
      })
      const storedData = JSON.stringify({
        conversations: [existingConv],
        version: 1
      })
      mockStorage.get.mockResolvedValue(storedData)

      await saveConversation(existingConv)

      const setCall = mockStorage.set.mock.calls[0]
      const savedData = JSON.parse(setCall[1])
      const savedConv = savedData.conversations[0]

      expect(savedConv.createdAt).toBe(oldTimestamp)
      expect(savedConv.updatedAt).toBeGreaterThan(oldTimestamp)
    })

    it('should enforce 10 conversation limit by removing oldest', async () => {
      const conversations: StoredConversation[] = []
      for (let i = 0; i < 10; i++) {
        conversations.push(createMockConversation({
          id: `conv-${i}`,
          createdAt: Date.now() + i * 1000
        }))
      }

      const storedData = JSON.stringify({
        conversations,
        version: 1
      })
      mockStorage.get.mockResolvedValue(storedData)

      const newConv = createMockConversation({ id: 'conv-new', createdAt: Date.now() + 20000 })
      await saveConversation(newConv)

      const setCall = mockStorage.set.mock.calls[0]
      const savedData = JSON.parse(setCall[1])

      expect(savedData.conversations).toHaveLength(10)
      expect(savedData.conversations.find((c: StoredConversation) => c.id === 'conv-0')).toBeUndefined()
      expect(savedData.conversations.find((c: StoredConversation) => c.id === 'conv-new')).toBeDefined()
    })

    it('should keep conversations sorted by createdAt when enforcing limit', async () => {
      const conversations: StoredConversation[] = []
      for (let i = 0; i < 10; i++) {
        conversations.push(createMockConversation({
          id: `conv-${i}`,
          createdAt: Date.now() + i * 1000
        }))
      }

      const storedData = JSON.stringify({
        conversations,
        version: 1
      })
      mockStorage.get.mockResolvedValue(storedData)

      const newConv = createMockConversation({ id: 'conv-11', createdAt: Date.now() + 11000 })
      await saveConversation(newConv)

      const setCall = mockStorage.set.mock.calls[0]
      const savedData = JSON.parse(setCall[1])

      const ids = savedData.conversations.map((c: StoredConversation) => c.id)
      expect(ids).toEqual(['conv-1', 'conv-2', 'conv-3', 'conv-4', 'conv-5', 'conv-6', 'conv-7', 'conv-8', 'conv-9', 'conv-11'])
    })
  })

  describe('loadConversation', () => {
    it('should return conversation by ID', async () => {
      const conv1 = createMockConversation({ id: 'conv-1' })
      const conv2 = createMockConversation({ id: 'conv-2' })
      const storedData = JSON.stringify({
        conversations: [conv1, conv2],
        version: 1
      })
      mockStorage.get.mockResolvedValue(storedData)

      const result = await loadConversation('variant-a', 'conv-2')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('conv-2')
    })

    it('should return null when conversation not found', async () => {
      const conv1 = createMockConversation({ id: 'conv-1' })
      const storedData = JSON.stringify({
        conversations: [conv1],
        version: 1
      })
      mockStorage.get.mockResolvedValue(storedData)

      const result = await loadConversation('variant-a', 'non-existent')

      expect(result).toBeNull()
    })

    it('should return null when storage is empty', async () => {
      mockStorage.get.mockResolvedValue(null)

      const result = await loadConversation('variant-a', 'conv-1')

      expect(result).toBeNull()
    })

    it('should handle storage errors gracefully', async () => {
      mockStorage.get.mockRejectedValue(new Error('Storage error'))

      const result = await loadConversation('variant-a', 'conv-1')

      expect(result).toBeNull()
    })
  })

  describe('deleteConversation', () => {
    it('should remove conversation by ID', async () => {
      const conv1 = createMockConversation({ id: 'conv-1' })
      const conv2 = createMockConversation({ id: 'conv-2' })
      const conv3 = createMockConversation({ id: 'conv-3' })
      const storedData = JSON.stringify({
        conversations: [conv1, conv2, conv3],
        version: 1
      })
      mockStorage.get.mockResolvedValue(storedData)

      await deleteConversation('variant-a', 'conv-2')

      const setCall = mockStorage.set.mock.calls[0]
      const savedData = JSON.parse(setCall[1])

      expect(savedData.conversations).toHaveLength(2)
      expect(savedData.conversations.find((c: StoredConversation) => c.id === 'conv-2')).toBeUndefined()
      expect(savedData.conversations.find((c: StoredConversation) => c.id === 'conv-1')).toBeDefined()
      expect(savedData.conversations.find((c: StoredConversation) => c.id === 'conv-3')).toBeDefined()
    })

    it('should handle deleting non-existent conversation', async () => {
      const conv1 = createMockConversation({ id: 'conv-1' })
      const storedData = JSON.stringify({
        conversations: [conv1],
        version: 1
      })
      mockStorage.get.mockResolvedValue(storedData)

      await deleteConversation('variant-a', 'non-existent')

      const setCall = mockStorage.set.mock.calls[0]
      const savedData = JSON.parse(setCall[1])

      expect(savedData.conversations).toHaveLength(1)
    })

    it('should handle empty storage', async () => {
      mockStorage.get.mockResolvedValue(null)

      await expect(deleteConversation('variant-a', 'conv-1')).resolves.not.toThrow()
    })
  })

  describe('getConversationList', () => {
    it('should return lightweight metadata sorted by updatedAt DESC', async () => {
      const conv1 = createMockConversation({
        id: 'conv-1',
        updatedAt: Date.now() - 3000,
        messageCount: 5,
        firstUserMessage: 'First conversation'
      })
      const conv2 = createMockConversation({
        id: 'conv-2',
        updatedAt: Date.now() - 1000,
        messageCount: 3,
        firstUserMessage: 'Second conversation'
      })
      const conv3 = createMockConversation({
        id: 'conv-3',
        updatedAt: Date.now() - 2000,
        messageCount: 8,
        firstUserMessage: 'Third conversation'
      })
      const storedData = JSON.stringify({
        conversations: [conv1, conv2, conv3],
        version: 1
      })
      mockStorage.get.mockResolvedValue(storedData)

      const result = await getConversationList('variant-a')

      expect(result).toHaveLength(3)
      expect(result[0].id).toBe('conv-2')
      expect(result[1].id).toBe('conv-3')
      expect(result[2].id).toBe('conv-1')

      expect(result[0]).toHaveProperty('createdAt')
      expect(result[0]).toHaveProperty('updatedAt')
      expect(result[0]).toHaveProperty('messageCount')
      expect(result[0]).toHaveProperty('firstUserMessage')
      expect(result[0]).toHaveProperty('isActive')

      expect(result[0]).not.toHaveProperty('messages')
      expect(result[0]).not.toHaveProperty('conversationSession')
      expect(result[0]).not.toHaveProperty('variantName')
    })

    it('should return empty array when no conversations exist', async () => {
      mockStorage.get.mockResolvedValue(null)

      const result = await getConversationList('variant-a')

      expect(result).toEqual([])
    })

    it('should handle storage errors gracefully', async () => {
      mockStorage.get.mockRejectedValue(new Error('Storage error'))

      const result = await getConversationList('variant-a')

      expect(result).toEqual([])
    })
  })

  describe('setActiveConversation', () => {
    it('should set specified conversation as active and others as inactive', async () => {
      const conv1 = createMockConversation({ id: 'conv-1', isActive: true })
      const conv2 = createMockConversation({ id: 'conv-2', isActive: false })
      const conv3 = createMockConversation({ id: 'conv-3', isActive: false })
      const storedData = JSON.stringify({
        conversations: [conv1, conv2, conv3],
        version: 1
      })
      mockStorage.get.mockResolvedValue(storedData)

      await setActiveConversation('variant-a', 'conv-2')

      const setCall = mockStorage.set.mock.calls[0]
      const savedData = JSON.parse(setCall[1])

      expect(savedData.conversations[0].isActive).toBe(false)
      expect(savedData.conversations[1].isActive).toBe(true)
      expect(savedData.conversations[2].isActive).toBe(false)
    })

    it('should handle setting active conversation when all are inactive', async () => {
      const conv1 = createMockConversation({ id: 'conv-1', isActive: false })
      const conv2 = createMockConversation({ id: 'conv-2', isActive: false })
      const storedData = JSON.stringify({
        conversations: [conv1, conv2],
        version: 1
      })
      mockStorage.get.mockResolvedValue(storedData)

      await setActiveConversation('variant-a', 'conv-1')

      const setCall = mockStorage.set.mock.calls[0]
      const savedData = JSON.parse(setCall[1])

      expect(savedData.conversations[0].isActive).toBe(true)
      expect(savedData.conversations[1].isActive).toBe(false)
    })

    it('should handle setting non-existent conversation as active', async () => {
      const conv1 = createMockConversation({ id: 'conv-1', isActive: true })
      const storedData = JSON.stringify({
        conversations: [conv1],
        version: 1
      })
      mockStorage.get.mockResolvedValue(storedData)

      await setActiveConversation('variant-a', 'non-existent')

      const setCall = mockStorage.set.mock.calls[0]
      const savedData = JSON.parse(setCall[1])

      expect(savedData.conversations[0].isActive).toBe(false)
    })

    it('should handle empty storage', async () => {
      mockStorage.get.mockResolvedValue(null)

      await expect(setActiveConversation('variant-a', 'conv-1')).resolves.not.toThrow()
    })
  })

  describe('Storage Sanitization', () => {
    it('should remove images from messages when saving', async () => {
      mockStorage.get.mockResolvedValue(null)

      const messageWithImage: ChatMessage = {
        role: 'user',
        content: 'Look at this image',
        images: ['data:image/png;base64,iVBORw0KGgoAAAANS...'],
        timestamp: Date.now(),
        id: 'msg-1'
      }

      const conversation = createMockConversation({
        messages: [messageWithImage]
      })

      await saveConversation(conversation)

      const setCall = mockStorage.set.mock.calls[0]
      const savedData = JSON.parse(setCall[1])
      const savedMessage = savedData.conversations[0].messages[0]

      expect(savedMessage.images).toBeUndefined()
      expect(savedMessage.content).toBe('Look at this image')
      expect(savedMessage.role).toBe('user')
    })

    it('should clear session messages when saving', async () => {
      mockStorage.get.mockResolvedValue(null)

      const sessionWithMessages: ConversationSession = {
        id: 'session-123',
        htmlSent: true,
        messages: [
          { role: 'user', content: 'User message' },
          { role: 'assistant', content: 'Assistant message' }
        ]
      }

      const conversation = createMockConversation({
        conversationSession: sessionWithMessages
      })

      await saveConversation(conversation)

      const setCall = mockStorage.set.mock.calls[0]
      const savedData = JSON.parse(setCall[1])
      const savedSession = savedData.conversations[0].conversationSession

      expect(savedSession.messages).toEqual([])
      expect(savedSession.id).toBe('session-123')
      expect(savedSession.htmlSent).toBe(true)
    })

    it('should preserve all other conversation data', async () => {
      mockStorage.get.mockResolvedValue(null)

      const conversation = createMockConversation({
        id: 'conv-preserve',
        variantName: 'variant-test',
        messageCount: 5,
        firstUserMessage: 'First message',
        isActive: true
      })

      await saveConversation(conversation)

      const setCall = mockStorage.set.mock.calls[0]
      const savedData = JSON.parse(setCall[1])
      const savedConv = savedData.conversations[0]

      expect(savedConv.id).toBe('conv-preserve')
      expect(savedConv.variantName).toBe('variant-test')
      expect(savedConv.messageCount).toBe(5)
      expect(savedConv.firstUserMessage).toBe('First message')
      expect(savedConv.isActive).toBe(true)
    })

    it('should handle messages without images', async () => {
      mockStorage.get.mockResolvedValue(null)

      const messageWithoutImage: ChatMessage = {
        role: 'user',
        content: 'Text only message',
        timestamp: Date.now(),
        id: 'msg-1'
      }

      const conversation = createMockConversation({
        messages: [messageWithoutImage]
      })

      await saveConversation(conversation)

      const setCall = mockStorage.set.mock.calls[0]
      const savedData = JSON.parse(setCall[1])
      const savedMessage = savedData.conversations[0].messages[0]

      expect(savedMessage.images).toBeUndefined()
      expect(savedMessage.content).toBe('Text only message')
    })
  })

  describe('Storage Size Limits', () => {
    it('should log warning when conversation exceeds 90KB', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
      mockStorage.get.mockResolvedValue(null)

      const largeContent = 'x'.repeat(50000)
      const largeMessages: ChatMessage[] = Array.from({ length: 30 }, (_, i) => ({
        role: 'user',
        content: largeContent,
        timestamp: Date.now(),
        id: `msg-${i}`
      }))

      const conversation = createMockConversation({
        messages: largeMessages
      })

      try {
        await saveConversation(conversation)
      } catch (error) {

      }

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ConversationStorage] Conversation data is large')
      )

      consoleWarnSpy.mockRestore()
    })

    it('should throw error when conversation exceeds 100KB', async () => {
      mockStorage.get.mockResolvedValue(null)

      const veryLargeContent = 'x'.repeat(150000)
      const veryLargeMessages: ChatMessage[] = Array.from({ length: 20 }, (_, i) => ({
        role: 'user',
        content: veryLargeContent,
        timestamp: Date.now(),
        id: `msg-${i}`
      }))

      const conversation = createMockConversation({
        messages: veryLargeMessages
      })

      await expect(saveConversation(conversation)).rejects.toThrow(
        /Storage quota exceeded/
      )

      expect(mockStorage.set).not.toHaveBeenCalled()
    })

    it('should calculate size correctly for multiple conversations', async () => {
      const conv1 = createMockConversation({ id: 'conv-1' })
      const storedData = JSON.stringify({
        conversations: [conv1],
        version: 1
      })

      mockStorage.get.mockResolvedValue(storedData)

      const conv2 = createMockConversation({ id: 'conv-2' })
      await saveConversation(conv2)

      const setCall = mockStorage.set.mock.calls[0]
      const savedJson = setCall[1]
      const sizeInBytes = new Blob([savedJson]).size

      expect(sizeInBytes).toBeGreaterThan(0)
      expect(sizeInBytes).toBeLessThan(90000)
    })

    it('should provide helpful error message on quota exceeded', async () => {
      mockStorage.get.mockResolvedValue(null)

      const veryLargeContent = 'x'.repeat(150000)
      const conversation = createMockConversation({
        messages: [
          {
            role: 'user',
            content: veryLargeContent,
            timestamp: Date.now(),
            id: 'msg-1'
          }
        ]
      })

      await expect(saveConversation(conversation)).rejects.toThrow(
        /Storage quota exceeded/
      )
    })

    it('should catch and re-throw Chrome storage quota errors', async () => {
      mockStorage.get.mockResolvedValue(null)
      mockStorage.set.mockRejectedValue(new Error('Resource::kQuotaBytesPerItem quota exceeded'))

      const conversation = createMockConversation()

      await expect(saveConversation(conversation)).rejects.toThrow(
        /Storage quota exceeded.*start a new conversation or delete old conversations/
      )
    })
  })
})
