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
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen || !event) return

    // Send message to content script to open the read-only JSON viewer
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'OPEN_EVENT_VIEWER',
          data: {
            eventName: event.eventName,
            timestamp: new Date(event.timestamp).toLocaleString(),
            value: event.data ? JSON.stringify(event.data, null, 2) : 'null'
          }
        })
      }
    })

    const handleMessage = (message: any) => {
      if (message.type === 'EVENT_VIEWER_CLOSE') {
        onCloseRef.current()
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'CLOSE_EVENT_VIEWER'
          })
        }
      })
    }
  }, [isOpen, event])

  return null
}
