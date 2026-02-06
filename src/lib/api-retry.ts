import { debugLog, debugWarn, debugError } from '~src/utils/debug'

export interface RetryConfig {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  retryableStatusCodes?: number[]
  retryableErrors?: string[]
  shouldRetry?: (error: any, attempt: number) => boolean
}

const DEFAULT_CONFIG: Required<Omit<RetryConfig, 'shouldRetry'>> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH']
}

function isRetryableError(error: any, config: RetryConfig): boolean {
  const statusCodes = config.retryableStatusCodes || DEFAULT_CONFIG.retryableStatusCodes
  const errorCodes = config.retryableErrors || DEFAULT_CONFIG.retryableErrors

  if (error.response?.status && statusCodes.includes(error.response.status)) {
    return true
  }

  if (error.code && errorCodes.includes(error.code)) {
    return true
  }

  if (error.message?.includes('timeout') || error.message?.includes('network')) {
    return true
  }

  return false
}

function calculateDelay(attempt: number, config: RetryConfig): number {
  const baseDelay = config.baseDelay || DEFAULT_CONFIG.baseDelay
  const maxDelay = config.maxDelay || DEFAULT_CONFIG.maxDelay

  const exponentialDelay = baseDelay * Math.pow(2, attempt)

  const jitter = Math.random() * baseDelay * 0.3

  return Math.min(exponentialDelay + jitter, maxDelay)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const maxRetries = config.maxRetries ?? DEFAULT_CONFIG.maxRetries
  let lastError: any

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      if (attempt === maxRetries) {
        debugError('[Retry] Max retries reached, giving up', { error, attempts: attempt + 1 })
        throw error
      }

      const shouldRetryCustom = config.shouldRetry?.(error, attempt)
      const shouldRetryDefault = isRetryableError(error, config)

      if (shouldRetryCustom === false || (!shouldRetryCustom && !shouldRetryDefault)) {
        debugLog('[Retry] Error not retryable, giving up', { error, attempt })
        throw error
      }

      const delay = calculateDelay(attempt, config)
      const statusCode = (error as any).response?.status
      const errorCode = (error as any).code
      const errorMessage = (error as any).message

      debugWarn('[Retry] Operation failed, retrying...', {
        attempt: attempt + 1,
        maxRetries,
        delayMs: delay,
        statusCode,
        errorCode,
        errorMessage
      })

      await sleep(delay)
    }
  }

  throw lastError
}

export function withRateLimitRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 5
): Promise<T> {
  return withRetry(operation, {
    maxRetries,
    baseDelay: 2000,
    maxDelay: 30000,
    retryableStatusCodes: [429],
    shouldRetry: (error, attempt) => {
      if (error.response?.status === 429) {
        const retryAfter = error.response?.headers?.[' retry-after']
        if (retryAfter) {
          const retryAfterMs = parseInt(retryAfter) * 1000
          debugLog('[Retry] Rate limited, retry-after header:', retryAfterMs)
        }
        return true
      }
      return false
    }
  })
}

export function withNetworkRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  return withRetry(operation, {
    maxRetries,
    baseDelay: 1000,
    maxDelay: 5000,
    retryableStatusCodes: [408, 500, 502, 503, 504],
    retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH']
  })
}

export function createRetryableRequest<T>(
  requestFn: () => Promise<T>,
  options: {
    operationName: string
    maxRetries?: number
    onRetry?: (attempt: number, error: any) => void
  }
): Promise<T> {
  const { operationName, maxRetries = 3, onRetry } = options

  return withRetry(requestFn, {
    maxRetries,
    baseDelay: 1000,
    maxDelay: 10000,
    shouldRetry: (error, attempt) => {
      const shouldRetry = isRetryableError(error, DEFAULT_CONFIG)

      if (shouldRetry && onRetry) {
        onRetry(attempt + 1, error)
      }

      debugLog(`[Retry] ${operationName} - Attempt ${attempt + 1}/${maxRetries}`, {
        shouldRetry,
        error: error.message,
        statusCode: error.response?.status
      })

      return shouldRetry
    }
  })
}
