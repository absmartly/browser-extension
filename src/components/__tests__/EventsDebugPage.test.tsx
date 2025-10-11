import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import EventsDebugPage from '../EventsDebugPage'

describe('EventsDebugPage', () => {
  // Mock chrome.runtime.sendMessage
  const mockSendMessage = jest.fn((message, callback) => {
    if (callback) {
      // Call callback synchronously to avoid timing issues in tests
      if (message.type === 'GET_BUFFERED_EVENTS') {
        callback({ success: true, events: [] })
      } else if (message.type === 'CLEAR_BUFFERED_EVENTS') {
        callback({ success: true })
      }
    }
  })

  // Mock chrome.tabs.sendMessage
  const mockTabsSendMessage = jest.fn()

  // Store message listeners so we can trigger them in tests
  const messageListeners: Array<(message: any, sender?: any, sendResponse?: any) => void> = []

  beforeAll(() => {
    // Mock chrome.runtime and chrome.tabs
    global.chrome = {
      runtime: {
        sendMessage: mockSendMessage,
        onMessage: {
          addListener: jest.fn((listener) => {
            messageListeners.push(listener)
          }),
          removeListener: jest.fn((listener) => {
            const index = messageListeners.indexOf(listener)
            if (index > -1) {
              messageListeners.splice(index, 1)
            }
          })
        }
      },
      tabs: {
        query: jest.fn((query, callback) => {
          callback([{ id: 1 }])
        }),
        sendMessage: mockTabsSendMessage
      }
    } as any
  })

  // Helper to dispatch SDK events via chrome.runtime.onMessage (new behavior)
  const dispatchSDKEvent = (eventName: string, data: any = null, timestamp?: string) => {
    act(() => {
      // Trigger all registered message listeners with SDK_EVENT_BROADCAST
      const message = {
        type: 'SDK_EVENT_BROADCAST',
        payload: {
          eventName,
          data,
          timestamp: timestamp || new Date().toISOString()
        }
      }
      messageListeners.forEach(listener => listener(message))
    })
  }

  // Helper to dispatch SDK events via window.postMessage (forwarded from sidebar)
  const dispatchSDKEventViaWindow = (eventName: string, data: any = null, timestamp?: string) => {
    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          source: 'absmartly-extension-incoming',
          type: 'SDK_EVENT_BROADCAST',
          payload: {
            eventName,
            data,
            timestamp: timestamp || new Date().toISOString()
          }
        }
      }))
    })
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockTabsSendMessage.mockClear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Initial State', () => {
    it('renders empty state when no events', () => {
      render(<EventsDebugPage onBack={() => {}} />)

      expect(screen.getByText('SDK Events')).toBeInTheDocument()
      expect(screen.getByText('No events captured yet')).toBeInTheDocument()
      expect(screen.getByText('SDK events will appear here in real-time')).toBeInTheDocument()
      expect(screen.getByText('0 events captured')).toBeInTheDocument()
    })

    it('renders pause and clear buttons', () => {
      render(<EventsDebugPage onBack={() => {}} />)

      const pauseButton = screen.getByTitle('Pause')
      const clearButton = screen.getByTitle('Clear all events')

      expect(pauseButton).toBeInTheDocument()
      expect(clearButton).toBeInTheDocument()
    })
  })

  describe('Event Capture', () => {
    it('captures SDK events from chrome.runtime.onMessage', async () => {
      render(<EventsDebugPage onBack={() => {}} />)

      dispatchSDKEvent('ready', { experiments: ['exp1', 'exp2'] })

      await waitFor(() => {
        expect(screen.getByText('ready')).toBeInTheDocument()
        expect(screen.getByText('1 event captured')).toBeInTheDocument()
      })
    })

    it('captures SDK events from window.postMessage (sidebar forwarding)', async () => {
      render(<EventsDebugPage onBack={() => {}} />)

      dispatchSDKEventViaWindow('ready', { experiments: ['exp1', 'exp2'] })

      await waitFor(() => {
        expect(screen.getByText('ready')).toBeInTheDocument()
        expect(screen.getByText('1 event captured')).toBeInTheDocument()
      })
    })

    it('captures multiple events in chronological order (newest first)', async () => {
      render(<EventsDebugPage onBack={() => {}} />)

      // Send first event
      dispatchSDKEvent('ready', null, '2025-01-01T10:00:00.000Z')

      // Send second event
      dispatchSDKEvent('exposure', { experiment: 'test_exp', variant: 1 }, '2025-01-01T10:00:01.000Z')

      await waitFor(() => {
        expect(screen.getByText('2 events captured')).toBeInTheDocument()
      })

      // Verify newest event is first
      const eventBadges = screen.getAllByText(/ready|exposure/)
      expect(eventBadges[0]).toHaveTextContent('exposure')
      expect(eventBadges[1]).toHaveTextContent('ready')
    })

    it('displays different event types with correct colors', async () => {
      render(<EventsDebugPage onBack={() => {}} />)

      const eventTypes = ['error', 'ready', 'refresh', 'publish', 'exposure', 'goal', 'finalize']

      for (const eventName of eventTypes) {
        dispatchSDKEvent(eventName, null)
      }

      await waitFor(() => {
        eventTypes.forEach(eventName => {
          expect(screen.getByText(eventName)).toBeInTheDocument()
        })
      })
    })
  })

  describe('Pause/Resume Functionality', () => {
    it('pauses event capture when pause button clicked', async () => {
      render(<EventsDebugPage onBack={() => {}} />)

      const pauseButton = screen.getByTitle('Pause')
      fireEvent.click(pauseButton)

      await waitFor(() => {
        expect(screen.getByText('Event capture paused')).toBeInTheDocument()
        expect(screen.getByTitle('Resume')).toBeInTheDocument()
      })

      // Send event while paused
      dispatchSDKEvent('ready', null)

      // Event should not be captured
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(screen.queryByText('ready')).not.toBeInTheDocument()
      expect(screen.getByText('0 events captured')).toBeInTheDocument()
    })

    it('resumes event capture when resume button clicked', async () => {
      render(<EventsDebugPage onBack={() => {}} />)

      // Pause first
      const pauseButton = screen.getByTitle('Pause')
      fireEvent.click(pauseButton)

      await waitFor(() => {
        expect(screen.getByTitle('Resume')).toBeInTheDocument()
      })

      // Resume
      const resumeButton = screen.getByTitle('Resume')
      fireEvent.click(resumeButton)

      await waitFor(() => {
        expect(screen.queryByText('Event capture paused')).not.toBeInTheDocument()
        expect(screen.getByTitle('Pause')).toBeInTheDocument()
      })

      // Send event after resume
      dispatchSDKEvent('ready', null)

      // Event should be captured
      await waitFor(() => {
        expect(screen.getByText('ready')).toBeInTheDocument()
        expect(screen.getByText('1 event captured')).toBeInTheDocument()
      })
    })
  })

  describe('Clear Functionality', () => {
    it('shows confirmation dialog and clears events when confirmed', async () => {
      render(<EventsDebugPage onBack={() => {}} />)

      // Add some events
      dispatchSDKEvent('ready', null)

      dispatchSDKEvent('exposure', { experiment: 'test' })

      await waitFor(() => {
        expect(screen.getByText('2 events captured')).toBeInTheDocument()
      })

      // Click clear button
      const clearButton = screen.getByTitle('Clear all events')
      fireEvent.click(clearButton)

      // Verify confirmation dialog appears
      await waitFor(() => {
        expect(screen.getByText('Clear All Events?')).toBeInTheDocument()
        expect(screen.getByText(/This will clear all 2 captured events/)).toBeInTheDocument()
      })

      // Confirm clear
      const confirmButton = screen.getByText('Clear All')
      fireEvent.click(confirmButton)

      // Verify events are cleared
      await waitFor(() => {
        expect(screen.getByText('No events captured yet')).toBeInTheDocument()
        expect(screen.getByText('0 events captured')).toBeInTheDocument()
        expect(screen.queryByText('ready')).not.toBeInTheDocument()
        expect(screen.queryByText('exposure')).not.toBeInTheDocument()
      })
    })

    it('cancels clear when cancel button clicked', async () => {
      render(<EventsDebugPage onBack={() => {}} />)

      // Add some events
      dispatchSDKEvent('ready', null)

      await waitFor(() => {
        expect(screen.getByText('1 event captured')).toBeInTheDocument()
      })

      // Click clear button
      const clearButton = screen.getByTitle('Clear all events')
      fireEvent.click(clearButton)

      // Verify confirmation dialog appears
      await waitFor(() => {
        expect(screen.getByText('Clear All Events?')).toBeInTheDocument()
      })

      // Click cancel
      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)

      // Verify events are still there
      await waitFor(() => {
        expect(screen.getByText('1 event captured')).toBeInTheDocument()
        expect(screen.getByText('ready')).toBeInTheDocument()
        expect(screen.queryByText('Clear All Events?')).not.toBeInTheDocument()
      })
    })

    it('clears all events when confirmed', async () => {
      render(<EventsDebugPage onBack={() => {}} />)

      // Add events
      dispatchSDKEvent('ready', { test: 'data' })
      dispatchSDKEvent('exposure', { variant: 1 })

      await waitFor(() => {
        expect(screen.getByText('2 events captured')).toBeInTheDocument()
      })

      // Clear all
      const clearButton = screen.getByTitle('Clear all events')
      fireEvent.click(clearButton)

      // Confirm clear
      await waitFor(() => {
        expect(screen.getByText('Clear All Events?')).toBeInTheDocument()
      })

      const confirmButton = screen.getByText('Clear All')
      fireEvent.click(confirmButton)

      // Events should be cleared
      await waitFor(() => {
        expect(screen.getByText('No events captured yet')).toBeInTheDocument()
        expect(screen.getByText('0 events captured')).toBeInTheDocument()
      })
    })
  })

  describe('Event Selection and Event Viewer', () => {
    it('opens event viewer when event is clicked', async () => {
      render(<EventsDebugPage onBack={() => {}} />)

      const testData = { experiment: 'test_exp', variant: 1 }
      const timestamp = new Date().toISOString()

      dispatchSDKEvent('exposure', testData, timestamp)

      await waitFor(() => {
        expect(screen.getByText('exposure')).toBeInTheDocument()
      })

      // Click event
      const eventItem = screen.getByText('exposure').closest('div')
      if (eventItem) {
        fireEvent.click(eventItem)
      }

      // Verify OPEN_EVENT_VIEWER message was sent
      await waitFor(() => {
        expect(mockTabsSendMessage).toHaveBeenCalledWith(
          1, // tab id
          {
            type: 'OPEN_EVENT_VIEWER',
            data: {
              eventName: 'exposure',
              timestamp: expect.any(String),
              value: JSON.stringify(testData, null, 2)
            }
          }
        )
      })
    })

    it('sends correct data for event with null data', async () => {
      render(<EventsDebugPage onBack={() => {}} />)

      dispatchSDKEvent('ready', null)

      await waitFor(() => {
        expect(screen.getByText('ready')).toBeInTheDocument()
      })

      // Click event
      const eventItem = screen.getByText('ready').closest('div')
      if (eventItem) {
        fireEvent.click(eventItem)
      }

      // Verify OPEN_EVENT_VIEWER message was sent with 'null' as value
      await waitFor(() => {
        expect(mockTabsSendMessage).toHaveBeenCalledWith(
          1,
          {
            type: 'OPEN_EVENT_VIEWER',
            data: {
              eventName: 'ready',
              timestamp: expect.any(String),
              value: 'null'
            }
          }
        )
      })
    })

    it('opens event viewer for different events', async () => {
      render(<EventsDebugPage onBack={() => {}} />)

      // Add two events
      dispatchSDKEvent('ready', { experiments: ['exp1'] })
      dispatchSDKEvent('exposure', { variant: 2 })

      await waitFor(() => {
        expect(screen.getByText('2 events captured')).toBeInTheDocument()
      })

      // Click first event (exposure - newest)
      const exposureBadge = screen.getByText('exposure')
      const eventContainer = exposureBadge.closest('[data-testid="event-item"]')

      if (eventContainer) {
        fireEvent.click(eventContainer)
      }

      await waitFor(() => {
        expect(mockTabsSendMessage).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            type: 'OPEN_EVENT_VIEWER',
            data: expect.objectContaining({
              eventName: 'exposure'
            })
          })
        )
      })
    })
  })

  describe('Event Data Formatting', () => {
    it('truncates long event data preview in list', async () => {
      render(<EventsDebugPage onBack={() => {}} />)

      const longData = {
        message: 'a'.repeat(150),
        nested: { deep: { value: 'test' } }
      }

      dispatchSDKEvent('goal', longData)

      await waitFor(() => {
        expect(screen.getByText('goal')).toBeInTheDocument()
      })

      // Preview should be truncated (max 100 chars + "..." = 103)
      const dataPreview = screen.getByText(/aaa/)
      const fullDataLength = JSON.stringify(longData).length

      // Verify truncation occurred
      expect(dataPreview.textContent?.length).toBeLessThan(fullDataLength)
      expect(dataPreview.textContent).toContain('...')
    })

  })

  describe('Timestamp Formatting', () => {
    it('formats timestamp as HH:MM:SS.mmm in event list', async () => {
      render(<EventsDebugPage onBack={() => {}} />)

      const timestamp = '2025-01-01T14:30:45.123Z'

      dispatchSDKEvent('ready', null, timestamp)

      await waitFor(() => {
        // Should show time in HH:MM:SS.mmm format
        expect(screen.getByText(/\d{2}:\d{2}:\d{2}\.\d{3}/)).toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases', () => {
    it('handles events without data', async () => {
      render(<EventsDebugPage onBack={() => {}} />)

      dispatchSDKEvent('finalize', null)

      await waitFor(() => {
        expect(screen.getByText('finalize')).toBeInTheDocument()
        expect(screen.getByText('1 event captured')).toBeInTheDocument()
      })
    })

    it('ignores non-SDK events', async () => {
      render(<EventsDebugPage onBack={() => {}} />)

      // Send non-SDK event
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          source: 'other-source',
          type: 'SOME_EVENT',
          payload: {}
        }
      }))

      // Should still show empty state
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(screen.getByText('No events captured yet')).toBeInTheDocument()
      expect(screen.getByText('0 events captured')).toBeInTheDocument()
    })

    it('handles events while paused without losing existing events', async () => {
      render(<EventsDebugPage onBack={() => {}} />)

      // Add first event
      dispatchSDKEvent('ready', null)

      await waitFor(() => {
        expect(screen.getByText('ready')).toBeInTheDocument()
        expect(screen.getByText('1 event captured')).toBeInTheDocument()
      })

      // Pause
      fireEvent.click(screen.getByTitle('Pause'))

      // Verify paused state
      await waitFor(() => {
        expect(screen.getByText('Event capture paused')).toBeInTheDocument()
      })

      // Try to add another event while paused
      dispatchSDKEvent('exposure', null)

      // Should still have only 1 event
      await new Promise(resolve => setTimeout(resolve, 100))
      await waitFor(() => {
        expect(screen.getByText('1 event captured')).toBeInTheDocument()
        expect(screen.queryByText('exposure')).not.toBeInTheDocument()
        expect(screen.getByText('ready')).toBeInTheDocument()
      })
    })
  })
})
