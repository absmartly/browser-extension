import { renderHook, waitFor, act } from '@testing-library/react'
import { useSDKStatus } from '../useSDKStatus'
import * as sdkBridge from '~src/utils/sdk-bridge'

jest.mock('~src/utils/sdk-bridge')

describe('useSDKStatus', () => {
  let mockIsSDKAvailable: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()

    mockIsSDKAvailable = jest.fn()
    ;(sdkBridge.isSDKAvailable as jest.Mock) = mockIsSDKAvailable
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  describe('Initialization', () => {
    it('should start with checking state', () => {
      mockIsSDKAvailable.mockResolvedValue(false)

      const { result } = renderHook(() => useSDKStatus())

      expect(result.current.checking).toBe(true)
      expect(result.current.sdkDetected).toBe(false)
    })

    it('should detect SDK when available', async () => {
      mockIsSDKAvailable.mockResolvedValue(true)

      const { result } = renderHook(() => useSDKStatus())

      await waitFor(() => {
        expect(result.current.checking).toBe(false)
      })

      expect(result.current.sdkDetected).toBe(true)
      expect(mockIsSDKAvailable).toHaveBeenCalledTimes(1)
    })

    it('should report SDK not detected when unavailable', async () => {
      mockIsSDKAvailable.mockResolvedValue(false)

      const { result } = renderHook(() => useSDKStatus())

      await waitFor(() => {
        expect(result.current.checking).toBe(false)
      })

      expect(result.current.sdkDetected).toBe(false)
      expect(mockIsSDKAvailable).toHaveBeenCalledTimes(1)
    })
  })

  describe('Polling', () => {
    it('should poll SDK status every 5 seconds', async () => {
      mockIsSDKAvailable.mockResolvedValue(false)

      renderHook(() => useSDKStatus())

      await waitFor(() => {
        expect(mockIsSDKAvailable).toHaveBeenCalledTimes(1)
      })

      await act(async () => {
        jest.advanceTimersByTime(5000)
        await Promise.resolve()
      })

      await waitFor(() => {
        expect(mockIsSDKAvailable).toHaveBeenCalledTimes(2)
      })

      await act(async () => {
        jest.advanceTimersByTime(5000)
        await Promise.resolve()
      })

      await waitFor(() => {
        expect(mockIsSDKAvailable).toHaveBeenCalledTimes(3)
      })
    })

    it('should detect SDK after timeout', async () => {
      mockIsSDKAvailable.mockResolvedValue(false)

      const { result } = renderHook(() => useSDKStatus())

      await waitFor(() => {
        expect(result.current.sdkDetected).toBe(false)
      })

      mockIsSDKAvailable.mockResolvedValue(true)

      await act(async () => {
        jest.advanceTimersByTime(5000)
        await Promise.resolve()
      })

      await waitFor(() => {
        expect(result.current.sdkDetected).toBe(true)
      })

      expect(result.current.checking).toBe(false)
    })

    it('should not show checking state during interval checks', async () => {
      mockIsSDKAvailable.mockResolvedValue(false)

      const { result } = renderHook(() => useSDKStatus())

      await waitFor(() => {
        expect(result.current.checking).toBe(false)
      })

      await act(async () => {
        jest.advanceTimersByTime(5000)
        await Promise.resolve()
      })

      await waitFor(() => {
        expect(mockIsSDKAvailable).toHaveBeenCalledTimes(2)
      })

      expect(result.current.checking).toBe(false)
    })
  })

  describe('Plugin version mismatch detection', () => {
    it('should handle SDK availability changes', async () => {
      mockIsSDKAvailable.mockResolvedValue(true)

      const { result } = renderHook(() => useSDKStatus())

      await waitFor(() => {
        expect(result.current.sdkDetected).toBe(true)
      })

      mockIsSDKAvailable.mockResolvedValue(false)

      await act(async () => {
        jest.advanceTimersByTime(5000)
        await Promise.resolve()
      })

      await waitFor(() => {
        expect(result.current.sdkDetected).toBe(false)
      })
    })
  })

  describe('Multiple detection attempts', () => {
    it('should retry detection after failures', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      const unhandledRejectionHandler = jest.fn()
      process.on('unhandledRejection', unhandledRejectionHandler)

      mockIsSDKAvailable
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(true)

      const { result } = renderHook(() => useSDKStatus())

      await waitFor(() => {
        expect(mockIsSDKAvailable).toHaveBeenCalledTimes(1)
      })

      expect(result.current.checking).toBe(true)
      expect(result.current.sdkDetected).toBe(false)

      await act(async () => {
        jest.advanceTimersByTime(5000)
        await Promise.resolve()
      })

      await waitFor(() => {
        expect(result.current.sdkDetected).toBe(true)
      })

      await waitFor(() => {
        expect(result.current.checking).toBe(false)
      })

      expect(mockIsSDKAvailable).toHaveBeenCalledTimes(2)

      process.off('unhandledRejection', unhandledRejectionHandler)
      consoleErrorSpy.mockRestore()
    })

    it('should handle intermittent detection failures', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      const unhandledRejectionHandler = jest.fn()
      process.on('unhandledRejection', unhandledRejectionHandler)

      mockIsSDKAvailable
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValue(true)

      const { result } = renderHook(() => useSDKStatus())

      await waitFor(() => {
        expect(result.current.sdkDetected).toBe(true)
      })

      await act(async () => {
        jest.advanceTimersByTime(5000)
        await Promise.resolve()
      })

      expect(result.current.sdkDetected).toBe(true)

      await act(async () => {
        jest.advanceTimersByTime(5000)
        await Promise.resolve()
      })

      await waitFor(() => {
        expect(result.current.sdkDetected).toBe(true)
      })

      expect(mockIsSDKAvailable).toHaveBeenCalledTimes(3)

      process.off('unhandledRejection', unhandledRejectionHandler)
      consoleErrorSpy.mockRestore()
    })
  })

  describe('Cleanup of detection intervals', () => {
    it('should clear interval on unmount', async () => {
      mockIsSDKAvailable.mockResolvedValue(false)

      const { unmount } = renderHook(() => useSDKStatus())

      await waitFor(() => {
        expect(mockIsSDKAvailable).toHaveBeenCalledTimes(1)
      })

      unmount()

      await act(async () => {
        jest.advanceTimersByTime(10000)
        await Promise.resolve()
      })

      expect(mockIsSDKAvailable).toHaveBeenCalledTimes(1)
    })

    it('should not leak intervals when hook remounts', async () => {
      mockIsSDKAvailable.mockResolvedValue(false)

      const { unmount: unmount1 } = renderHook(() => useSDKStatus())

      await waitFor(() => {
        expect(mockIsSDKAvailable).toHaveBeenCalledTimes(1)
      })

      unmount1()

      const { unmount: unmount2 } = renderHook(() => useSDKStatus())

      await waitFor(() => {
        expect(mockIsSDKAvailable).toHaveBeenCalledTimes(2)
      })

      unmount2()

      await act(async () => {
        jest.advanceTimersByTime(10000)
        await Promise.resolve()
      })

      expect(mockIsSDKAvailable).toHaveBeenCalledTimes(2)
    })

    it('should handle cleanup when detection is in progress', async () => {
      let resolveDetection: (value: boolean) => void
      mockIsSDKAvailable.mockImplementation(
        () => new Promise((resolve) => { resolveDetection = resolve })
      )

      const { unmount } = renderHook(() => useSDKStatus())

      unmount()

      await act(async () => {
        resolveDetection(true)
      })

      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Concurrent checks', () => {
    it('should handle overlapping detection calls', async () => {
      let resolveCount = 0
      const resolvers: ((value: boolean) => void)[] = []

      mockIsSDKAvailable.mockImplementation(
        () => new Promise((resolve) => {
          resolvers.push(resolve)
          resolveCount++
        })
      )

      const { result } = renderHook(() => useSDKStatus())

      expect(result.current.checking).toBe(true)

      await act(async () => {
        jest.advanceTimersByTime(5000)
        await Promise.resolve()
      })

      await waitFor(() => {
        expect(resolveCount).toBe(2)
      })

      await act(async () => {
        resolvers[0](false)
      })

      await waitFor(() => {
        expect(result.current.checking).toBe(false)
      })

      await act(async () => {
        resolvers[1](true)
      })

      await waitFor(() => {
        expect(result.current.sdkDetected).toBe(true)
      })
    })
  })

  describe('Error handling', () => {
    it('should handle isSDKAvailable throwing synchronously', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      mockIsSDKAvailable.mockImplementation(() => {
        throw new Error('Sync error')
      })

      const { result } = renderHook(() => useSDKStatus())

      expect(result.current.checking).toBe(true)
      expect(result.current.sdkDetected).toBe(false)

      await waitFor(() => {
        expect(mockIsSDKAvailable).toHaveBeenCalled()
      })

      consoleErrorSpy.mockRestore()
    })

    it('should continue polling after errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      const unhandledRejectionHandler = jest.fn()
      process.on('unhandledRejection', unhandledRejectionHandler)

      mockIsSDKAvailable
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValue(true)

      const { result } = renderHook(() => useSDKStatus())

      await waitFor(() => {
        expect(mockIsSDKAvailable).toHaveBeenCalledTimes(1)
      })

      await act(async () => {
        jest.advanceTimersByTime(5000)
        await Promise.resolve()
      })

      await waitFor(() => {
        expect(mockIsSDKAvailable).toHaveBeenCalledTimes(2)
      })

      await waitFor(() => {
        expect(result.current.sdkDetected).toBe(true)
      })

      process.off('unhandledRejection', unhandledRejectionHandler)
      consoleErrorSpy.mockRestore()
    })
  })

  describe('State consistency', () => {
    it('should maintain consistent state across rapid SDK changes', async () => {
      mockIsSDKAvailable.mockResolvedValue(true)

      const { result } = renderHook(() => useSDKStatus())

      await waitFor(() => {
        expect(result.current.sdkDetected).toBe(true)
      })

      for (let i = 0; i < 5; i++) {
        const expectedValue = i % 2 === 0
        mockIsSDKAvailable.mockResolvedValue(expectedValue)

        await act(async () => {
          jest.advanceTimersByTime(5000)
          await Promise.resolve()
        })

        await waitFor(() => {
          expect(result.current.sdkDetected).toBe(expectedValue)
        })
      }
    })
  })
})
