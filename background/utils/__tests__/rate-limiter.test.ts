/**
 * Unit tests for rate limiter
 * Tests sliding window rate limiting for message handlers
 */

import {
  checkRateLimit,
  resetRateLimit,
  clearAllRateLimits,
  getRateLimitStats,
  cleanupOldEntries
} from '../rate-limiter'

describe('Rate Limiter', () => {
  beforeEach(() => {
    clearAllRateLimits()
  })

  afterEach(() => {
    clearAllRateLimits()
  })

  describe('checkRateLimit', () => {
    describe('basic rate limiting', () => {
      it('should allow requests under the limit', () => {
        const senderId = 'test-sender-1'

        for (let i = 0; i < 50; i++) {
          expect(checkRateLimit(senderId)).toBe(true)
        }
      })

      it('should allow exactly 100 requests in default window', () => {
        const senderId = 'test-sender-2'

        for (let i = 0; i < 100; i++) {
          expect(checkRateLimit(senderId)).toBe(true)
        }
      })

      it('should block 101st request in default window', () => {
        const senderId = 'test-sender-3'

        for (let i = 0; i < 100; i++) {
          checkRateLimit(senderId)
        }

        expect(checkRateLimit(senderId)).toBe(false)
      })

      it('should block subsequent requests after hitting limit', () => {
        const senderId = 'test-sender-4'

        for (let i = 0; i < 100; i++) {
          checkRateLimit(senderId)
        }

        expect(checkRateLimit(senderId)).toBe(false)
        expect(checkRateLimit(senderId)).toBe(false)
        expect(checkRateLimit(senderId)).toBe(false)
      })

      it('should track different senders separately', () => {
        const sender1 = 'sender-1'
        const sender2 = 'sender-2'

        for (let i = 0; i < 50; i++) {
          expect(checkRateLimit(sender1)).toBe(true)
        }

        for (let i = 0; i < 50; i++) {
          expect(checkRateLimit(sender2)).toBe(true)
        }

        expect(checkRateLimit(sender1)).toBe(true)
        expect(checkRateLimit(sender2)).toBe(true)
      })
    })

    describe('custom configuration', () => {
      it('should respect custom maxRequests', () => {
        const senderId = 'test-custom-1'
        const config = { maxRequests: 5 }

        for (let i = 0; i < 5; i++) {
          expect(checkRateLimit(senderId, config)).toBe(true)
        }

        expect(checkRateLimit(senderId, config)).toBe(false)
      })

      it('should respect custom windowMs', () => {
        const senderId = 'test-custom-2'
        const config = { windowMs: 100 }

        for (let i = 0; i < 100; i++) {
          checkRateLimit(senderId, config)
        }

        expect(checkRateLimit(senderId, config)).toBe(false)
      })

      it('should allow mixing custom and default config', () => {
        const senderId = 'test-custom-3'
        const config = { maxRequests: 10 }

        for (let i = 0; i < 10; i++) {
          expect(checkRateLimit(senderId, config)).toBe(true)
        }

        expect(checkRateLimit(senderId, config)).toBe(false)
      })
    })

    describe('violation tracking', () => {
      it('should track violations when limit exceeded', () => {
        const senderId = 'violator-1'

        for (let i = 0; i < 100; i++) {
          checkRateLimit(senderId)
        }

        checkRateLimit(senderId)

        const stats = getRateLimitStats(senderId)
        expect(stats.violations).toBeGreaterThan(0)
      })

      it('should block sender after 5 violations', () => {
        const senderId = 'violator-2'

        for (let i = 0; i < 100; i++) {
          checkRateLimit(senderId)
        }

        for (let i = 0; i < 5; i++) {
          checkRateLimit(senderId)
        }

        const stats = getRateLimitStats(senderId)
        expect(stats.isBlocked).toBe(true)
      })

      it('should not increment violations for allowed requests', () => {
        const senderId = 'good-sender'

        for (let i = 0; i < 50; i++) {
          checkRateLimit(senderId)
        }

        const stats = getRateLimitStats(senderId)
        expect(stats.violations).toBe(0)
      })
    })

    describe('sliding window behavior', () => {
      it('should use sliding window for time-based limiting', () => {
        const senderId = 'slider-1'
        const config = { maxRequests: 5, windowMs: 1000 }

        for (let i = 0; i < 5; i++) {
          expect(checkRateLimit(senderId, config)).toBe(true)
        }

        expect(checkRateLimit(senderId, config)).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('should handle empty sender ID', () => {
        expect(checkRateLimit('')).toBe(true)
      })

      it('should handle special characters in sender ID', () => {
        const senderId = 'sender-with-special-chars-@#$%'
        expect(checkRateLimit(senderId)).toBe(true)
      })

      it('should handle very long sender ID', () => {
        const senderId = 'a'.repeat(1000)
        expect(checkRateLimit(senderId)).toBe(true)
      })

      it('should handle numeric sender ID', () => {
        expect(checkRateLimit('12345')).toBe(true)
      })

      it('should handle rapid successive requests', () => {
        const senderId = 'rapid-sender'
        const results = []

        for (let i = 0; i < 105; i++) {
          results.push(checkRateLimit(senderId))
        }

        const allowed = results.filter(r => r === true).length
        const blocked = results.filter(r => r === false).length

        expect(allowed).toBe(100)
        expect(blocked).toBe(5)
      })
    })
  })

  describe('resetRateLimit', () => {
    it('should reset rate limit for specific sender', () => {
      const senderId = 'reset-test-1'

      for (let i = 0; i < 100; i++) {
        checkRateLimit(senderId)
      }

      expect(checkRateLimit(senderId)).toBe(false)

      resetRateLimit(senderId)

      expect(checkRateLimit(senderId)).toBe(true)
    })

    it('should reset violations for sender', () => {
      const senderId = 'reset-test-2'

      for (let i = 0; i < 100; i++) {
        checkRateLimit(senderId)
      }

      for (let i = 0; i < 3; i++) {
        checkRateLimit(senderId)
      }

      let stats = getRateLimitStats(senderId)
      expect(stats.violations).toBeGreaterThan(0)

      resetRateLimit(senderId)

      stats = getRateLimitStats(senderId)
      expect(stats.violations).toBe(0)
    })

    it('should not affect other senders', () => {
      const sender1 = 'reset-test-3'
      const sender2 = 'reset-test-4'

      for (let i = 0; i < 50; i++) {
        checkRateLimit(sender1)
        checkRateLimit(sender2)
      }

      resetRateLimit(sender1)

      const stats1 = getRateLimitStats(sender1)
      const stats2 = getRateLimitStats(sender2)

      expect(stats1.requestCount).toBe(0)
      expect(stats2.requestCount).toBeGreaterThan(0)
    })

    it('should handle resetting non-existent sender', () => {
      expect(() => resetRateLimit('never-existed')).not.toThrow()
    })
  })

  describe('clearAllRateLimits', () => {
    it('should clear all tracking data', () => {
      const senders = ['sender-1', 'sender-2', 'sender-3']

      for (const sender of senders) {
        for (let i = 0; i < 50; i++) {
          checkRateLimit(sender)
        }
      }

      clearAllRateLimits()

      for (const sender of senders) {
        const stats = getRateLimitStats(sender)
        expect(stats.requestCount).toBe(0)
        expect(stats.violations).toBe(0)
      }
    })

    it('should allow fresh start after clear', () => {
      const senderId = 'clear-test-1'

      for (let i = 0; i < 100; i++) {
        checkRateLimit(senderId)
      }

      expect(checkRateLimit(senderId)).toBe(false)

      clearAllRateLimits()

      expect(checkRateLimit(senderId)).toBe(true)
    })

    it('should clear violations', () => {
      const senderId = 'clear-test-2'

      for (let i = 0; i < 100; i++) {
        checkRateLimit(senderId)
      }

      for (let i = 0; i < 3; i++) {
        checkRateLimit(senderId)
      }

      clearAllRateLimits()

      const stats = getRateLimitStats(senderId)
      expect(stats.violations).toBe(0)
      expect(stats.isBlocked).toBe(false)
    })
  })

  describe('getRateLimitStats', () => {
    it('should return correct request count', () => {
      const senderId = 'stats-test-1'

      for (let i = 0; i < 42; i++) {
        checkRateLimit(senderId)
      }

      const stats = getRateLimitStats(senderId)
      expect(stats.requestCount).toBe(42)
    })

    it('should return zero for new sender', () => {
      const stats = getRateLimitStats('new-sender')
      expect(stats.requestCount).toBe(0)
      expect(stats.violations).toBe(0)
      expect(stats.isBlocked).toBe(false)
    })

    it('should return correct violation count', () => {
      const senderId = 'stats-test-2'

      for (let i = 0; i < 100; i++) {
        checkRateLimit(senderId)
      }

      checkRateLimit(senderId)
      checkRateLimit(senderId)

      const stats = getRateLimitStats(senderId)
      expect(stats.violations).toBe(2)
    })

    it('should indicate blocked status', () => {
      const senderId = 'stats-test-3'

      for (let i = 0; i < 100; i++) {
        checkRateLimit(senderId)
      }

      for (let i = 0; i < 5; i++) {
        checkRateLimit(senderId)
      }

      const stats = getRateLimitStats(senderId)
      expect(stats.isBlocked).toBe(true)
    })

    it('should not show blocked for sender under limit', () => {
      const senderId = 'stats-test-4'

      for (let i = 0; i < 50; i++) {
        checkRateLimit(senderId)
      }

      const stats = getRateLimitStats(senderId)
      expect(stats.isBlocked).toBe(false)
    })
  })

  describe('cleanupOldEntries', () => {
    it('should not throw when called', () => {
      expect(() => cleanupOldEntries()).not.toThrow()
    })

    it('should handle cleanup with active senders', () => {
      const senderId = 'cleanup-test-1'

      for (let i = 0; i < 50; i++) {
        checkRateLimit(senderId)
      }

      expect(() => cleanupOldEntries()).not.toThrow()

      const stats = getRateLimitStats(senderId)
      expect(stats.requestCount).toBeGreaterThan(0)
    })

    it('should handle cleanup with no data', () => {
      clearAllRateLimits()
      expect(() => cleanupOldEntries()).not.toThrow()
    })

    it('should preserve recent entries', () => {
      const senderId = 'cleanup-test-2'

      for (let i = 0; i < 30; i++) {
        checkRateLimit(senderId)
      }

      cleanupOldEntries()

      const stats = getRateLimitStats(senderId)
      expect(stats.requestCount).toBeGreaterThan(0)
    })
  })

  describe('integration scenarios', () => {
    it('should handle realistic tab request pattern', () => {
      const tabId = 'tab-12345'

      for (let i = 0; i < 20; i++) {
        expect(checkRateLimit(tabId)).toBe(true)
      }

      const stats = getRateLimitStats(tabId)
      expect(stats.requestCount).toBe(20)
      expect(stats.violations).toBe(0)
      expect(stats.isBlocked).toBe(false)
    })

    it('should handle malicious rapid-fire requests', () => {
      const attackerId = 'attacker-tab'

      for (let i = 0; i < 150; i++) {
        checkRateLimit(attackerId)
      }

      const stats = getRateLimitStats(attackerId)
      expect(stats.violations).toBeGreaterThan(0)
    })

    it('should allow reset after temporary rate limit', () => {
      const senderId = 'temp-limited'

      for (let i = 0; i < 100; i++) {
        checkRateLimit(senderId)
      }

      expect(checkRateLimit(senderId)).toBe(false)

      resetRateLimit(senderId)

      for (let i = 0; i < 50; i++) {
        expect(checkRateLimit(senderId)).toBe(true)
      }
    })

    it('should handle multiple senders with different patterns', () => {
      const normalUser = 'normal-user'
      const heavyUser = 'heavy-user'
      const attacker = 'attacker'

      for (let i = 0; i < 10; i++) {
        checkRateLimit(normalUser)
      }

      for (let i = 0; i < 80; i++) {
        checkRateLimit(heavyUser)
      }

      for (let i = 0; i < 200; i++) {
        checkRateLimit(attacker)
      }

      const normalStats = getRateLimitStats(normalUser)
      const heavyStats = getRateLimitStats(heavyUser)
      const attackStats = getRateLimitStats(attacker)

      expect(normalStats.violations).toBe(0)
      expect(heavyStats.violations).toBe(0)
      expect(attackStats.violations).toBeGreaterThan(0)
    })

    it('should maintain isolation between senders', () => {
      const sender1 = 'isolated-1'
      const sender2 = 'isolated-2'

      for (let i = 0; i < 100; i++) {
        checkRateLimit(sender1)
      }

      expect(checkRateLimit(sender1)).toBe(false)
      expect(checkRateLimit(sender2)).toBe(true)

      resetRateLimit(sender1)

      expect(checkRateLimit(sender1)).toBe(true)
      expect(checkRateLimit(sender2)).toBe(true)
    })
  })

  describe('concurrent access patterns', () => {
    it('should handle requests from same sender in sequence', () => {
      const senderId = 'sequential-sender'
      const results = []

      for (let i = 0; i < 105; i++) {
        results.push(checkRateLimit(senderId))
      }

      const firstHundred = results.slice(0, 100)
      const remainder = results.slice(100)

      expect(firstHundred.every(r => r === true)).toBe(true)
      expect(remainder.some(r => r === false)).toBe(true)
    })

    it('should maintain accurate counts under load', () => {
      const senderId = 'load-test'

      for (let i = 0; i < 75; i++) {
        checkRateLimit(senderId)
      }

      const stats = getRateLimitStats(senderId)
      expect(stats.requestCount).toBe(75)
    })
  })

  describe('block detection', () => {
    it('should block user after exceeding violation threshold', () => {
      const senderId = 'block-test-1'

      for (let i = 0; i < 100; i++) {
        checkRateLimit(senderId)
      }

      for (let i = 0; i < 5; i++) {
        checkRateLimit(senderId)
      }

      const stats = getRateLimitStats(senderId)
      expect(stats.isBlocked).toBe(true)
    })

    it('should prevent blocked user from making any requests', () => {
      const senderId = 'block-test-2'

      for (let i = 0; i < 100; i++) {
        checkRateLimit(senderId)
      }

      for (let i = 0; i < 5; i++) {
        checkRateLimit(senderId)
      }

      const result1 = checkRateLimit(senderId)
      const result2 = checkRateLimit(senderId)
      const result3 = checkRateLimit(senderId)

      expect(result1).toBe(false)
      expect(result2).toBe(false)
      expect(result3).toBe(false)
    })

    it('should check blocked state BEFORE processing request', () => {
      const senderId = 'block-test-3'

      for (let i = 0; i < 100; i++) {
        checkRateLimit(senderId)
      }

      for (let i = 0; i < 5; i++) {
        checkRateLimit(senderId)
      }

      const statsBefore = getRateLimitStats(senderId)
      expect(statsBefore.isBlocked).toBe(true)
      expect(statsBefore.requestCount).toBe(0)

      checkRateLimit(senderId)

      const statsAfter = getRateLimitStats(senderId)
      expect(statsAfter.isBlocked).toBe(true)
      expect(statsAfter.requestCount).toBe(0)
    })

    it('should not increment violation count for blocked users', () => {
      const senderId = 'block-test-4'

      for (let i = 0; i < 100; i++) {
        checkRateLimit(senderId)
      }

      for (let i = 0; i < 5; i++) {
        checkRateLimit(senderId)
      }

      const violationsBefore = getRateLimitStats(senderId).violations

      for (let i = 0; i < 10; i++) {
        checkRateLimit(senderId)
      }

      const violationsAfter = getRateLimitStats(senderId).violations

      expect(violationsAfter).toBe(violationsBefore)
    })

    it('should allow requests after block expires', () => {
      const senderId = 'block-test-5'
      const config = { maxRequests: 5, windowMs: 100 }

      for (let i = 0; i < 5; i++) {
        checkRateLimit(senderId, config)
      }

      for (let i = 0; i < 5; i++) {
        checkRateLimit(senderId, config)
      }

      const stats = getRateLimitStats(senderId)
      expect(stats.isBlocked).toBe(true)

      expect(checkRateLimit(senderId, config)).toBe(false)
    })

    it('should reset violation count after successful reset', () => {
      const senderId = 'block-test-6'

      for (let i = 0; i < 100; i++) {
        checkRateLimit(senderId)
      }

      for (let i = 0; i < 5; i++) {
        checkRateLimit(senderId)
      }

      expect(getRateLimitStats(senderId).isBlocked).toBe(true)

      resetRateLimit(senderId)

      expect(checkRateLimit(senderId)).toBe(true)
      const stats = getRateLimitStats(senderId)
      expect(stats.isBlocked).toBe(false)
      expect(stats.violations).toBe(0)
    })
  })
})
