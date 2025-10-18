/**
 * Code Injector Unit Tests
 */

import { CodeInjector, InjectionCode } from '../../experiment/code-injector'
import { Logger } from '../../utils/logger'
import { sanitizeHTML } from '../../utils/html-sanitizer'

jest.mock('../../utils/logger')
jest.mock('../../utils/html-sanitizer')

describe('CodeInjector', () => {
  let injector: CodeInjector
  let mockLogger: jest.Mocked<typeof Logger>

  beforeEach(() => {
    injector = new CodeInjector()
    mockLogger = Logger as jest.Mocked<typeof Logger>
    jest.clearAllMocks()
    document.body.innerHTML = ''
    document.head.innerHTML = ''
    ;(sanitizeHTML as jest.Mock).mockImplementation((html) => html)
  })

  describe('injectExperimentCode', () => {
    it('should do nothing when context is null', () => {
      injector.injectExperimentCode(null)

      expect(mockLogger.log).toHaveBeenCalledWith('[ABsmartly Extension] No context data available for experiment code injection')
    })

    it('should do nothing when context has no data_', () => {
      const context = {}

      injector.injectExperimentCode(context)

      expect(mockLogger.log).toHaveBeenCalledWith('[ABsmartly Extension] No context data available for experiment code injection')
    })

    it('should do nothing when context has no experiments', () => {
      const context = {
        data_: {}
      }

      injector.injectExperimentCode(context)

      expect(mockLogger.log).toHaveBeenCalledWith('[ABsmartly Extension] No experiments found in context')
    })

    it('should skip experiments without assignment', () => {
      const context = {
        data_: {
          experiments: [
            {
              id: 1,
              name: 'test-exp',
              variants: [{ config: '{"__inject_html": {}}' }]
            }
          ]
        },
        assignments_: {}
      }

      injector.injectExperimentCode(context)

      expect(mockLogger.log).toHaveBeenCalledWith('[ABsmartly Extension] Checking 1 experiments for injection code')
    })

    it('should skip experiments without variant config', () => {
      const context = {
        data_: {
          experiments: [
            {
              id: 1,
              name: 'test-exp',
              variants: [{}]
            }
          ]
        },
        assignments_: { 1: 0 }
      }

      injector.injectExperimentCode(context)

      // Should complete without error
      expect(mockLogger.log).toHaveBeenCalled()
    })

    it('should skip experiments without __inject_html', () => {
      const context = {
        data_: {
          experiments: [
            {
              id: 1,
              name: 'test-exp',
              variants: [{ config: '{"other": "value"}' }]
            }
          ]
        },
        assignments_: { 1: 0 }
      }

      injector.injectExperimentCode(context)

      // Should complete without error
      expect(mockLogger.log).toHaveBeenCalled()
    })

    it('should parse string variant config', () => {
      const context = {
        data_: {
          experiments: [
            {
              id: 1,
              name: 'test-exp',
              variants: [
                {
                  config: '{"__inject_html": {"headStart": "<div>test</div>"}}'
                }
              ]
            }
          ]
        },
        assignments_: { 1: 0 }
      }

      injector.injectExperimentCode(context)

      expect(mockLogger.log).toHaveBeenCalledWith(
        '[ABsmartly Extension] Found __inject_html in experiment "test-exp", variant 0'
      )
    })

    it('should handle object variant config', () => {
      const context = {
        data_: {
          experiments: [
            {
              id: 1,
              name: 'test-exp',
              variants: [
                {
                  config: {
                    __inject_html: {
                      headStart: '<div>test</div>'
                    }
                  }
                }
              ]
            }
          ]
        },
        assignments_: { 1: 0 }
      }

      injector.injectExperimentCode(context)

      expect(mockLogger.log).toHaveBeenCalledWith(
        '[ABsmartly Extension] Found __inject_html in experiment "test-exp", variant 0'
      )
    })

    it('should skip injection when URL filter does not match', () => {
      const context = {
        data_: {
          experiments: [
            {
              id: 1,
              name: 'test-exp',
              variants: [
                {
                  config: {
                    __inject_html: {
                      headStart: '<div>test</div>',
                      urlFilter: '/different/path'
                    }
                  }
                }
              ]
            }
          ]
        },
        assignments_: { 1: 0 }
      }

      injector.injectExperimentCode(context)

      expect(mockLogger.log).toHaveBeenCalledWith(
        '[ABsmartly Extension] Skipping injection for experiment "test-exp" - URL filter not matched'
      )
    })

    it('should inject code at all locations when URL matches', () => {
      const context = {
        data_: {
          experiments: [
            {
              id: 1,
              name: 'test-exp',
              variants: [
                {
                  config: {
                    __inject_html: {
                      headStart: '<script src="head-start.js"></script>',
                      headEnd: '<script src="head-end.js"></script>',
                      bodyStart: '<script src="body-start.js"></script>',
                      bodyEnd: '<script src="body-end.js"></script>'
                    }
                  }
                }
              ]
            }
          ]
        },
        assignments_: { 1: 0 }
      }

      injector.injectExperimentCode(context)

      expect(mockLogger.log).toHaveBeenCalledWith(
        '[ABsmartly Extension] Injecting code for experiment "test-exp" at headStart'
      )
      expect(mockLogger.log).toHaveBeenCalledWith(
        '[ABsmartly Extension] Injecting code for experiment "test-exp" at headEnd'
      )
      expect(mockLogger.log).toHaveBeenCalledWith(
        '[ABsmartly Extension] Injecting code for experiment "test-exp" at bodyStart'
      )
      expect(mockLogger.log).toHaveBeenCalledWith(
        '[ABsmartly Extension] Injecting code for experiment "test-exp" at bodyEnd'
      )
    })

    it('should handle invalid JSON in variant config', () => {
      const context = {
        data_: {
          experiments: [
            {
              id: 1,
              name: 'test-exp',
              variants: [{ config: 'invalid json' }]
            }
          ]
        },
        assignments_: { 1: 0 }
      }

      injector.injectExperimentCode(context)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[ABsmartly Extension] Failed to parse variant config for experiment test-exp:',
        expect.any(Error)
      )
    })

    it('should handle invalid JSON in __inject_html', () => {
      const context = {
        data_: {
          experiments: [
            {
              id: 1,
              name: 'test-exp',
              variants: [{ config: { __inject_html: 'invalid json' } }]
            }
          ]
        },
        assignments_: { 1: 0 }
      }

      injector.injectExperimentCode(context)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[ABsmartly Extension] Failed to parse __inject_html for experiment test-exp:',
        expect.any(Error)
      )
    })

    it('should handle errors during injection', () => {
      const context = {
        data_: {
          experiments: [
            {
              id: 1,
              name: 'test-exp',
              variants: [
                {
                  config: {
                    __inject_html: {
                      headStart: '<script src="test.js"></script>'
                    }
                  }
                }
              ]
            }
          ]
        },
        assignments_: { 1: 0 }
      }

      // Mock insertAtLocation to throw error
      jest.spyOn(injector, 'insertAtLocation').mockImplementation(() => {
        throw new Error('Insert error')
      })

      injector.injectExperimentCode(context)

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[ABsmartly Extension] Error processing experiment 0:',
        expect.any(Error)
      )
    })

    it('should process multiple experiments', () => {
      const context = {
        data_: {
          experiments: [
            {
              id: 1,
              name: 'exp-1',
              variants: [
                {
                  config: {
                    __inject_html: {
                      headStart: '<script src="exp1.js"></script>'
                    }
                  }
                }
              ]
            },
            {
              id: 2,
              name: 'exp-2',
              variants: [
                {
                  config: {
                    __inject_html: {
                      bodyEnd: '<script src="exp2.js"></script>'
                    }
                  }
                }
              ]
            }
          ]
        },
        assignments_: { 1: 0, 2: 0 }
      }

      injector.injectExperimentCode(context)

      expect(mockLogger.log).toHaveBeenCalledWith(
        '[ABsmartly Extension] Successfully processed injection code for experiment "exp-1"'
      )
      expect(mockLogger.log).toHaveBeenCalledWith(
        '[ABsmartly Extension] Successfully processed injection code for experiment "exp-2"'
      )
    })
  })

  describe('executeScriptsInHTML', () => {
    it('should extract and execute external scripts', () => {
      const html = '<script src="test.js"></script>'

      injector.executeScriptsInHTML(html, 'headEnd')

      const scripts = document.head.querySelectorAll('script[data-absmartly-injected]')
      expect(scripts.length).toBe(1)
      expect(scripts[0].getAttribute('src')).toContain('test.js')
      expect(scripts[0].getAttribute('data-absmartly-injected')).toBe('headEnd')
    })

    it('should preserve script async attribute', () => {
      const html = '<script src="test.js" async></script>'

      injector.executeScriptsInHTML(html, 'headEnd')

      const scripts = document.head.querySelectorAll('script')
      expect(scripts.length).toBeGreaterThan(0)
      expect(scripts[0].async).toBeTruthy()
    })

    it('should preserve script defer attribute', () => {
      const html = '<script src="test.js" defer></script>'

      injector.executeScriptsInHTML(html, 'headEnd')

      const scripts = document.head.querySelectorAll('script')
      expect(scripts[0].defer).toBe(true)
    })

    it('should block inline scripts for security', () => {
      const html = '<script>alert("xss")</script>'

      injector.executeScriptsInHTML(html, 'headEnd')

      const scripts = document.head.querySelectorAll('script')
      expect(scripts.length).toBe(0)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[ABsmartly Extension] Inline script execution disabled for security from headEnd'
      )
    })

    it('should process multiple external scripts', () => {
      const html = '<script src="test1.js"></script><script src="test2.js"></script>'

      injector.executeScriptsInHTML(html, 'bodyEnd')

      const scripts = document.body.querySelectorAll('script[data-absmartly-injected]')
      expect(scripts.length).toBe(2)
      expect(scripts[0].getAttribute('src')).toContain('test1.js')
      expect(scripts[1].getAttribute('src')).toContain('test2.js')
    })

    it('should call sanitizeHTML before processing', () => {
      const html = '<script src="test.js"></script>'

      injector.executeScriptsInHTML(html, 'headEnd')

      expect(sanitizeHTML).toHaveBeenCalledWith(html)
    })

    it('should handle script execution errors', () => {
      const html = '<script src="test.js"></script>'

      // Mock insertAtLocation to throw
      jest.spyOn(injector, 'insertAtLocation').mockImplementation(() => {
        throw new Error('Insert failed')
      })

      injector.executeScriptsInHTML(html, 'headEnd')

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[ABsmartly Extension] Failed to execute script from headEnd:',
        expect.any(Error)
      )
    })

    it('should handle mixed inline and external scripts', () => {
      const html = '<script>alert("inline")</script><script src="external.js"></script>'

      injector.executeScriptsInHTML(html, 'headEnd')

      const scripts = document.head.querySelectorAll('script')
      expect(scripts.length).toBe(1) // Only external script
      expect(scripts[0].getAttribute('src')).toContain('external.js')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[ABsmartly Extension] Inline script execution disabled for security from headEnd'
      )
    })
  })

  describe('insertAtLocation', () => {
    it('should insert at headStart when head is empty', () => {
      const element = document.createElement('script')
      element.src = 'test.js'

      injector.insertAtLocation(element, 'headStart')

      expect(document.head.firstChild).toBe(element)
    })

    it('should insert at headStart before existing children', () => {
      const existing = document.createElement('meta')
      document.head.appendChild(existing)

      const element = document.createElement('script')
      element.src = 'test.js'

      injector.insertAtLocation(element, 'headStart')

      expect(document.head.firstChild).toBe(element)
      expect(element.nextSibling).toBe(existing)
    })

    it('should insert at headEnd', () => {
      const existing = document.createElement('meta')
      document.head.appendChild(existing)

      const element = document.createElement('script')
      element.src = 'test.js'

      injector.insertAtLocation(element, 'headEnd')

      expect(document.head.lastChild).toBe(element)
    })

    it('should insert at bodyStart when body is empty', () => {
      const element = document.createElement('div')

      injector.insertAtLocation(element, 'bodyStart')

      expect(document.body.firstChild).toBe(element)
    })

    it('should insert at bodyStart before existing children', () => {
      const existing = document.createElement('div')
      document.body.appendChild(existing)

      const element = document.createElement('script')
      element.src = 'test.js'

      injector.insertAtLocation(element, 'bodyStart')

      expect(document.body.firstChild).toBe(element)
      expect(element.nextSibling).toBe(existing)
    })

    it('should insert at bodyEnd', () => {
      const existing = document.createElement('div')
      document.body.appendChild(existing)

      const element = document.createElement('script')
      element.src = 'test.js'

      injector.insertAtLocation(element, 'bodyEnd')

      expect(document.body.lastChild).toBe(element)
    })

    it('should warn for unknown location', () => {
      const element = document.createElement('div')

      injector.insertAtLocation(element, 'unknown' as any)

      expect(mockLogger.warn).toHaveBeenCalledWith('[ABsmartly Extension] Unknown injection location: unknown')
    })
  })

  // TODO: Fix URL filter tests - JSDOM location mocking is problematic
  // These tests require proper window.location mocking which is complex in JSDOM
  // The URL filtering functionality is tested in E2E tests instead
  describe.skip('matchesUrlFilter', () => {
    it('should return true when no filter is specified', () => {
      expect(injector.matchesUrlFilter(undefined as any)).toBe(true)
    })

    it('should match simple string pattern', () => {
      expect(injector.matchesUrlFilter('/path/to/page')).toBe(true)
    })

    it('should not match different string pattern', () => {
      expect(injector.matchesUrlFilter('/different')).toBe(false)
    })

    it('should match wildcard pattern *', () => {
      expect(injector.matchesUrlFilter('/path/*')).toBe(true)
    })

    it('should match wildcard pattern ?', () => {
      expect(injector.matchesUrlFilter('/path/to/pag?')).toBe(true)
    })

    it('should match array of patterns', () => {
      expect(injector.matchesUrlFilter(['/wrong', '/path/to/page', '/also-wrong'])).toBe(true)
    })

    it('should not match when none in array match', () => {
      expect(injector.matchesUrlFilter(['/wrong', '/also-wrong'])).toBe(false)
    })

    it('should match include patterns', () => {
      expect(
        injector.matchesUrlFilter({
          include: ['/path/*']
        })
      ).toBe(true)
    })

    it('should exclude before include', () => {
      expect(
        injector.matchesUrlFilter({
          include: ['/path/*'],
          exclude: ['/path/to/page']
        })
      ).toBe(false)
    })

    it('should match regex pattern', () => {
      expect(
        injector.matchesUrlFilter({
          include: ['/path/.*/page'],
          mode: 'regex'
        })
      ).toBe(true)
    })

    it('should handle invalid regex gracefully', () => {
      expect(
        injector.matchesUrlFilter({
          include: ['[invalid'],
          mode: 'regex'
        })
      ).toBe(false)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[ABsmartly Extension] Invalid regex pattern: [invalid',
        expect.any(Error)
      )
    })

    it('should match full URL when matchType is full-url', () => {
      expect(
        injector.matchesUrlFilter({
          include: ['https://example.com/path/to/page*'],
          matchType: 'full-url'
        })
      ).toBe(true)
    })

    it('should match domain when matchType is domain', () => {
      expect(
        injector.matchesUrlFilter({
          include: ['example.com'],
          matchType: 'domain'
        })
      ).toBe(true)
    })

    it('should match query when matchType is query', () => {
      expect(
        injector.matchesUrlFilter({
          include: ['?query=value'],
          matchType: 'query'
        })
      ).toBe(true)
    })

    it('should match hash when matchType is hash', () => {
      expect(
        injector.matchesUrlFilter({
          include: ['#hash'],
          matchType: 'hash'
        })
      ).toBe(true)
    })

    it('should match path by default', () => {
      expect(
        injector.matchesUrlFilter({
          include: ['/path/to/page']
        })
      ).toBe(true)
    })

    it('should return true when no include patterns', () => {
      expect(
        injector.matchesUrlFilter({
          exclude: ['/other']
        })
      ).toBe(true)
    })

    it('should handle exclude with wildcard', () => {
      expect(
        injector.matchesUrlFilter({
          include: ['/path/*'],
          exclude: ['/path/to/*']
        })
      ).toBe(false)
    })

    it('should handle exclude with regex', () => {
      expect(
        injector.matchesUrlFilter({
          include: ['/path/.*'],
          exclude: ['/path/to/.*'],
          mode: 'regex'
        })
      ).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle context with undefined assignments_', () => {
      const context = {
        data_: {
          experiments: [
            {
              id: 1,
              name: 'test-exp',
              variants: [{ config: '{"__inject_html": {}}' }]
            }
          ]
        }
      }

      injector.injectExperimentCode(context)

      // Should complete without error
      expect(mockLogger.log).toHaveBeenCalled()
    })

    it('should handle empty experiments array', () => {
      const context = {
        data_: {
          experiments: []
        }
      }

      injector.injectExperimentCode(context)

      expect(mockLogger.log).toHaveBeenCalledWith('[ABsmartly Extension] Checking 0 experiments for injection code')
    })

    it('should handle variant without variants array', () => {
      const context = {
        data_: {
          experiments: [
            {
              id: 1,
              name: 'test-exp'
            }
          ]
        },
        assignments_: { 1: 0 }
      }

      injector.injectExperimentCode(context)

      // Should complete without error
      expect(mockLogger.log).toHaveBeenCalled()
    })

    it('should handle assignment to non-existent variant', () => {
      const context = {
        data_: {
          experiments: [
            {
              id: 1,
              name: 'test-exp',
              variants: [{ config: '{}' }]
            }
          ]
        },
        assignments_: { 1: 5 }
      }

      injector.injectExperimentCode(context)

      // Should complete without error
      expect(mockLogger.log).toHaveBeenCalled()
    })

    it('should sanitize HTML before processing scripts', () => {
      const html = '<script src="test.js"></script><img src=x onerror=alert(1)>'

      injector.executeScriptsInHTML(html, 'headEnd')

      expect(sanitizeHTML).toHaveBeenCalledWith(html)
    })
  })
})
