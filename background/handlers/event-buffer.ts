import { Storage } from "@plasmohq/storage"
import { debugLog, debugError } from "~src/utils/debug"

const EVENT_BUFFER_KEY = "sdk_events_buffer"
const MAX_BUFFER_SIZE = 1000

export interface SDKEvent {
  id: string
  eventName: string
  data: any
  timestamp: number
}

/**
 * Buffers an SDK event and broadcasts it to all extension pages
 * @param eventName Name of the SDK event
 * @param data Event data
 * @param timestamp Event timestamp
 */
export async function bufferSDKEvent(
  eventName: string,
  data: any,
  timestamp: number
): Promise<void> {
  console.log("[Background] 🔵 Received SDK_EVENT:", { eventName, data, timestamp })

  const sessionStorage = new Storage({ area: "session" })

  try {
    const buffer = await sessionStorage.get(EVENT_BUFFER_KEY) as SDKEvent[] | null
    const events: SDKEvent[] = buffer || []
    console.log("[Background] Current buffer size:", events.length)

    const newEvent: SDKEvent = {
      id: `${Date.now()}-${Math.random()}`,
      eventName,
      data,
      timestamp
    }
    events.push(newEvent)
    console.log("[Background] ✅ Added event to buffer:", newEvent)

    const trimmedEvents = events.slice(-MAX_BUFFER_SIZE)

    await sessionStorage.set(EVENT_BUFFER_KEY, trimmedEvents)
    console.log("[Background] ✅ Event buffered, now broadcasting...")
    debugLog("[Background] SDK event buffered:", eventName)

    chrome.runtime.sendMessage({
      type: "SDK_EVENT_BROADCAST",
      payload: { eventName, data, timestamp }
    }).then(() => {
      console.log("[Background] ✅ SDK_EVENT_BROADCAST sent successfully")
    }).catch((err) => {
      console.log("[Background] ⚠️ No listeners for SDK_EVENT_BROADCAST (this is normal if sidebar not open):", err?.message)
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
    debugLog("[Background] Retrieved buffered events:", events?.length || 0)
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
    debugLog("[Background] Cleared buffered events")
  } catch (error) {
    debugError("[Background] Failed to clear buffered events:", error)
    throw error
  }
}
