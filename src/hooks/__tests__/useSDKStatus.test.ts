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

  it('should start with checking state', () => {
    mockIsSDKAvailable.mockResolvedValue(false)

    const { result } = renderHook(() => useSDKStatus())

    expect(result.current.checking).toBe(true)
    expect(result.current.sdkDetected).toBe(false)
    expect(result.current.checked).toBe(false)
  })

  it('should detect SDK when available', async () => {
    mockIsSDKAvailable.mockResolvedValue(true)

    const { result } = renderHook(() => useSDKStatus())

    await waitFor(() => {
      expect(result.current.checking).toBe(false)
    })

    expect(result.current.sdkDetected).toBe(true)
    expect(result.current.checked).toBe(true)
    expect(mockIsSDKAvailable).toHaveBeenCalledTimes(1)
  })

  it('should report SDK not detected when unavailable', async () => {
    mockIsSDKAvailable.mockResolvedValue(false)

    const { result } = renderHook(() => useSDKStatus())

    await waitFor(() => {
      expect(result.current.checking).toBe(false)
    })

    expect(result.current.sdkDetected).toBe(false)
    expect(result.current.checked).toBe(true)
    expect(mockIsSDKAvailable).toHaveBeenCalledTimes(1)
  })

  it('should not poll after the initial check', async () => {
    mockIsSDKAvailable.mockResolvedValue(false)

    renderHook(() => useSDKStatus())

    await waitFor(() => {
      expect(mockIsSDKAvailable).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      jest.advanceTimersByTime(20000)
      await Promise.resolve()
    })

    expect(mockIsSDKAvailable).toHaveBeenCalledTimes(1)
  })

  it('should handle isSDKAvailable rejection', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

    mockIsSDKAvailable.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useSDKStatus())

    await waitFor(() => {
      expect(result.current.checking).toBe(false)
    })

    expect(result.current.sdkDetected).toBe(false)
    expect(result.current.checked).toBe(false)

    consoleErrorSpy.mockRestore()
  })

  it('should handle isSDKAvailable throwing synchronously', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

    mockIsSDKAvailable.mockImplementation(() => {
      throw new Error('Sync error')
    })

    const { result } = renderHook(() => useSDKStatus())

    await waitFor(() => {
      expect(mockIsSDKAvailable).toHaveBeenCalledTimes(1)
    })

    expect(result.current.checking).toBe(false)
    expect(result.current.sdkDetected).toBe(false)
    expect(result.current.checked).toBe(false)

    consoleErrorSpy.mockRestore()
  })

  it('should not error on unmount during an in-flight check', async () => {
    let resolveDetection: (value: boolean) => void
    mockIsSDKAvailable.mockImplementation(
      () => new Promise((resolve) => { resolveDetection = resolve })
    )

    const { unmount } = renderHook(() => useSDKStatus())

    unmount()

    await act(async () => {
      resolveDetection(false)
    })

    expect(() => unmount()).not.toThrow()
  })
})
