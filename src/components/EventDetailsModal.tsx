import React, { useEffect, useRef } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface SDKEvent {
  id: string
  eventName: string
  data: any
  timestamp: string
}

interface EventDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  event: SDKEvent | null
}

export const EventDetailsModal: React.FC<EventDetailsModalProps> = ({
  isOpen,
  onClose,
  event
}) => {
  if (!isOpen || !event) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Event Details</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
            aria-label="Close modal">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-120px)]">
          <div className="space-y-4">
            {/* Event Type */}
            <div>
              <label className="text-sm font-medium text-gray-700">Event Type</label>
              <div className="mt-1 p-2 bg-gray-50 rounded border">
                {event.eventName}
              </div>
            </div>

            {/* Timestamp */}
            <div>
              <label className="text-sm font-medium text-gray-700">Timestamp</label>
              <div className="mt-1 p-2 bg-gray-50 rounded border">
                {new Date(event.timestamp).toLocaleString()}
              </div>
            </div>

            {/* Event Data */}
            <div>
              <label className="text-sm font-medium text-gray-700">Event Data</label>
              <div className="mt-1 p-3 bg-gray-50 rounded border font-mono text-sm overflow-x-auto">
                <pre>{event.data ? JSON.stringify(event.data, null, 2) : 'null'}</pre>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
