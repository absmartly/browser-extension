import { Page } from '@playwright/test'

export class BackgroundRunner {
  private page: Page

  constructor(page: Page) {
    this.page = page
  }

  async initialize(buildPath: string) {
    // Inject the background script functionality into the test page
    await this.page.evaluate((buildPath) => {
      // Create mock chrome API with real message passing
      if (!(window as any).chrome) {
        (window as any).chrome = {}
      }

      const chrome = (window as any).chrome

      // Message listeners for background script behavior
      const messageListeners: any[] = []
      const externalMessageListeners: any[] = []

      // Mock chrome.runtime API
      chrome.runtime = chrome.runtime || {}
      chrome.runtime.onMessage = {
        addListener: (callback: any) => {
          messageListeners.push(callback)
        }
      }

      chrome.runtime.onMessageExternal = {
        addListener: (callback: any) => {
          externalMessageListeners.push(callback)
        }
      }

      // Create a real sendMessage that routes to background handlers
      const originalSendMessage = chrome.runtime.sendMessage
      chrome.runtime.sendMessage = async (message: any, callback?: any) => {
        console.log('Intercepted sendMessage:', message)

        // Handle API_REQUEST messages directly
        if (message.type === 'API_REQUEST') {
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

            if (callback) {
              callback(result)
            }
            return result
          } catch (error: any) {
            const errorResult = { success: false, error: error.message }
            if (callback) {
              callback(errorResult)
            }
            return errorResult
          }
        }

        // For other messages, call the original or registered listeners
        for (const listener of messageListeners) {
          listener(message, {}, callback)
        }

        if (originalSendMessage) {
          return originalSendMessage(message, callback)
        }
      }

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