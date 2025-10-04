import React, { useState, useEffect } from "react"
import {
  TrashIcon,
  PauseIcon,
  PlayIcon,
  ArrowPathIcon
} from "@heroicons/react/24/outline"

interface SDKEvent {
  id: string
  eventName: string
  data: any
  timestamp: string
}

export default function EventsDebugPage() {
  const [events, setEvents] = useState<SDKEvent[]>([])
  const [isPaused, setIsPaused] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<SDKEvent | null>(null)

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (
        event.data &&
        event.data.source === "absmartly-page" &&
        event.data.type === "SDK_EVENT"
      ) {
        if (!isPaused) {
          const sdkEvent: SDKEvent = {
            id: `${Date.now()}-${Math.random()}`,
            eventName: event.data.payload.eventName,
            data: event.data.payload.data,
            timestamp: event.data.payload.timestamp
          }
          setEvents((prev) => [sdkEvent, ...prev])
        }
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [isPaused])

  const clearEvents = () => {
    setEvents([])
    setSelectedEvent(null)
  }

  const getEventColor = (eventName: string) => {
    const colors: Record<string, string> = {
      error: "text-red-600 bg-red-50",
      ready: "text-green-600 bg-green-50",
      refresh: "text-blue-600 bg-blue-50",
      publish: "text-purple-600 bg-purple-50",
      exposure: "text-orange-600 bg-orange-50",
      goal: "text-yellow-600 bg-yellow-50",
      finalize: "text-gray-600 bg-gray-50"
    }
    return colors[eventName] || "text-gray-600 bg-gray-50"
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
    <div className="flex h-full">
      {/* Events List */}
      <div className="flex flex-col w-1/2 border-r border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold">SDK Events</h2>
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
        </div>

        <div className="flex-1 overflow-y-auto">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <ArrowPathIcon className="w-12 h-12 mb-2 opacity-50" />
              <p>No events captured yet</p>
              <p className="text-sm">
                SDK events will appear here in real-time
              </p>
            </div>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                  selectedEvent?.id === event.id ? "bg-blue-50" : ""
                }`}>
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded ${getEventColor(
                      event.eventName
                    )}`}>
                    {event.eventName}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
                {event.data && (
                  <div className="text-xs text-gray-600 truncate">
                    {typeof event.data === "object"
                      ? JSON.stringify(event.data).substring(0, 100)
                      : String(event.data).substring(0, 100)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {isPaused && (
          <div className="p-2 bg-yellow-50 text-yellow-800 text-sm text-center border-t border-yellow-200">
            Event capture paused
          </div>
        )}

        <div className="p-2 bg-gray-50 text-gray-600 text-xs text-center border-t border-gray-200">
          {events.length} event{events.length !== 1 ? "s" : ""} captured
        </div>
      </div>

      {/* Event Detail */}
      <div className="flex flex-col w-1/2">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold">Event Details</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {selectedEvent ? (
            <div>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Event Type
                </label>
                <span
                  className={`inline-block px-3 py-1 text-sm font-semibold rounded ${getEventColor(
                    selectedEvent.eventName
                  )}`}>
                  {selectedEvent.eventName}
                </span>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Timestamp
                </label>
                <div className="text-sm text-gray-900">
                  {new Date(selectedEvent.timestamp).toLocaleString()}
                </div>
              </div>

              {selectedEvent.data && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Event Data
                  </label>
                  <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-x-auto">
                    {JSON.stringify(selectedEvent.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>Select an event to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
