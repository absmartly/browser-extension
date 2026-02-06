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

      act(() => {
        jest.advanceTimersByTime(5000)
      })

      await waitFor(() => {
        expect(mockIsSDKAvailable).toHaveBeenCalledTimes(2)
      })

      act(() => {
        jest.advanceTimersByTime(5000)
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

      act(() => {
        jest.advanceTimersByTime(5000)
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

      act(() => {
        jest.advanceTimersByTime(5000)
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

      act(() => {
        jest.advanceTimersByTime(5000)
      })

      await waitFor(() => {
        expect(result.current.sdkDetected).toBe(false)
      })
    })
  })

  describe('Multiple detection attempts', () => {
    it('should retry detection after failures', async () => {
      mockIsSDKAvailable
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(true)

      const { result } = renderHook(() => useSDKStatus())

      await waitFor(() => {
        expect(mockIsSDKAvailable).toHaveBeenCalledTimes(1)
      })

      expect(result.current.sdkDetected).toBe(false)

      act(() => {
        jest.advanceTimersByTime(5000)
      })

      await waitFor(() => {
        expect(result.current.sdkDetected).toBe(true)
      })

      expect(mockIsSDKAvailable).toHaveBeenCalledTimes(2)
    })

    it('should handle intermittent detection failures', async () => {
      mockIsSDKAvailable
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValue(true)

      const { result } = renderHook(() => useSDKStatus())

      await waitFor(() => {
        expect(result.current.sdkDetected).toBe(true)
      })

      act(() => {
        jest.advanceTimersByTime(5000)
      })

      await waitFor(() => {
        expect(result.current.sdkDetected).toBe(false)
      })

      act(() => {
        jest.advanceTimersByTime(5000)
      })

      await waitFor(() => {
        expect(result.current.sdkDetected).toBe(true)
      })
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

      act(() => {
        jest.advanceTimersByTime(10000)
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

      act(() => {
        jest.advanceTimersByTime(10000)
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

      act(() => {
        jest.advanceTimersByTime(5000)
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
      mockIsSDKAvailable.mockImplementation(() => {
        throw new Error('Sync error')
      })

      const { result } = renderHook(() => useSDKStatus())

      await waitFor(() => {
        expect(result.current.checking).toBe(false)
      })

      expect(result.current.sdkDetected).toBe(false)
    })

    it('should continue polling after errors', async () => {
      mockIsSDKAvailable
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValue(true)

      renderHook(() => useSDKStatus())

      await waitFor(() => {
        expect(mockIsSDKAvailable).toHaveBeenCalledTimes(1)
      })

      act(() => {
        jest.advanceTimersByTime(5000)
      })

      await waitFor(() => {
        expect(mockIsSDKAvailable).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('State consistency', () => {
    it('should maintain consistent state across rapid SDK changes', async () => {
      const { result } = renderHook(() => useSDKStatus())

      mockIsSDKAvailable.mockResolvedValue(true)
      await waitFor(() => {
        expect(result.current.sdkDetected).toBe(true)
      })

      for (let i = 0; i < 5; i++) {
        mockIsSDKAvailable.mockResolvedValue(i % 2 === 0)
        act(() => {
          jest.advanceTimersByTime(5000)
        })
        await waitFor(() => {
          expect(result.current.sdkDetected).toBe(i % 2 === 0)
        })
      }
    })
  })
})
