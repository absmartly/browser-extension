import {
  registerFileUrlContentScript,
  isRestrictedUrl,
  injectOrToggleSidebar,
  initializeInjectionHandler
} from '../injection-handler'

describe('InjectionHandler', () => {
  let mockChrome: any

  beforeEach(() => {
    mockChrome = {
      runtime: {
        getManifest: jest.fn(),
        onInstalled: {
          addListener: jest.fn()
        },
        onStartup: {
          addListener: jest.fn()
        },
        getURL: jest.fn((path) => `chrome-extension://test-id${path}`)
      },
      scripting: {
        registerContentScripts: jest.fn(),
        unregisterContentScripts: jest.fn(),
        executeScript: jest.fn()
      },
      tabs: {
        query: jest.fn(),
        onUpdated: {
          addListener: jest.fn()
        }
      },
      action: {
        onClicked: {
          addListener: jest.fn()
        }
      }
    }

    global.chrome = mockChrome as any
    global.console.log = jest.fn()
    global.console.error = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('registerFileUrlContentScript', () => {
    it('should register content script for file:// URLs on first attempt', async () => {
      // Mock test mode detection (file:// URLs present)
      mockChrome.tabs.query.mockResolvedValue([
        { url: 'file:///path/to/test.html' }
      ])
      mockChrome.runtime.getManifest.mockReturnValue({
        content_scripts: [{
          js: ['content-script.js']
        }]
      })
      mockChrome.scripting.registerContentScripts.mockResolvedValue(undefined)

      await registerFileUrlContentScript()

      expect(mockChrome.scripting.registerContentScripts).toHaveBeenCalledWith([{
        id: 'file-url-content-script',
        matches: ['file://*/*'],
        js: ['content-script.js'],
        runAt: 'document_idle',
        allFrames: false
      }])
      expect(console.log).toHaveBeenCalledWith(
        '[InjectionHandler] Test mode: Registered content script for file:// URLs'
      )
    })

    it('should handle already registered script by unregistering and re-registering', async () => {
      // Mock test mode detection (file:// URLs present)
      mockChrome.tabs.query.mockResolvedValue([
        { url: 'file:///path/to/test.html' }
      ])
      mockChrome.runtime.getManifest.mockReturnValue({
        content_scripts: [{
          js: ['content-script.js']
        }]
      })
      mockChrome.scripting.registerContentScripts
        .mockRejectedValueOnce(new Error('Already registered'))
        .mockResolvedValueOnce(undefined)
      mockChrome.scripting.unregisterContentScripts.mockResolvedValue(undefined)

      await registerFileUrlContentScript()

      expect(mockChrome.scripting.unregisterContentScripts).toHaveBeenCalledWith({
        ids: ['file-url-content-script']
      })
      expect(mockChrome.scripting.registerContentScripts).toHaveBeenCalledTimes(2)
      expect(console.log).toHaveBeenCalledWith(
        '[InjectionHandler] Test mode: Re-registered content script for file:// URLs'
      )
    })

    it('should handle re-registration failure', async () => {
      // Mock test mode detection (file:// URLs present)
      mockChrome.tabs.query.mockResolvedValue([
        { url: 'file:///path/to/test.html' }
      ])
      mockChrome.runtime.getManifest.mockReturnValue({
        content_scripts: [{
          js: ['content-script.js']
        }]
      })
      mockChrome.scripting.registerContentScripts.mockRejectedValue(new Error('Registration failed'))
      mockChrome.scripting.unregisterContentScripts.mockRejectedValue(new Error('Unregister failed'))

      await registerFileUrlContentScript()

      expect(console.error).toHaveBeenCalledWith(
        '[InjectionHandler] Test mode: Failed to register file:// content script:',
        expect.any(Error)
      )
    })

    it('should handle missing content scripts in manifest', async () => {
      mockChrome.runtime.getManifest.mockReturnValue({
        content_scripts: []
      })

      await registerFileUrlContentScript()

      expect(mockChrome.scripting.registerContentScripts).not.toHaveBeenCalled()
    })

    it('should handle manifest without content_scripts field', async () => {
      mockChrome.runtime.getManifest.mockReturnValue({})

      await registerFileUrlContentScript()

      expect(mockChrome.scripting.registerContentScripts).not.toHaveBeenCalled()
    })
  })

  describe('isRestrictedUrl', () => {
    it('should identify chrome:// URLs as restricted', () => {
      expect(isRestrictedUrl('chrome://extensions')).toBe(true)
      expect(isRestrictedUrl('chrome://settings')).toBe(true)
    })

    it('should identify edge:// URLs as restricted', () => {
      expect(isRestrictedUrl('edge://extensions')).toBe(true)
    })

    it('should identify about: URLs as restricted', () => {
      expect(isRestrictedUrl('about:blank')).toBe(true)
      expect(isRestrictedUrl('about:config')).toBe(true)
    })

    it('should identify chrome-extension:// URLs as restricted', () => {
      expect(isRestrictedUrl('chrome-extension://abc123/index.html')).toBe(true)
    })

    it('should identify regular URLs as not restricted', () => {
      expect(isRestrictedUrl('https://example.com')).toBe(false)
      expect(isRestrictedUrl('http://localhost:3000')).toBe(false)
      expect(isRestrictedUrl('file:///path/to/file.html')).toBe(false)
    })
  })

  describe('injectOrToggleSidebar', () => {
    it('should not inject sidebar on restricted URLs', async () => {
      await injectOrToggleSidebar(1, 'chrome://extensions')

      expect(mockChrome.scripting.executeScript).not.toHaveBeenCalled()
    })

    it('should inject sidebar on valid URLs', async () => {
      mockChrome.scripting.executeScript.mockResolvedValue([])

      await injectOrToggleSidebar(1, 'https://example.com')

      expect(mockChrome.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 1 },
        func: expect.any(Function)
      })
    })

    it('should handle injection errors', async () => {
      const mockError = new Error('Injection failed')
      mockChrome.scripting.executeScript.mockRejectedValue(mockError)

      await expect(injectOrToggleSidebar(1, 'https://example.com')).rejects.toThrow('Injection failed')

      expect(mockChrome.scripting.executeScript).toHaveBeenCalled()
    })
  })

  describe('initializeInjectionHandler', () => {
    it('should register all event listeners', () => {
      initializeInjectionHandler()

      expect(mockChrome.runtime.onInstalled.addListener).toHaveBeenCalledWith(
        registerFileUrlContentScript
      )
      expect(mockChrome.runtime.onStartup.addListener).toHaveBeenCalledWith(
        registerFileUrlContentScript
      )
      expect(mockChrome.tabs.onUpdated.addListener).toHaveBeenCalledWith(
        expect.any(Function)
      )
      expect(mockChrome.action.onClicked.addListener).toHaveBeenCalledWith(
        expect.any(Function)
      )
    })

    it('should handle tab updates', () => {
      initializeInjectionHandler()

      const tabUpdateHandler = mockChrome.tabs.onUpdated.addListener.mock.calls[0][0]

      tabUpdateHandler(1, { status: 'loading' }, { url: 'https://example.com' })
      tabUpdateHandler(1, { status: 'complete' }, { url: 'https://example.com' })

      expect(mockChrome.scripting.executeScript).not.toHaveBeenCalled()
    })

    it('should handle action clicks with valid tab', async () => {
      mockChrome.scripting.executeScript.mockResolvedValue([])
      initializeInjectionHandler()

      const actionClickHandler = mockChrome.action.onClicked.addListener.mock.calls[0][0]

      await actionClickHandler({ id: 1, url: 'https://example.com' })

      expect(mockChrome.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 1 },
        func: expect.any(Function)
      })
    })

    it('should not inject on action click without tab id', async () => {
      initializeInjectionHandler()

      const actionClickHandler = mockChrome.action.onClicked.addListener.mock.calls[0][0]

      await actionClickHandler({ url: 'https://example.com' })

      expect(mockChrome.scripting.executeScript).not.toHaveBeenCalled()
    })

    it('should not inject on action click without tab url', async () => {
      initializeInjectionHandler()

      const actionClickHandler = mockChrome.action.onClicked.addListener.mock.calls[0][0]

      await actionClickHandler({ id: 1 })

      expect(mockChrome.scripting.executeScript).not.toHaveBeenCalled()
    })
  })

  describe('toggleSidebarFunc integration', () => {
    it('should execute sidebar toggle function in page context', async () => {
      let executedFunc: Function | null = null
      mockChrome.scripting.executeScript.mockImplementation((options: any) => {
        executedFunc = options.func
        return Promise.resolve([])
      })

      await injectOrToggleSidebar(1, 'https://example.com')

      expect(executedFunc).toBeDefined()
      expect(typeof executedFunc).toBe('function')
    })
  })

  describe('sidebar function serialization', () => {
    it('should serialize sidebar toggle function correctly', async () => {
      let executedFunc: Function | null = null
      mockChrome.scripting.executeScript.mockImplementation((options: any) => {
        executedFunc = options.func
        return Promise.resolve([])
      })

      await injectOrToggleSidebar(1, 'https://example.com')

      expect(executedFunc).toBeDefined()
      expect(typeof executedFunc).toBe('function')
      const funcString = executedFunc!.toString()
      expect(funcString).toContain('absmartly-sidebar-root')
      expect(funcString).toContain('translateX')
      expect(funcString).toContain('iframe')
    })
  })
})
