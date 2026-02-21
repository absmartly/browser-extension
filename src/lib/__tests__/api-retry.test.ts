jest.mock('~src/utils/debug', () => ({
  debugLog: jest.fn(),
  debugWarn: jest.fn(),
  debugError: jest.fn(),
}))

import {
  withRetry,
  withRateLimitRetry,
  withNetworkRetry,
  createRetryableRequest,
} from '../api-retry'
import type { RetryConfig } from '../api-retry'

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(Math, 'random').mockReturnValue(0)
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

function flushRetryDelay() {
  return jest.advanceTimersByTimeAsync(30000)
}

describe('withRetry', () => {
  it('returns value on first success', async () => {
    const op = jest.fn().mockResolvedValue('ok')

    const result = await withRetry(op)

    expect(result).toBe('ok')
    expect(op).toHaveBeenCalledTimes(1)
  })

  it('retries on retryable status code and succeeds', async () => {
    const op = jest
      .fn()
      .mockRejectedValueOnce({ response: { status: 500 }, message: 'server error' })
      .mockResolvedValue('recovered')

    const promise = withRetry(op)
    await flushRetryDelay()
    const result = await promise

    expect(result).toBe('recovered')
    expect(op).toHaveBeenCalledTimes(2)
  })

  it('retries on 503 status code', async () => {
    const op = jest
      .fn()
      .mockRejectedValueOnce({ response: { status: 503 }, message: 'unavailable' })
      .mockResolvedValue('ok')

    const promise = withRetry(op)
    await flushRetryDelay()
    const result = await promise

    expect(result).toBe('ok')
    expect(op).toHaveBeenCalledTimes(2)
  })

  it('does not retry on 401', async () => {
    const error = { response: { status: 401 }, message: 'unauthorized' }
    const op = jest.fn().mockRejectedValue(error)

    await expect(withRetry(op)).rejects.toBe(error)
    expect(op).toHaveBeenCalledTimes(1)
  })

  it('does not retry on 403', async () => {
    const error = { response: { status: 403 }, message: 'forbidden' }
    const op = jest.fn().mockRejectedValue(error)

    await expect(withRetry(op)).rejects.toBe(error)
    expect(op).toHaveBeenCalledTimes(1)
  })

  it('exhausts max retries then throws', async () => {
    const error = { response: { status: 500 }, message: 'server error' }
    const op = jest.fn().mockRejectedValue(error)

    const promise = withRetry(op, { maxRetries: 2 }).catch((e) => e)

    await flushRetryDelay()
    await flushRetryDelay()

    const result = await promise
    expect(result).toBe(error)
    expect(op).toHaveBeenCalledTimes(3)
  })

  it('respects custom shouldRetry returning true', async () => {
    const customError = { code: 'CUSTOM_ERROR', message: 'custom' }
    const op = jest
      .fn()
      .mockRejectedValueOnce(customError)
      .mockResolvedValue('ok')

    const promise = withRetry(op, {
      shouldRetry: () => true,
    })
    await flushRetryDelay()
    const result = await promise

    expect(result).toBe('ok')
    expect(op).toHaveBeenCalledTimes(2)
  })

  it('respects custom shouldRetry returning false', async () => {
    const error = { response: { status: 500 }, message: 'server error' }
    const op = jest.fn().mockRejectedValue(error)

    await expect(
      withRetry(op, {
        shouldRetry: () => false,
      })
    ).rejects.toBe(error)

    expect(op).toHaveBeenCalledTimes(1)
  })

  it('retries on error with matching code (ECONNRESET)', async () => {
    const op = jest
      .fn()
      .mockRejectedValueOnce({ code: 'ECONNRESET', message: 'connection reset' })
      .mockResolvedValue('ok')

    const promise = withRetry(op)
    await flushRetryDelay()
    const result = await promise

    expect(result).toBe('ok')
    expect(op).toHaveBeenCalledTimes(2)
  })

  it('retries on error with matching code (ETIMEDOUT)', async () => {
    const op = jest
      .fn()
      .mockRejectedValueOnce({ code: 'ETIMEDOUT', message: 'timed out' })
      .mockResolvedValue('ok')

    const promise = withRetry(op)
    await flushRetryDelay()
    const result = await promise

    expect(result).toBe('ok')
    expect(op).toHaveBeenCalledTimes(2)
  })

  it('retries on error message containing "timeout"', async () => {
    const op = jest
      .fn()
      .mockRejectedValueOnce({ message: 'request timeout' })
      .mockResolvedValue('ok')

    const promise = withRetry(op)
    await flushRetryDelay()
    const result = await promise

    expect(result).toBe('ok')
    expect(op).toHaveBeenCalledTimes(2)
  })

  it('retries on error message containing "network"', async () => {
    const op = jest
      .fn()
      .mockRejectedValueOnce({ message: 'network error' })
      .mockResolvedValue('ok')

    const promise = withRetry(op)
    await flushRetryDelay()
    const result = await promise

    expect(result).toBe('ok')
    expect(op).toHaveBeenCalledTimes(2)
  })

  it('applies exponential backoff with jitter', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5)

    const op = jest
      .fn()
      .mockRejectedValueOnce({ response: { status: 500 }, message: 'error' })
      .mockRejectedValueOnce({ response: { status: 500 }, message: 'error' })
      .mockResolvedValue('ok')

    const promise = withRetry(op, { maxRetries: 3, baseDelay: 1000, maxDelay: 10000 })

    const expectedDelay0 = 1000 + 1000 * 0.3 * 0.5
    await jest.advanceTimersByTimeAsync(expectedDelay0)

    const expectedDelay1 = 2000 + 1000 * 0.3 * 0.5
    await jest.advanceTimersByTimeAsync(expectedDelay1)

    const result = await promise
    expect(result).toBe('ok')
    expect(op).toHaveBeenCalledTimes(3)
  })

  it('caps delay at maxDelay', async () => {
    const op = jest
      .fn()
      .mockRejectedValueOnce({ response: { status: 500 }, message: 'err' })
      .mockRejectedValueOnce({ response: { status: 500 }, message: 'err' })
      .mockRejectedValueOnce({ response: { status: 500 }, message: 'err' })
      .mockResolvedValue('ok')

    const promise = withRetry(op, { maxRetries: 4, baseDelay: 1000, maxDelay: 3000 })
    await flushRetryDelay()
    await flushRetryDelay()
    await flushRetryDelay()

    const result = await promise
    expect(result).toBe('ok')
    expect(op).toHaveBeenCalledTimes(4)
  })
})

describe('withRateLimitRetry', () => {
  it('retries on 429 status', async () => {
    const op = jest
      .fn()
      .mockRejectedValueOnce({ response: { status: 429 }, message: 'rate limited' })
      .mockResolvedValue('ok')

    const promise = withRateLimitRetry(op)
    await flushRetryDelay()
    const result = await promise

    expect(result).toBe('ok')
    expect(op).toHaveBeenCalledTimes(2)
  })

  it('does not retry on non-429 errors', async () => {
    const error = { response: { status: 500 }, message: 'server error' }
    const op = jest.fn().mockRejectedValue(error)

    await expect(withRateLimitRetry(op)).rejects.toBe(error)
    expect(op).toHaveBeenCalledTimes(1)
  })

  it('handles retry-after header', async () => {
    const op = jest
      .fn()
      .mockRejectedValueOnce({
        response: { status: 429, headers: { 'retry-after': '5' } },
        message: 'rate limited',
      })
      .mockResolvedValue('ok')

    const promise = withRateLimitRetry(op)
    await flushRetryDelay()
    const result = await promise

    expect(result).toBe('ok')
  })

  it('respects custom maxRetries', async () => {
    const error = { response: { status: 429 }, message: 'rate limited' }
    const op = jest.fn().mockRejectedValue(error)

    const promise = withRateLimitRetry(op, 1).catch((e) => e)
    await flushRetryDelay()

    const result = await promise
    expect(result).toBe(error)
    expect(op).toHaveBeenCalledTimes(2)
  })
})

describe('withNetworkRetry', () => {
  it('retries on ECONNRESET', async () => {
    const op = jest
      .fn()
      .mockRejectedValueOnce({ code: 'ECONNRESET', message: 'reset' })
      .mockResolvedValue('ok')

    const promise = withNetworkRetry(op)
    await flushRetryDelay()
    const result = await promise

    expect(result).toBe('ok')
    expect(op).toHaveBeenCalledTimes(2)
  })

  it('retries on ETIMEDOUT', async () => {
    const op = jest
      .fn()
      .mockRejectedValueOnce({ code: 'ETIMEDOUT', message: 'timed out' })
      .mockResolvedValue('ok')

    const promise = withNetworkRetry(op)
    await flushRetryDelay()
    const result = await promise

    expect(result).toBe('ok')
    expect(op).toHaveBeenCalledTimes(2)
  })

  it('retries on 502 status', async () => {
    const op = jest
      .fn()
      .mockRejectedValueOnce({ response: { status: 502 }, message: 'bad gateway' })
      .mockResolvedValue('ok')

    const promise = withNetworkRetry(op)
    await flushRetryDelay()
    const result = await promise

    expect(result).toBe('ok')
    expect(op).toHaveBeenCalledTimes(2)
  })

  it('does not retry on 401', async () => {
    const error = { response: { status: 401 }, message: 'unauthorized' }
    const op = jest.fn().mockRejectedValue(error)

    await expect(withNetworkRetry(op)).rejects.toBe(error)
    expect(op).toHaveBeenCalledTimes(1)
  })

  it('respects custom maxRetries', async () => {
    const error = { code: 'ECONNRESET', message: 'reset' }
    const op = jest.fn().mockRejectedValue(error)

    const promise = withNetworkRetry(op, 1).catch((e) => e)
    await flushRetryDelay()

    const result = await promise
    expect(result).toBe(error)
    expect(op).toHaveBeenCalledTimes(2)
  })
})

describe('createRetryableRequest', () => {
  it('succeeds on first attempt', async () => {
    const op = jest.fn().mockResolvedValue('data')

    const result = await createRetryableRequest(op, { operationName: 'test' })

    expect(result).toBe('data')
    expect(op).toHaveBeenCalledTimes(1)
  })

  it('retries on retryable error and calls onRetry callback', async () => {
    const onRetry = jest.fn()
    const op = jest
      .fn()
      .mockRejectedValueOnce({ response: { status: 500 }, message: 'error' })
      .mockResolvedValue('data')

    const promise = createRetryableRequest(op, {
      operationName: 'fetchData',
      onRetry,
    })
    await flushRetryDelay()
    const result = await promise

    expect(result).toBe('data')
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledWith(1, expect.objectContaining({ message: 'error' }))
  })

  it('does not retry non-retryable errors', async () => {
    const onRetry = jest.fn()
    const error = { response: { status: 403 }, message: 'forbidden' }
    const op = jest.fn().mockRejectedValue(error)

    await expect(
      createRetryableRequest(op, { operationName: 'test', onRetry })
    ).rejects.toBe(error)

    expect(onRetry).not.toHaveBeenCalled()
  })

  it('respects custom maxRetries', async () => {
    const error = { response: { status: 500 }, message: 'error' }
    const op = jest.fn().mockRejectedValue(error)

    const promise = createRetryableRequest(op, {
      operationName: 'test',
      maxRetries: 1,
    }).catch((e) => e)
    await flushRetryDelay()

    const result = await promise
    expect(result).toBe(error)
    expect(op).toHaveBeenCalledTimes(2)
  })

  it('calls onRetry for each retry attempt', async () => {
    const onRetry = jest.fn()
    const error = { response: { status: 500 }, message: 'error' }
    const op = jest
      .fn()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValue('ok')

    const promise = createRetryableRequest(op, {
      operationName: 'multi',
      maxRetries: 3,
      onRetry,
    })
    await flushRetryDelay()
    await flushRetryDelay()
    const result = await promise

    expect(result).toBe('ok')
    expect(onRetry).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenCalledWith(1, error)
    expect(onRetry).toHaveBeenCalledWith(2, error)
  })
})
