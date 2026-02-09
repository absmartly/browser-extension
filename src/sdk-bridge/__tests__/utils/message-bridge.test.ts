/**
 * Message Bridge Unit Tests
 */

import { MessageBridge } from '../../utils/message-bridge'
import { Logger } from '../../utils/logger'

jest.mock('../../utils/logger')

describe('MessageBridge', () => {
  let postMessageSpy: jest.SpyInstance

  beforeEach(() => {
    postMessageSpy = jest.spyOn(window, 'postMessage').mockImplementation()
  })

  afterEach(() => {
    postMessageSpy.mockRestore()
  })

  describe('sendToExtension', () => {
    it('should post message to window with same-origin', () => {
      const message = {
        source: 'absmartly-page' as const,
        type: 'SDK_CONTEXT_READY' as const,
        payload: { test: 'data' }
      }

      MessageBridge.sendToExtension(message)

      expect(postMessageSpy).toHaveBeenCalledWith(message, window.location.origin)
    })

    it('should log the message', () => {
      const message = {
        source: 'absmartly-page' as const,
        type: 'SDK_EVENT' as const,
        payload: {
          eventName: 'test-event',
          data: {},
          timestamp: new Date().toISOString()
        }
      }

      MessageBridge.sendToExtension(message)

      expect(Logger.log).toHaveBeenCalled()
    })
  })

  describe('onMessage', () => {
    it('should call handler for matching message type', () => {
      const handler = jest.fn()
      MessageBridge.onMessage('PREVIEW_CHANGES', handler)

      const event = new MessageEvent('message', {
        data: {
          source: 'absmartly-extension',
          type: 'PREVIEW_CHANGES',
          payload: { changes: [] }
        },
        origin: window.location.origin,
        source: window
      })

      window.dispatchEvent(event)

      expect(handler).toHaveBeenCalledWith({ changes: [] })
    })

    it('should not call handler for different message type', () => {
      const handler = jest.fn()
      MessageBridge.onMessage('PREVIEW_CHANGES', handler)

      const event = new MessageEvent('message', {
        data: {
          source: 'absmartly-extension',
          type: 'REMOVE_PREVIEW',
          payload: {}
        },
        origin: window.location.origin,
        source: window
      })

      window.dispatchEvent(event)

      expect(handler).not.toHaveBeenCalled()
    })

    it('should not call handler for messages from other sources', () => {
      const handler = jest.fn()
      MessageBridge.onMessage('PREVIEW_CHANGES', handler)

      const event = new MessageEvent('message', {
        data: {
          source: 'other-source',
          type: 'PREVIEW_CHANGES',
          payload: {}
        },
        origin: window.location.origin,
        source: window
      })

      window.dispatchEvent(event)

      expect(handler).not.toHaveBeenCalled()
    })

    it('should reject messages from invalid origin', () => {
      const handler = jest.fn()
      MessageBridge.onMessage('PREVIEW_CHANGES', handler)

      const event = new MessageEvent('message', {
        data: {
          source: 'absmartly-extension',
          type: 'PREVIEW_CHANGES',
          payload: { changes: [] }
        },
        origin: 'https://malicious-site.com',
        source: window
      })

      window.dispatchEvent(event)

      expect(handler).not.toHaveBeenCalled()
      expect(Logger.warn).toHaveBeenCalledWith(
        '[Security] Rejected message from invalid origin:',
        'https://malicious-site.com'
      )
    })
  })

  describe('onAnyMessage', () => {
    it('should call handler for any extension message', () => {
      const handler = jest.fn()
      MessageBridge.onAnyMessage(handler)

      const event1 = new MessageEvent('message', {
        data: {
          source: 'absmartly-extension',
          type: 'PREVIEW_CHANGES',
          payload: {}
        },
        origin: window.location.origin,
        source: window
      })

      const event2 = new MessageEvent('message', {
        data: {
          source: 'absmartly-extension',
          type: 'REMOVE_PREVIEW',
          payload: {}
        },
        origin: window.location.origin,
        source: window
      })

      window.dispatchEvent(event1)
      window.dispatchEvent(event2)

      expect(handler).toHaveBeenCalledTimes(2)
    })

    it('should not call handler for non-extension messages', () => {
      const handler = jest.fn()
      MessageBridge.onAnyMessage(handler)

      const event = new MessageEvent('message', {
        data: {
          source: 'other-source',
          type: 'SOME_TYPE',
          payload: {}
        },
        origin: window.location.origin,
        source: window
      })

      window.dispatchEvent(event)

      expect(handler).not.toHaveBeenCalled()
    })

    it('should reject messages from invalid origin', () => {
      const handler = jest.fn()
      MessageBridge.onAnyMessage(handler)

      const event = new MessageEvent('message', {
        data: {
          source: 'absmartly-extension',
          type: 'PREVIEW_CHANGES',
          payload: {}
        },
        origin: 'https://malicious-site.com',
        source: window
      })

      window.dispatchEvent(event)

      expect(handler).not.toHaveBeenCalled()
      expect(Logger.warn).toHaveBeenCalledWith(
        '[Security] Rejected message from invalid origin:',
        'https://malicious-site.com'
      )
    })
  })
})
