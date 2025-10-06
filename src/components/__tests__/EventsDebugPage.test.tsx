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

  beforeAll(() => {
    // Mock chrome.runtime and chrome.tabs
    global.chrome = {
      runtime: {
        sendMessage: mockSendMessage,
        onMessage: {
          addListener: jest.fn(),
          removeListener: jest.fn()
        }
      },
      tabs: {
        query: jest.fn((query, callback) => {
          callback([{ id: 1 }])
        }),
        sendMessage: jest.fn()
      }
    } as any
  })

  // Helper to dispatch SDK events wrapped in act()
  const dispatchSDKEvent = (eventName: string, data: any = null, timestamp?: string) => {
    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          source: 'absmartly-page',
          type: 'SDK_EVENT',
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
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Initial State', () => {
    it('renders empty state when no events', () => {
      render(<EventsDebugPage />)

      expect(screen.getByText('SDK Events')).toBeInTheDocument()
      expect(screen.getByText('No events captured yet')).toBeInTheDocument()
      expect(screen.getByText('SDK events will appear here in real-time')).toBeInTheDocument()
      expect(screen.getByText('0 events captured')).toBeInTheDocument()
    })

    it('renders pause and clear buttons', () => {
      render(<EventsDebugPage />)

      const pauseButton = screen.getByTitle('Pause')
      const clearButton = screen.getByTitle('Clear all events')

      expect(pauseButton).toBeInTheDocument()
      expect(clearButton).toBeInTheDocument()
    })
  })

  describe('Event Capture', () => {
    it('captures SDK events from postMessage', async () => {
      render(<EventsDebugPage />)

      dispatchSDKEvent('ready', { experiments: ['exp1', 'exp2'] })

      await waitFor(() => {
        expect(screen.getByText('ready')).toBeInTheDocument()
        expect(screen.getByText('1 event captured')).toBeInTheDocument()
      })
    })

    it('captures multiple events in chronological order (newest first)', async () => {
      render(<EventsDebugPage />)

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
      render(<EventsDebugPage />)

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
      render(<EventsDebugPage />)

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
      render(<EventsDebugPage />)

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
    it('clears all events when clear button clicked', async () => {
      render(<EventsDebugPage />)

      // Add some events
      dispatchSDKEvent('ready', null)

      dispatchSDKEvent('exposure', { experiment: 'test' })

      await waitFor(() => {
        expect(screen.getByText('2 events captured')).toBeInTheDocument()
      })

      // Clear events
      const clearButton = screen.getByTitle('Clear all events')
      fireEvent.click(clearButton)

      await waitFor(() => {
        expect(screen.getByText('No events captured yet')).toBeInTheDocument()
        expect(screen.getByText('0 events captured')).toBeInTheDocument()
        expect(screen.queryByText('ready')).not.toBeInTheDocument()
        expect(screen.queryByText('exposure')).not.toBeInTheDocument()
      })
    })

    it('clears selected event when clearing all events', async () => {
      render(<EventsDebugPage />)

      // Add event
      dispatchSDKEvent('ready', { test: 'data' })

      await waitFor(() => {
        expect(screen.getByText('ready')).toBeInTheDocument()
      })

      // Select event
      const eventItem = screen.getByText('ready').closest('div')
      if (eventItem) {
        fireEvent.click(eventItem)
      }

      await waitFor(() => {
        expect(screen.getByText('Event Details')).toBeInTheDocument()
      })

      // Clear all
      const clearButton = screen.getByTitle('Clear all events')
      fireEvent.click(clearButton)

      await waitFor(() => {
        expect(screen.getByText('Select an event to view details')).toBeInTheDocument()
      })
    })
  })

  describe('Event Selection and Details', () => {
    it('displays event details when event is clicked', async () => {
      render(<EventsDebugPage />)

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

      await waitFor(() => {
        // Verify event type is shown
        const eventTypeBadges = screen.getAllByText('exposure')
        expect(eventTypeBadges.length).toBeGreaterThan(1) // One in list, one in details

        // Verify data is shown as JSON
        const detailsPanel = screen.getByText('Event Data').parentElement
        expect(detailsPanel).toHaveTextContent('experiment')
        expect(detailsPanel).toHaveTextContent('test_exp')
      })
    })

    it('highlights selected event in list', async () => {
      render(<EventsDebugPage />)

      // Add two events
      dispatchSDKEvent('ready', null)

      dispatchSDKEvent('exposure', null)

      await waitFor(() => {
        expect(screen.getByText('2 events captured')).toBeInTheDocument()
      })

      // Click first event (exposure - newest)
      const exposureBadge = screen.getByText('exposure')
      // Get the parent container div (the one with cursor-pointer class)
      const eventContainer = exposureBadge.closest('.cursor-pointer')

      if (eventContainer) {
        fireEvent.click(eventContainer)

        await waitFor(() => {
          expect(eventContainer).toHaveClass('bg-blue-50')
        })
      }
    })
  })

  describe('Event Data Formatting', () => {
    it('truncates long event data preview in list', async () => {
      render(<EventsDebugPage />)

      const longData = {
        message: 'a'.repeat(150),
        nested: { deep: { value: 'test' } }
      }

      dispatchSDKEvent('goal', longData)

      await waitFor(() => {
        expect(screen.getByText('goal')).toBeInTheDocument()
      })

      // Preview should be truncated to 100 characters
      const dataPreview = screen.getByText(/aaa/)
      expect(dataPreview.textContent?.length).toBeLessThanOrEqual(100)
    })

    it('shows full data in details panel', async () => {
      render(<EventsDebugPage />)

      const testData = {
        experiment: 'test_exp',
        variant: 1,
        metadata: { foo: 'bar', baz: 123 }
      }

      dispatchSDKEvent('exposure', testData)

      await waitFor(() => {
        expect(screen.getByText('exposure')).toBeInTheDocument()
      })

      // Click event to view details
      const eventItem = screen.getByText('exposure').closest('div')
      if (eventItem) {
        fireEvent.click(eventItem)
      }

      await waitFor(() => {
        // Full JSON should be visible - check for text content
        const detailsPanel = screen.getByText('Event Data').parentElement
        expect(detailsPanel).toHaveTextContent('experiment')
        expect(detailsPanel).toHaveTextContent('test_exp')
        expect(detailsPanel).toHaveTextContent('metadata')
        expect(detailsPanel).toHaveTextContent('foo')
        expect(detailsPanel).toHaveTextContent('bar')
      })
    })
  })

  describe('Timestamp Formatting', () => {
    it('formats timestamp as HH:MM:SS.mmm in event list', async () => {
      render(<EventsDebugPage />)

      const timestamp = '2025-01-01T14:30:45.123Z'

      dispatchSDKEvent('ready', null, timestamp)

      await waitFor(() => {
        // Should show time in HH:MM:SS.mmm format
        expect(screen.getByText(/\d{2}:\d{2}:\d{2}\.\d{3}/)).toBeInTheDocument()
      })
    })

    it('shows full timestamp in details panel', async () => {
      render(<EventsDebugPage />)

      const timestamp = '2025-01-01T14:30:45.123Z'

      dispatchSDKEvent('ready', null, timestamp)

      await waitFor(() => {
        expect(screen.getByText('ready')).toBeInTheDocument()
      })

      // Click event
      const eventItem = screen.getByText('ready').closest('div')
      if (eventItem) {
        fireEvent.click(eventItem)
      }

      await waitFor(() => {
        // Should show full date/time
        expect(screen.getByText(/1\/1\/2025/)).toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases', () => {
    it('handles events without data', async () => {
      render(<EventsDebugPage />)

      dispatchSDKEvent('finalize', null)

      await waitFor(() => {
        expect(screen.getByText('finalize')).toBeInTheDocument()
        expect(screen.getByText('1 event captured')).toBeInTheDocument()
      })
    })

    it('ignores non-SDK events', async () => {
      render(<EventsDebugPage />)

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
      render(<EventsDebugPage />)

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
