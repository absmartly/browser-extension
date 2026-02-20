import { notifyUser, notifyError, notifyWarning, notifySuccess, notifyInfo } from '../notifications'

const mockSendMessage = jest.fn()

global.chrome = {
  runtime: {
    sendMessage: mockSendMessage
  }
} as any

describe('notifications utility', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSendMessage.mockResolvedValue(undefined)
  })

  describe('notifyUser', () => {
    it('should send SHOW_NOTIFICATION message with correct payload', async () => {
      await notifyUser('Test message', 'info')

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'SHOW_NOTIFICATION',
        payload: {
          message: 'Test message',
          type: 'info',
          action: undefined,
          duration: undefined
        }
      })
    })

    it('should send notification with action', async () => {
      const action = { label: 'Retry', onClick: jest.fn() }
      await notifyUser('Error message', 'error', action)

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'SHOW_NOTIFICATION',
        payload: {
          message: 'Error message',
          type: 'error',
          action,
          duration: undefined
        }
      })
    })

    it('should send notification with custom duration', async () => {
      await notifyUser('Custom duration', 'success', undefined, 3000)

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'SHOW_NOTIFICATION',
        payload: {
          message: 'Custom duration',
          type: 'success',
          action: undefined,
          duration: 3000
        }
      })
    })

    it('should catch and log error if sendMessage fails', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
      const error = new Error('Sidebar not open')
      mockSendMessage.mockRejectedValue(error)

      await notifyUser('Test message', 'info')

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Notifications] Failed to send notification (sidebar may not be open):',
        error
      )

      consoleWarnSpy.mockRestore()
    })

    it('should not throw error if sendMessage fails', async () => {
      jest.spyOn(console, 'warn').mockImplementation()
      mockSendMessage.mockRejectedValue(new Error('Sidebar not open'))

      await expect(notifyUser('Test message', 'info')).resolves.not.toThrow()
    })
  })

  describe('notifyError', () => {
    it('should send error notification', async () => {
      await notifyError('Error occurred')

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'SHOW_NOTIFICATION',
        payload: {
          message: 'Error occurred',
          type: 'error',
          action: undefined,
          duration: undefined
        }
      })
    })

    it('should send error notification with action', async () => {
      const action = { label: 'Retry', onClick: jest.fn() }
      await notifyError('Error occurred', action)

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'SHOW_NOTIFICATION',
        payload: {
          message: 'Error occurred',
          type: 'error',
          action,
          duration: undefined
        }
      })
    })
  })

  describe('notifyWarning', () => {
    it('should send warning notification', async () => {
      await notifyWarning('Warning message')

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'SHOW_NOTIFICATION',
        payload: {
          message: 'Warning message',
          type: 'warning',
          action: undefined,
          duration: undefined
        }
      })
    })
  })

  describe('notifySuccess', () => {
    it('should send success notification', async () => {
      await notifySuccess('Operation succeeded')

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'SHOW_NOTIFICATION',
        payload: {
          message: 'Operation succeeded',
          type: 'success',
          action: undefined,
          duration: undefined
        }
      })
    })
  })

  describe('notifyInfo', () => {
    it('should send info notification', async () => {
      await notifyInfo('Information message')

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'SHOW_NOTIFICATION',
        payload: {
          message: 'Information message',
          type: 'info',
          action: undefined,
          duration: undefined
        }
      })
    })
  })

  describe('all notification helpers', () => {
    it('should handle concurrent notifications', async () => {
      await Promise.all([
        notifyError('Error 1'),
        notifyWarning('Warning 1'),
        notifySuccess('Success 1'),
        notifyInfo('Info 1')
      ])

      expect(mockSendMessage).toHaveBeenCalledTimes(4)
    })

    it('should handle empty messages', async () => {
      await notifyInfo('')

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'SHOW_NOTIFICATION',
        payload: {
          message: '',
          type: 'info',
          action: undefined,
          duration: undefined
        }
      })
    })

    it('should handle very long messages', async () => {
      const longMessage = 'A'.repeat(1000)
      await notifyInfo(longMessage)

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'SHOW_NOTIFICATION',
        payload: {
          message: longMessage,
          type: 'info',
          action: undefined,
          duration: undefined
        }
      })
    })

    it('should handle messages with newlines', async () => {
      const multilineMessage = 'Line 1\nLine 2\nLine 3'
      await notifyWarning(multilineMessage)

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'SHOW_NOTIFICATION',
        payload: {
          message: multilineMessage,
          type: 'warning',
          action: undefined,
          duration: undefined
        }
      })
    })
  })
})
