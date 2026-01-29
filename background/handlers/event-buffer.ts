import { Storage } from "@plasmohq/storage"
import { debugLog, debugError } from "~src/utils/debug"

const EVENT_BUFFER_KEY = "sdk_events_buffer"
const MAX_BUFFER_SIZE = 1000

export interface SDKEvent {
  id: string
  eventName: string
  data: any
  timestamp: number | string
}

/**
 * Buffers an SDK event and broadcasts it to all extension pages
 * @param payload Event payload containing eventName, data, and timestamp
 */
export async function bufferSDKEvent(payload: {
  eventName: string
  data: any
  timestamp: number | string
}): Promise<void> {
  const { eventName, data, timestamp } = payload

  const sessionStorage = new Storage({ area: "session" })

  try {
    const buffer = await sessionStorage.get(EVENT_BUFFER_KEY) as SDKEvent[] | null
    const events: SDKEvent[] = buffer || []

    const newEvent: SDKEvent = {
      id: `${Date.now()}-${Math.random()}`,
      eventName,
      data,
      timestamp
    }
    events.push(newEvent)

    const trimmedEvents = events.slice(-MAX_BUFFER_SIZE)

    await sessionStorage.set(EVENT_BUFFER_KEY, trimmedEvents)

    chrome.runtime.sendMessage({
      type: "SDK_EVENT_BROADCAST",
      payload: { eventName, data, timestamp }
    }).catch(() => {
      // Ignore - no listeners if sidebar not open
    })
  } catch (error) {
    console.error("[Background] ❌ Failed to buffer event:", error)
    debugError("[Background] Failed to buffer event:", error)
    throw error
  }
}

/**
 * Retrieves all buffered SDK events
 * @returns Array of buffered events
 */
export async function getBufferedEvents(): Promise<SDKEvent[]> {
  const sessionStorage = new Storage({ area: "session" })

  try {
    const events = await sessionStorage.get(EVENT_BUFFER_KEY) as SDKEvent[] | null
    return events || []
  } catch (error) {
    debugError("[Background] Failed to get buffered events:", error)
    throw error
  }
}

/**
 * Clears all buffered SDK events
 */
export async function clearBufferedEvents(): Promise<void> {
  const sessionStorage = new Storage({ area: "session" })

  try {
    await sessionStorage.remove(EVENT_BUFFER_KEY)
  } catch (error) {
    debugError("[Background] Failed to clear buffered events:", error)
    throw error
  }
}
