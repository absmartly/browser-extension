// Auth test mocks
// Provides mock setup/teardown for authentication tests

export const mockJWTToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0QGV4YW1wbGUuY29tIn0.signature'

export const mockAuthResponse = {
  user: {
    id: 1,
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User'
  }
}

let originalFetch: typeof global.fetch

export function setupAuthMocks() {
  originalFetch = global.fetch
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => mockAuthResponse
  } as Response)
}

export function resetAuthMocks() {
  global.fetch = originalFetch
  jest.restoreAllMocks()
}
