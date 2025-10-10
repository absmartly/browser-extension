import type { Page } from '@playwright/test'

export class BackgroundRunner {
  private page: Page

  constructor(page: Page) {
    this.page = page
  }

  async initialize(buildPath: string) {
    // Inject the background script functionality into the test page
    await this.page.evaluate((buildPath) => {
      // Set up unified runtime messaging polyfill
      if (!(window as any).chrome) {
        (window as any).chrome = {}
      }

      const chrome = (window as any).chrome
      chrome.runtime = chrome.runtime || {}

      // Create message listeners registry
      const messageListeners: Set<Function> = new Set()

      const originalOnMessage = chrome.runtime.onMessage

      // Polyfill chrome.runtime.onMessage to work with both Chrome and window.postMessage
      chrome.runtime.onMessage = {
        _originalAddListener: originalOnMessage?.addListener,

        addListener: (callback: Function) => {
          messageListeners.add(callback)
          if (originalOnMessage?.addListener) {
            originalOnMessage.addListener(callback)
          }
        },

        removeListener: (callback: Function) => {
          messageListeners.delete(callback)
          if (originalOnMessage?.removeListener) {
            originalOnMessage.removeListener(callback)
          }
        },

        hasListener: (callback: Function) => {
          return messageListeners.has(callback)
        }
      }

      // Forward window.postMessage to chrome.runtime.onMessage listeners
      window.addEventListener('message', (event: MessageEvent) => {
        if (event.data?.source === 'absmartly-extension-incoming') {
          const message = event.data
          const sender = {
            tab: event.data.tabId ? { id: event.data.tabId } : undefined
          }

          messageListeners.forEach(listener => {
            try {
              listener(message, sender, () => {})
            } catch (error) {
              console.error('[Runtime Polyfill] Error in message listener:', error)
            }
          })
        }
      })

      console.log('✅ Runtime messaging polyfill initialized')

      // Hook into polyfilled onMessage for background-specific handling
      chrome.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
        console.log('Background runner intercepted message:', message.type)

        // Handle API_REQUEST messages directly
        if (message.type === 'API_REQUEST') {
          (async () => {
            try {
              // Get stored API credentials
              const settings = await new Promise((resolve) => {
                if (chrome.storage && chrome.storage.local) {
                  chrome.storage.local.get(['apiKey', 'apiEndpoint', 'environment'], (result: any) => {
                    resolve(result)
                  })
                } else {
                  // Use environment variables as fallback
                  resolve({
                    apiKey: 'BxYKd1U2DlzOLJ74gdvaIkwy4qyOCkXi_YJFFdE1EDyovjEsQ__iiX0IM1ONfHKB',
                    apiEndpoint: 'https://dev-1.absmartly.com/v1',
                    environment: 'development'
                  })
                }
              })

              // Build URL with proper path - handle both /path and path formats
              const path = message.path || message.endpoint || ''
              const normalizedPath = path.startsWith('/') ? path : `/${path}`
              const url = `${(settings as any).apiEndpoint}${normalizedPath}`

              // Add query parameters if provided
              const finalUrl = message.data && message.method === 'GET' ?
                `${url}?${new URLSearchParams(message.data).toString()}` : url

              console.log('Making API request to:', finalUrl)
              console.log('With headers:', {
                'X-API-Key': (settings as any).apiKey,
                'X-Environment': (settings as any).environment || 'development'
              })

              // Make the actual API request
              const response = await fetch(finalUrl, {
                method: message.method || 'GET',
                headers: {
                  'X-API-Key': (settings as any).apiKey,
                  'X-Environment': (settings as any).environment || 'development',
                  'Content-Type': 'application/json',
                  ...message.headers
                },
                body: message.method !== 'GET' && message.data ? JSON.stringify(message.data) : undefined
              })

              console.log('API Response status:', response.status)
              const data = await response.json()
              console.log('API Response data:', data)

              const result = { success: true, data }

              if (sendResponse) {
                sendResponse(result)
              }
            } catch (error: any) {
              const errorResult = { success: false, error: error.message }
              if (sendResponse) {
                sendResponse(errorResult)
              }
            }
          })()
          return true // Keep channel open for async response
        }
      })

      // Mock chrome.storage API
      if (!chrome.storage) {
        const storageData: any = {
          apiKey: 'BxYKd1U2DlzOLJ74gdvaIkwy4qyOCkXi_YJFFdE1EDyovjEsQ__iiX0IM1ONfHKB',
          apiEndpoint: 'https://dev-1.absmartly.com/v1',
          environment: 'development',
          'absmartly-apikey': 'BxYKd1U2DlzOLJ74gdvaIkwy4qyOCkXi_YJFFdE1EDyovjEsQ__iiX0IM1ONfHKB',
          'absmartly-endpoint': 'https://dev-1.absmartly.com/v1',
          'absmartly-env': 'development',
          'absmartly-auth-method': 'apikey',
          absmartlyConfig: {
            apiKey: 'BxYKd1U2DlzOLJ74gdvaIkwy4qyOCkXi_YJFFdE1EDyovjEsQ__iiX0IM1ONfHKB',
            apiEndpoint: 'https://dev-1.absmartly.com/v1',
            environment: 'development',
            authMethod: 'apikey'
          }
        }

        chrome.storage = {
          local: {
            get: (keys: any, callback: any) => {
              const result: any = {}
              if (Array.isArray(keys)) {
                keys.forEach(key => {
                  result[key] = storageData[key]
                })
              } else if (typeof keys === 'string') {
                result[keys] = storageData[keys]
              } else if (keys === null || keys === undefined) {
                Object.assign(result, storageData)
              }
              if (callback) callback(result)
              return Promise.resolve(result)
            },
            set: (items: any, callback?: any) => {
              Object.assign(storageData, items)
              if (callback) callback()
              return Promise.resolve()
            }
          }
        }
      }

      console.log('✅ Background runner initialized with real API support')
    }, buildPath)
  }
}