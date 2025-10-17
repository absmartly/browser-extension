/**
 * URL Filter Utility
 *
 * Handles URL matching against filter patterns
 *
 * @module URLFilter
 */

import type { URLFilter } from '../types/config'
import { Logger } from './logger'

export interface LocationLike {
  href: string
  pathname: string
  hostname: string
  search: string
  hash: string
}

export class URLFilterMatcher {
  /**
   * Check if the current URL matches the given filter
   * @param urlFilter - Filter configuration
   * @param location - Location object (defaults to window.location)
   * @returns True if URL matches or if no filter is specified
   */
  static matchesUrlFilter(
    urlFilter?: URLFilter | string | string[],
    location: LocationLike = window.location
  ): boolean {
    if (!urlFilter) return true // No filter means apply on all pages

    const currentUrl = location.href
    const currentPath = location.pathname
    const currentDomain = location.hostname
    const currentQuery = location.search
    const currentHash = location.hash

    // Determine what to match against
    let matchTarget: string
    const matchType =
      typeof urlFilter === 'object' && !Array.isArray(urlFilter)
        ? urlFilter.matchType || 'path'
        : 'path'

    switch (matchType) {
      case 'full-url':
        matchTarget = currentUrl
        break
      case 'domain':
        matchTarget = currentDomain
        break
      case 'query':
        matchTarget = currentQuery
        break
      case 'hash':
        matchTarget = currentHash
        break
      case 'path':
      default:
        matchTarget = currentPath
    }

    // Get patterns
    let includePatterns: string[] = []
    let excludePatterns: string[] = []
    let isRegex = false

    if (typeof urlFilter === 'string') {
      includePatterns = [urlFilter]
    } else if (Array.isArray(urlFilter)) {
      includePatterns = urlFilter
    } else {
      includePatterns = urlFilter.include || []
      excludePatterns = urlFilter.exclude || []
      isRegex = urlFilter.mode === 'regex'
    }

    // Check exclude patterns first
    if (excludePatterns.length > 0) {
      for (const pattern of excludePatterns) {
        if (isRegex) {
          try {
            const regex = new RegExp(pattern)
            if (regex.test(matchTarget)) {
              Logger.log(`URL excluded by pattern: ${pattern}`)
              return false
            }
          } catch (e) {
            Logger.warn(`Invalid regex pattern: ${pattern}`, e)
          }
        } else {
          // Simple wildcard matching
          // Escape special regex characters except * and ?
          const escapedPattern = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.')
          const regex = new RegExp(`^${escapedPattern}$`)
          if (regex.test(matchTarget)) {
            Logger.log(`URL excluded by pattern: ${pattern}`)
            return false
          }
        }
      }
    }

    // Check include patterns
    if (includePatterns.length === 0) {
      return true // No include patterns means include all (that aren't excluded)
    }

    for (const pattern of includePatterns) {
      if (isRegex) {
        try {
          const regex = new RegExp(pattern)
          if (regex.test(matchTarget)) {
            Logger.log(`URL matched by pattern: ${pattern}`)
            return true
          }
        } catch (e) {
          Logger.warn(`Invalid regex pattern: ${pattern}`, e)
        }
      } else {
        // Simple wildcard matching
        // Escape special regex characters except * and ?
        const escapedPattern = pattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.')
        const regex = new RegExp(`^${escapedPattern}$`)
        if (regex.test(matchTarget)) {
          Logger.log(`URL matched by pattern: ${pattern}`)
          return true
        }
      }
    }

    Logger.log(`URL did not match any include patterns`)
    return false
  }
}
