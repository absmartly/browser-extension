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
    }).catch((error) => {
      if (!error?.message?.includes('Receiving end does not exist') &&
          !error?.message?.includes('message port closed')) {
        console.error('[Event Buffer] Unexpected error broadcasting SDK event:', error)
      }
    })
  } catch (error) {
    console.error("[Background] ❌ Failed to buffer event:", error)
    debugError("[Background] Failed to buffer event:", error)
    throw error
  }
}

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

export async function clearBufferedEvents(): Promise<void> {
  const sessionStorage = new Storage({ area: "session" })

  try {
    await sessionStorage.remove(EVENT_BUFFER_KEY)
  } catch (error) {
    debugError("[Background] Failed to clear buffered events:", error)
    throw error
  }
}
