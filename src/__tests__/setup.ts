// Test setup file
import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'
import { config } from 'dotenv'
import fetch from 'node-fetch'
import EventSource from 'eventsource'

config({ path: '.env.development.local' })

// Add TextEncoder/TextDecoder/fetch/EventSource for jsdom environment
Object.assign(global, {
  TextEncoder,
  TextDecoder,
  fetch,
  EventSource,
})

// Mock chrome APIs for testing
const chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
  tabs: {
    query: jest.fn(),
  },
  scripting: {
    executeScript: jest.fn(),
  },
}

// Add global mock cookies and chrome API
;(global as any).__mockCookies = {}
;(global as any).chrome = chrome

// Only setup document.cookie if document exists (jsdom environment)
if (typeof document !== 'undefined') {
  Object.defineProperty(document, 'cookie', {
    get: () => {
      return Object.entries((global as any).__mockCookies)
        .map(([name, value]) => `${name}=${value}`)
        .join('; ')
    },
    set: (cookieString: string) => {
      const [nameValue] = cookieString.split(';')
      const eqIndex = nameValue.indexOf('=')
      if (eqIndex > 0) {
        const name = nameValue.substring(0, eqIndex).trim()
        const value = nameValue.substring(eqIndex + 1).trim()
        if (value) {
          (global as any).__mockCookies[name] = value
        } else {
          delete (global as any).__mockCookies[name]
        }
      }
    },
    configurable: true
  })
}

// Mock Plasmo data-base64 asset imports
jest.mock('data-base64:~assets/logo.png', () => 'data:image/png;base64,mocklogo', { virtual: true })