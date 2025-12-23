/**
 * Rate Limiter Utility
 *
 * Prevents abuse of the message system by rate limiting requests from senders
 * Uses sliding window algorithm to track request counts
 *
 * @module RateLimiter
 */

import { debugWarn, debugLog } from '~src/utils/debug'

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60000
}

const requestTimestamps = new Map<string, number[]>()

let violationCount = new Map<string, number>()

const VIOLATION_THRESHOLD = 5
const VIOLATION_BLOCK_MS = 300000

/**
 * Checks if a sender has exceeded the rate limit
 *
 * @param senderId - Unique identifier for the sender (e.g., tab ID or extension ID)
 * @param config - Optional rate limit configuration
 * @returns true if request is allowed, false if rate limit exceeded
 */
export function checkRateLimit(
  senderId: string,
  config: Partial<RateLimitConfig> = {}
): boolean {
  const { maxRequests, windowMs } = { ...DEFAULT_CONFIG, ...config }

  const now = Date.now()
  const senderKey = `sender:${senderId}`

  const times = requestTimestamps.get(senderKey) || []

  const recentTimes = times.filter(timestamp => now - timestamp < windowMs)

  if (recentTimes.length >= maxRequests) {
    const violations = violationCount.get(senderKey) || 0
    violationCount.set(senderKey, violations + 1)

    debugWarn(
      `[RateLimiter] Rate limit exceeded for ${senderId}: ${recentTimes.length}/${maxRequests} requests in ${windowMs}ms window (violation #${violations + 1})`
    )

    if (violations + 1 >= VIOLATION_THRESHOLD) {
      const blockUntil = now + VIOLATION_BLOCK_MS
      debugWarn(
        `[RateLimiter] BLOCKED ${senderId} for ${VIOLATION_BLOCK_MS}ms after ${VIOLATION_THRESHOLD} violations`
      )
      requestTimestamps.set(senderKey, [blockUntil])
      return false
    }

    return false
  }

  recentTimes.push(now)
  requestTimestamps.set(senderKey, recentTimes)

  if (recentTimes.length % 50 === 0 && recentTimes.length > 0) {
    debugLog(
      `[RateLimiter] ${senderId}: ${recentTimes.length}/${maxRequests} requests in window`
    )
  }

  return true
}

/**
 * Resets rate limit tracking for a specific sender
 *
 * @param senderId - Sender identifier to reset
 */
export function resetRateLimit(senderId: string): void {
  const senderKey = `sender:${senderId}`
  requestTimestamps.delete(senderKey)
  violationCount.delete(senderKey)
  debugLog(`[RateLimiter] Reset rate limit for ${senderId}`)
}

/**
 * Clears all rate limit tracking data
 * Useful for cleanup or testing
 */
export function clearAllRateLimits(): void {
  requestTimestamps.clear()
  violationCount.clear()
  debugLog('[RateLimiter] Cleared all rate limit data')
}

/**
 * Gets current statistics for a sender
 *
 * @param senderId - Sender identifier
 * @returns Statistics object with request count and window info
 */
export function getRateLimitStats(senderId: string): {
  requestCount: number
  violations: number
  isBlocked: boolean
} {
  const senderKey = `sender:${senderId}`
  const times = requestTimestamps.get(senderKey) || []
  const now = Date.now()

  if (times.length === 1 && times[0] > now) {
    return {
      requestCount: 0,
      violations: violationCount.get(senderKey) || 0,
      isBlocked: true
    }
  }

  const recentTimes = times.filter(
    timestamp => now - timestamp < DEFAULT_CONFIG.windowMs
  )

  return {
    requestCount: recentTimes.length,
    violations: violationCount.get(senderKey) || 0,
    isBlocked: false
  }
}

/**
 * Periodic cleanup function to remove old tracking data
 * Should be called periodically (e.g., every 5 minutes)
 */
export function cleanupOldEntries(): void {
  const now = Date.now()
  let cleaned = 0

  for (const [key, times] of requestTimestamps.entries()) {
    const recentTimes = times.filter(
      timestamp => now - timestamp < DEFAULT_CONFIG.windowMs * 2
    )

    if (recentTimes.length === 0) {
      requestTimestamps.delete(key)
      violationCount.delete(key)
      cleaned++
    } else if (recentTimes.length < times.length) {
      requestTimestamps.set(key, recentTimes)
    }
  }

  if (cleaned > 0) {
    debugLog(`[RateLimiter] Cleaned up ${cleaned} expired entries`)
  }
}

setInterval(cleanupOldEntries, 300000)
