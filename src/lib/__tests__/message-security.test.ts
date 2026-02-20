import { validateMessageType, validateSender, validateFrameId, validateMessage } from '../message-security'

const mockExtensionId = 'test-extension-id'

global.chrome = {
  runtime: {
    id: mockExtensionId
  }
} as any

describe('Message Security', () => {
  describe('validateMessageType', () => {
    it('should accept valid message types', () => {
      const result = validateMessageType('PING')
      expect(result.valid).toBe(true)
    })

    it('should reject empty message type', () => {
      const result = validateMessageType('')
      expect(result.valid).toBe(false)
      expect(result.securityViolation).toBe(true)
    })

    it('should reject non-string message type', () => {
      const result = validateMessageType(123 as any)
      expect(result.valid).toBe(false)
      expect(result.securityViolation).toBe(true)
    })

    it('should reject unknown message types', () => {
      const result = validateMessageType('MALICIOUS_MESSAGE')
      expect(result.valid).toBe(false)
      expect(result.securityViolation).toBe(true)
      expect(result.error).toContain('Unknown message type')
    })
  })

  describe('validateSender', () => {
    const mockExtensionId = 'test-extension-id'


    it('should accept messages from same extension', () => {
      const sender = { id: mockExtensionId } as chrome.runtime.MessageSender
      const result = validateSender(sender, true)
      expect(result.valid).toBe(true)
    })

    it('should reject messages from different extension', () => {
      const sender = { id: 'different-extension' } as chrome.runtime.MessageSender
      const result = validateSender(sender, true)
      expect(result.valid).toBe(false)
      expect(result.securityViolation).toBe(true)
    })

    it('should accept messages from any extension when not required', () => {
      const sender = { id: 'different-extension' } as chrome.runtime.MessageSender
      const result = validateSender(sender, false)
      expect(result.valid).toBe(true)
    })

    it('should reject messages without sender', () => {
      const result = validateSender(null as any, true)
      expect(result.valid).toBe(false)
      expect(result.securityViolation).toBe(true)
    })
  })

  describe('validateFrameId', () => {
    it('should accept messages from main frame (frameId 0)', () => {
      const sender = { frameId: 0 } as chrome.runtime.MessageSender
      const result = validateFrameId(sender)
      expect(result.valid).toBe(true)
    })

    it('should reject messages from iframe (frameId > 0)', () => {
      const sender = { frameId: 1 } as chrome.runtime.MessageSender
      const result = validateFrameId(sender)
      expect(result.valid).toBe(false)
      expect(result.securityViolation).toBe(true)
    })

    it('should reject messages without frameId', () => {
      const sender = {} as chrome.runtime.MessageSender
      const result = validateFrameId(sender)
      expect(result.valid).toBe(false)
    })
  })

  describe('validateMessage (integration)', () => {
    const mockExtensionId = 'test-extension-id'


    it('should accept valid message from main frame of same extension', () => {
      const message = { type: 'PING' }
      const sender = { id: mockExtensionId, frameId: 0 } as chrome.runtime.MessageSender
      const result = validateMessage(message, sender)
      expect(result.valid).toBe(true)
    })

    it('should reject message with invalid type', () => {
      const message = { type: 'INVALID_TYPE' }
      const sender = { id: mockExtensionId, frameId: 0 } as chrome.runtime.MessageSender
      const result = validateMessage(message, sender)
      expect(result.valid).toBe(false)
      expect(result.securityViolation).toBe(true)
    })

    it('should reject message from different extension', () => {
      const message = { type: 'PING' }
      const sender = { id: 'other-extension', frameId: 0 } as chrome.runtime.MessageSender
      const result = validateMessage(message, sender)
      expect(result.valid).toBe(false)
      expect(result.securityViolation).toBe(true)
    })

    it('should reject message from iframe when requireMainFrame is true', () => {
      const message = { type: 'PING' }
      const sender = { id: mockExtensionId, frameId: 1 } as chrome.runtime.MessageSender
      const result = validateMessage(message, sender, { requireMainFrame: true })
      expect(result.valid).toBe(false)
      expect(result.securityViolation).toBe(true)
    })

    it('should accept message from iframe when requireMainFrame is false', () => {
      const message = { type: 'PING' }
      const sender = { id: mockExtensionId, frameId: 1 } as chrome.runtime.MessageSender
      const result = validateMessage(message, sender, { requireMainFrame: false })
      expect(result.valid).toBe(true)
    })
  })
})
