// Test setup file
import '@testing-library/jest-dom'

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