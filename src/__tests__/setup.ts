// Test setup file
import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'

// Add TextEncoder/TextDecoder for jsdom environment
Object.assign(global, {
  TextEncoder,
  TextDecoder,
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

Object.assign(global, { chrome })

// Mock document.cookie for browser environment tests
Object.defineProperty(document, 'cookie', {
  writable: true,
  value: '',
})

// Mock Plasmo data-base64 asset imports
jest.mock('data-base64:~assets/logo.png', () => 'data:image/png;base64,mocklogo', { virtual: true })