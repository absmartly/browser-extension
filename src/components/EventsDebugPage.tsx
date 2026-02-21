import React, { useState, useEffect } from "react"
import { debugLog, debugWarn } from '~src/utils/debug'
import {
  TrashIcon,
  PauseIcon,
  PlayIcon,
  ArrowPathIcon
} from "@heroicons/react/24/outline"
import { Header } from "./Header"
import { sendToContent, sendToBackground } from "~src/lib/messaging"

interface SDKEvent {
  id: string
  eventName: string
  data: any
  timestamp: string
}

interface EventsDebugPageProps {
  onBack: () => void
}

export default function EventsDebugPage({ onBack }: EventsDebugPageProps) {
  const [events, setEvents] = useState<SDKEvent[]>([])
  const [isPaused, setIsPaused] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // Use a ref for isPaused so the message handlers always see the current value
  const isPausedRef = React.useRef(isPaused)
  React.useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  useEffect(() => {
    debugLog('[EventsDebugPage] Component mounted, fetching buffered events...')

    // Fetch buffered events on mount
    const fetchBufferedEvents = async () => {
      try {
        const response = await sendToBackground({ type: 'GET_BUFFERED_EVENTS' })
        debugLog('[EventsDebugPage] GET_BUFFERED_EVENTS response:', response)
        const events = response?.events as SDKEvent[] | undefined
        if (response?.success && events) {
          debugLog('[EventsDebugPage] Loaded', events.length, 'buffered events')
          setEvents(events)
        } else {
          debugLog('[EventsDebugPage] No buffered events found')
        }
      } catch (error) {
        console.error('[EventsDebugPage] Error fetching buffered events:', error)
      }
    }

    fetchBufferedEvents()

    // Listen for real-time SDK events broadcast from background script
    const handleRuntimeMessage = (
      message: any,
      sender?: chrome.runtime.MessageSender,
      sendResponse?: (response?: any) => void
    ) => {
      debugLog('[EventsDebugPage] Received runtime message:', message.type, message)
      if (message.type === 'SDK_EVENT_BROADCAST') {
        if (!isPausedRef.current) {
          debugLog('[EventsDebugPage] SDK_EVENT_BROADCAST received, adding event:', message.payload)
          const sdkEvent: SDKEvent = {
            id: `${Date.now()}-${Math.random()}`,
            eventName: message.payload.eventName,
            data: message.payload.data,
            timestamp: message.payload.timestamp
          }
          // Events are now stored newest-last, so append to end
          setEvents((prev) => {
            debugLog('[EventsDebugPage] Adding event to list. Current count:', prev.length, 'New count:', prev.length + 1)
            return [...prev, sdkEvent]
          })
        } else {
          debugLog('[EventsDebugPage] SDK_EVENT_BROADCAST received but capture is paused')
        }
      }
    }

    debugLog('[EventsDebugPage] Registered message listeners')
    chrome.runtime.onMessage.addListener(handleRuntimeMessage)

    return () => {
      debugLog('[EventsDebugPage] Removing message listeners')
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage)
    }
  }, [])

  const handleClearClick = () => {
    setShowClearConfirm(true)
  }

  const confirmClearEvents = async () => {
    setEvents([])
    try {
      await sendToBackground({ type: 'CLEAR_BUFFERED_EVENTS' })
    } catch (error) {
      console.error('[EventsDebugPage] Error clearing buffered events:', error)
    }
    setShowClearConfirm(false)
  }

  const cancelClear = () => {
    setShowClearConfirm(false)
  }

  const handleEventClick = async (event: SDKEvent) => {
    // Send message to content script to open event viewer (outside sidebar)
    try {
      await sendToContent({
        type: 'OPEN_EVENT_VIEWER',
        data: {
          eventName: event.eventName,
          timestamp: new Date(event.timestamp).toLocaleString(),
          value: event.data ? JSON.stringify(event.data, null, 2) : 'null'
        }
      })
    } catch (error) {
      console.error('[EventsDebugPage] Error opening event viewer:', error)
    }
  }

  const getEventColor = (eventName: string) => {
    const colors: Record<string, string> = {
      error: "text-red-600 bg-red-50 border-red-200",
      ready: "text-green-600 bg-green-50 border-green-200",
      refresh: "text-blue-600 bg-blue-50 border-blue-200",
      publish: "text-purple-600 bg-purple-50 border-purple-200",
      exposure: "text-orange-600 bg-orange-50 border-orange-200",
      goal: "text-yellow-600 bg-yellow-50 border-yellow-200",
      finalize: "text-gray-600 bg-gray-50 border-gray-200"
    }
    return colors[eventName] || "text-gray-600 bg-gray-50 border-gray-200"
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3
    })
  }

  return (
    <div className="p-4 flex flex-col h-full">
      <Header
        title="SDK Events"
        onBack={onBack}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="p-2 text-gray-700 hover:bg-gray-200 rounded"
              title={isPaused ? "Resume" : "Pause"}>
              {isPaused ? (
                <PlayIcon className="w-5 h-5" />
              ) : (
                <PauseIcon className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={handleClearClick}
              className="p-2 text-gray-700 hover:bg-gray-200 rounded"
              title="Clear all events">
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        }
      />

      {/* Events List */}
      <div id="events-debug-event-list" className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <ArrowPathIcon className="w-12 h-12 mb-2 opacity-50" />
            <p id="events-debug-empty-state" className="font-medium">No events captured yet</p>
            <p className="text-sm">
              SDK events will appear here in real-time
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {/* Display events in reverse order (newest first) using reverse iteration */}
            {(() => {
              const eventElements = []
              for (let i = events.length - 1; i >= 0; i--) {
                const event = events[i]
                eventElements.push(
                  <div
                    key={event.id}
                    onClick={() => handleEventClick(event)}
                    data-testid="event-item"
                    data-event-name={event.eventName}
                    className="p-3 border rounded-lg cursor-pointer hover:shadow-md transition-shadow bg-white">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        data-testid="event-badge"
                        className={`px-2 py-0.5 text-xs font-semibold rounded border whitespace-nowrap ${getEventColor(
                          event.eventName
                        )}`}>
                        {event.eventName}
                      </span>
                      <span data-testid="event-timestamp" className="text-xs text-gray-500 whitespace-nowrap">
                        {formatTimestamp(event.timestamp)}
                      </span>
                    </div>
                    {event.data && (
                      <div className="text-xs text-gray-600 font-mono bg-gray-50 p-2 rounded mt-2 overflow-hidden">
                        <div className="truncate">
                          {typeof event.data === "object"
                            ? JSON.stringify(event.data).substring(0, 100) +
                              (JSON.stringify(event.data).length > 100 ? "..." : "")
                            : String(event.data).substring(0, 100) +
                              (String(event.data).length > 100 ? "..." : "")}
                        </div>
                      </div>
                    )}
                  </div>
                )
              }
              return eventElements
            })()}
          </div>
        )}
      </div>

      {/* Status Bar */}
      {isPaused && (
        <div id="events-debug-pause-status" className="p-2 bg-yellow-50 text-yellow-800 text-sm text-center border-t border-yellow-200">
          Event capture paused
        </div>
      )}

      <div id="events-debug-event-count" className="p-2 bg-gray-50 text-gray-600 text-sm text-center border-t border-gray-200">
        {events.length} event{events.length !== 1 ? "s" : ""} captured
      </div>

      {/* Clear Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Clear All Events?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              This will clear all {events.length} captured event{events.length !== 1 ? "s" : ""} from the list. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelClear}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                id="clear-all-button"
                onClick={confirmClearEvents}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
