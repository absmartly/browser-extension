/**
 * URL Filter Unit Tests
 */

import { URLFilterMatcher, type LocationLike } from '../../utils/url-filter'
import { Logger } from '../../utils/logger'

jest.mock('../../utils/logger')

describe('URLFilterMatcher', () => {
  // Mock location object
  let mockLocation: LocationLike

  beforeEach(() => {
    // Default location for tests
    mockLocation = {
      href: 'https://example.com/products/item?id=123#section',
      pathname: '/products/item',
      hostname: 'example.com',
      search: '?id=123',
      hash: '#section'
    }
  })

  describe('matchesUrlFilter', () => {
    it('should return true when no filter is provided', () => {
      expect(URLFilterMatcher.matchesUrlFilter()).toBe(true)
      expect(URLFilterMatcher.matchesUrlFilter(undefined, mockLocation)).toBe(true)
    })

    describe('string filters', () => {
      it('should match exact path', () => {
        expect(URLFilterMatcher.matchesUrlFilter('/products/item', mockLocation)).toBe(true)
      })

      it('should not match different path', () => {
        expect(URLFilterMatcher.matchesUrlFilter('/other/path', mockLocation)).toBe(false)
      })

      it('should match path with wildcards', () => {
        expect(URLFilterMatcher.matchesUrlFilter('/products/*', mockLocation)).toBe(true)
        expect(URLFilterMatcher.matchesUrlFilter('/prod*', mockLocation)).toBe(true)
        expect(URLFilterMatcher.matchesUrlFilter('/*', mockLocation)).toBe(true)
      })

      it('should match path with question mark wildcard', () => {
        expect(URLFilterMatcher.matchesUrlFilter('/products/ite?', mockLocation)).toBe(true)
      })
    })

    describe('array filters', () => {
      it('should match if any pattern matches', () => {
        expect(URLFilterMatcher.matchesUrlFilter(['/products/*', '/services/*'], mockLocation)).toBe(true)
        expect(URLFilterMatcher.matchesUrlFilter(['/other/*', '/products/*'], mockLocation)).toBe(true)
      })

      it('should not match if no patterns match', () => {
        expect(URLFilterMatcher.matchesUrlFilter(['/services/*', '/about/*'], mockLocation)).toBe(false)
      })
    })

    describe('object filters with matchType', () => {
      it('should match by path (default)', () => {
        expect(
          URLFilterMatcher.matchesUrlFilter({
            include: ['/products/*'],
            matchType: 'path'
          }, mockLocation)
        ).toBe(true)
      })

      it('should match by full URL', () => {
        expect(
          URLFilterMatcher.matchesUrlFilter({
            include: ['https://example.com/*'],
            matchType: 'full-url'
          }, mockLocation)
        ).toBe(true)
      })

      it('should match by domain', () => {
        expect(
          URLFilterMatcher.matchesUrlFilter({
            include: ['example.com'],
            matchType: 'domain'
          }, mockLocation)
        ).toBe(true)

        expect(
          URLFilterMatcher.matchesUrlFilter({
            include: ['*.com'],
            matchType: 'domain'
          }, mockLocation)
        ).toBe(true)
      })

      it('should match by query string', () => {
        expect(
          URLFilterMatcher.matchesUrlFilter({
            include: ['?id=*'],
            matchType: 'query'
          }, mockLocation)
        ).toBe(true)
      })

      it('should match by hash', () => {
        expect(
          URLFilterMatcher.matchesUrlFilter({
            include: ['#section'],
            matchType: 'hash'
          }, mockLocation)
        ).toBe(true)
      })
    })

    describe('exclude patterns', () => {
      it('should exclude URLs matching exclude patterns', () => {
        expect(
          URLFilterMatcher.matchesUrlFilter({
            include: ['/products/*'],
            exclude: ['/products/item']
          }, mockLocation)
        ).toBe(false)
      })

      it('should include URLs not matching exclude patterns', () => {
        expect(
          URLFilterMatcher.matchesUrlFilter({
            include: ['/products/*'],
            exclude: ['/products/other']
          }, mockLocation)
        ).toBe(true)
      })

      it('should exclude with wildcards', () => {
        expect(
          URLFilterMatcher.matchesUrlFilter({
            include: ['/products/*'],
            exclude: ['/products/item*']
          }, mockLocation)
        ).toBe(false)
      })

      it('should check exclude patterns before include patterns', () => {
        const filter = {
          include: ['/*'],
          exclude: ['/products/*']
        }
        expect(URLFilterMatcher.matchesUrlFilter(filter, mockLocation)).toBe(false)
        expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('excluded'))
      })
    })

    describe('regex mode', () => {
      it('should match with regex patterns', () => {
        expect(
          URLFilterMatcher.matchesUrlFilter({
            include: ['/products/\\w+'],
            mode: 'regex'
          }, mockLocation)
        ).toBe(true)
      })

      it('should not match non-matching regex', () => {
        expect(
          URLFilterMatcher.matchesUrlFilter({
            include: ['/services/\\d+'],
            mode: 'regex'
          }, mockLocation)
        ).toBe(false)
      })

      it('should exclude with regex patterns', () => {
        expect(
          URLFilterMatcher.matchesUrlFilter({
            include: ['/\\w+/\\w+'],
            exclude: ['/products/item'],
            mode: 'regex'
          }, mockLocation)
        ).toBe(false)
      })

      it('should handle invalid regex patterns gracefully', () => {
        expect(
          URLFilterMatcher.matchesUrlFilter({
            include: ['[invalid(regex'],
            mode: 'regex'
          }, mockLocation)
        ).toBe(false)

        expect(Logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid regex pattern'),
          expect.any(Error)
        )
      })
    })

    describe('wildcard mode', () => {
      it('should convert * to .* for any characters', () => {
        expect(URLFilterMatcher.matchesUrlFilter('/products/*', mockLocation)).toBe(true)
        expect(URLFilterMatcher.matchesUrlFilter('/**/item', mockLocation)).toBe(true) // ** is two wildcards that match /products/
        expect(URLFilterMatcher.matchesUrlFilter('/services/*', mockLocation)).toBe(false) // Different path
      })

      it('should convert ? to . for single character', () => {
        expect(URLFilterMatcher.matchesUrlFilter('/products/ite?', mockLocation)).toBe(true)
        expect(URLFilterMatcher.matchesUrlFilter('/products/it?m', mockLocation)).toBe(true)
        expect(URLFilterMatcher.matchesUrlFilter('/products/i???', mockLocation)).toBe(true)
      })

      it('should require exact match with wildcards', () => {
        // Pattern must match entire path
        expect(URLFilterMatcher.matchesUrlFilter('/products', mockLocation)).toBe(false) // Missing /item
        expect(URLFilterMatcher.matchesUrlFilter('/products/item/extra', mockLocation)).toBe(false)
      })
    })

    describe('empty include patterns', () => {
      it('should return true if no include patterns (not excluded)', () => {
        expect(
          URLFilterMatcher.matchesUrlFilter({
            include: [],
            exclude: ['/admin/*']
          }, mockLocation)
        ).toBe(true)
      })

      it('should return false if excluded with no include patterns', () => {
        expect(
          URLFilterMatcher.matchesUrlFilter({
            include: [],
            exclude: ['/products/*']
          }, mockLocation)
        ).toBe(false)
      })
    })

    describe('logging', () => {
      it('should log when URL is excluded', () => {
        URLFilterMatcher.matchesUrlFilter({
          exclude: ['/products/*']
        }, mockLocation)

        expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('excluded'))
      })

      it('should log when URL matches pattern', () => {
        URLFilterMatcher.matchesUrlFilter('/products/*', mockLocation)

        expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('matched'))
      })

      it('should log when URL does not match any patterns', () => {
        URLFilterMatcher.matchesUrlFilter('/other/*', mockLocation)

        expect(Logger.log).toHaveBeenCalledWith(
          expect.stringContaining('did not match any include patterns')
        )
      })
    })

    describe('edge cases', () => {
      it('should handle URLs with special characters', () => {
        mockLocation.pathname = '/products/item-123'

        expect(URLFilterMatcher.matchesUrlFilter('/products/item-*', mockLocation)).toBe(true)
      })

      it('should handle empty path', () => {
        mockLocation.pathname = '/'

        expect(URLFilterMatcher.matchesUrlFilter('/', mockLocation)).toBe(true)
        expect(URLFilterMatcher.matchesUrlFilter('/*', mockLocation)).toBe(true)
      })

      it('should handle case-sensitive matching', () => {
        expect(URLFilterMatcher.matchesUrlFilter('/Products/item', mockLocation)).toBe(false)
        expect(URLFilterMatcher.matchesUrlFilter('/products/Item', mockLocation)).toBe(false)
      })
    })
  })
})
