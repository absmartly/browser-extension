import React, { useState, useEffect } from "react"
import {
  TrashIcon,
  PauseIcon,
  PlayIcon,
  ArrowPathIcon
} from "@heroicons/react/24/outline"
import { EventDetailsModal } from "./EventDetailsModal"
import { Header } from "./Header"

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
  const [selectedEvent, setSelectedEvent] = useState<SDKEvent | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    // Fetch buffered events on mount
    chrome.runtime.sendMessage({ type: 'GET_BUFFERED_EVENTS' }, (response) => {
      if (response?.success && response.events) {
        setEvents(response.events)
      }
    })

    // Listen for real-time SDK events broadcast from background script
    const handleRuntimeMessage = (
      message: any,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      if (message.type === 'SDK_EVENT_BROADCAST' && !isPaused) {
        const sdkEvent: SDKEvent = {
          id: `${Date.now()}-${Math.random()}`,
          eventName: message.payload.eventName,
          data: message.payload.data,
          timestamp: message.payload.timestamp
        }
        // Events are now stored newest-last, so append to end
        setEvents((prev) => [...prev, sdkEvent])
      }
    }

    chrome.runtime.onMessage.addListener(handleRuntimeMessage)
    return () => chrome.runtime.onMessage.removeListener(handleRuntimeMessage)
  }, [isPaused])

  const clearEvents = () => {
    setEvents([])
    setSelectedEvent(null)
    chrome.runtime.sendMessage({ type: 'CLEAR_BUFFERED_EVENTS' })
  }

  const handleEventClick = (event: SDKEvent) => {
    setSelectedEvent(event)
    setIsModalOpen(true)
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
              onClick={clearEvents}
              className="p-2 text-gray-700 hover:bg-gray-200 rounded"
              title="Clear all events">
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        }
      />

      {/* Events List */}
      <div className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <ArrowPathIcon className="w-12 h-12 mb-2 opacity-50" />
            <p className="font-medium">No events captured yet</p>
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
                    className="p-3 border rounded-lg cursor-pointer hover:shadow-md transition-shadow bg-white">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold rounded border whitespace-nowrap ${getEventColor(
                          event.eventName
                        )}`}>
                        {event.eventName}
                      </span>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
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
        <div className="p-2 bg-yellow-50 text-yellow-800 text-sm text-center border-t border-yellow-200">
          Event capture paused
        </div>
      )}

      <div className="p-2 bg-gray-50 text-gray-600 text-sm text-center border-t border-gray-200">
        {events.length} event{events.length !== 1 ? "s" : ""} captured
      </div>

      {/* Event Details Modal */}
      <EventDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        event={selectedEvent}
      />
    </div>
  )
}
