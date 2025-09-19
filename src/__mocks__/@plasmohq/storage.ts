// Create mock functions that can be spied on
const mockGet = jest.fn()
const mockSet = jest.fn()

export class Storage {
  get = mockGet
  set = mockSet

  constructor() {
    // Reset for each instance
    this.get = jest.fn()
    this.set = jest.fn()
  }
}

// Export for test access
export const __mockStorage = {
  get: mockGet,
  set: mockSet
}