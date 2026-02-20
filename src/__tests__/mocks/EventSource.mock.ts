/**
 * EventSource mock for Jest tests
 * Simulates server-sent events for bridge integration tests
 */

export class MockEventSource {
  url: string
  readyState: number = 0
  onmessage: ((event: any) => void) | null = null
  onerror: ((event: any) => void) | null = null
  onopen: ((event: any) => void) | null = null

  constructor(url: string) {
    this.url = url
    this.readyState = 1 // OPEN

    // Simulate successful connection
    setTimeout(() => {
      if (this.onopen) {
        this.onopen({ type: 'open' })
      }
    }, 10)
  }

  close() {
    this.readyState = 2 // CLOSED
  }

  // Simulate receiving a message from the bridge
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({
        type: 'message',
        data: typeof data === 'string' ? data : JSON.stringify(data)
      })
    }
  }

  // Simulate an error
  simulateError(error: any) {
    if (this.onerror) {
      this.onerror({
        type: 'error',
        message: error.message || 'Connection error',
        ...error
      })
    }
  }

  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 2
}
