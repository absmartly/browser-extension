/**
 * Logger Unit Tests
 */

import { Logger } from '../../utils/logger'

describe('Logger', () => {
  let consoleLogSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance
  let consoleWarnSpy: jest.SpyInstance

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
    Logger.setDebug(true) // Ensure debug is enabled for tests
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    consoleWarnSpy.mockRestore()
  })

  describe('log', () => {
    it('should log messages when debug is enabled', () => {
      Logger.log('test message')
      expect(consoleLogSpy).toHaveBeenCalledWith('[ABsmartly Extension]', 'test message')
    })

    it('should log multiple arguments', () => {
      Logger.log('test', 123, { foo: 'bar' })
      expect(consoleLogSpy).toHaveBeenCalledWith('[ABsmartly Extension]', 'test', 123, { foo: 'bar' })
    })

    it('should not log when debug is disabled', () => {
      Logger.setDebug(false)
      Logger.log('test message')
      expect(consoleLogSpy).not.toHaveBeenCalled()
    })
  })

  describe('error', () => {
    it('should log errors when debug is enabled', () => {
      Logger.error('error message')
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ABsmartly Extension]', 'error message')
    })

    it('should not log errors when debug is disabled', () => {
      Logger.setDebug(false)
      Logger.error('error message')
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })
  })

  describe('warn', () => {
    it('should log warnings when debug is enabled', () => {
      Logger.warn('warning message')
      expect(consoleWarnSpy).toHaveBeenCalledWith('[ABsmartly Extension]', 'warning message')
    })

    it('should not log warnings when debug is disabled', () => {
      Logger.setDebug(false)
      Logger.warn('warning message')
      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })
  })

  describe('setDebug', () => {
    it('should enable debug mode', () => {
      Logger.setDebug(true)
      expect(Logger.isDebugEnabled()).toBe(true)
    })

    it('should disable debug mode', () => {
      Logger.setDebug(false)
      expect(Logger.isDebugEnabled()).toBe(false)
    })
  })

  describe('isDebugEnabled', () => {
    it('should return debug state', () => {
      Logger.setDebug(true)
      expect(Logger.isDebugEnabled()).toBe(true)

      Logger.setDebug(false)
      expect(Logger.isDebugEnabled()).toBe(false)
    })
  })
})
