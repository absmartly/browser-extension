import {
  bufferSDKEvent,
  getBufferedEvents,
  clearBufferedEvents,
  SDKEvent
} from "../event-buffer"

const mockSessionStorage = {
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn()
}

jest.mock("@plasmohq/storage", () => ({
  Storage: jest.fn(() => mockSessionStorage)
}))
jest.mock("~src/utils/debug", () => ({
  debugLog: jest.fn(),
  debugError: jest.fn(),
  debugWarn: jest.fn()
}))

describe("event-buffer", () => {
  let mockSendMessage: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    mockSendMessage = jest.fn().mockResolvedValue(undefined)

    global.chrome = {
      runtime: {
        sendMessage: mockSendMessage
      }
    } as any

    jest.spyOn(console, "log").mockImplementation()
    jest.spyOn(console, "error").mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("bufferSDKEvent", () => {
    it("should buffer a new event", async () => {
      mockSessionStorage.get.mockResolvedValue([])
      mockSessionStorage.set.mockResolvedValue(undefined)

      await bufferSDKEvent("exposure", { experiment: "test" }, Date.now())

      expect(mockSessionStorage.set).toHaveBeenCalledWith(
        "sdk_events_buffer",
        expect.arrayContaining([
          expect.objectContaining({
            eventName: "exposure",
            data: { experiment: "test" }
          })
        ])
      )
    })

    it("should append to existing buffer", async () => {
      const existingEvents: SDKEvent[] = [
        {
          id: "existing-1",
          eventName: "exposure",
          data: { experiment: "old" },
          timestamp: Date.now() - 1000
        }
      ]

      mockSessionStorage.get.mockResolvedValue(existingEvents)
      mockSessionStorage.set.mockResolvedValue(undefined)

      await bufferSDKEvent("goal", { goal: "conversion" }, Date.now())

      expect(mockSessionStorage.set).toHaveBeenCalledWith(
        "sdk_events_buffer",
        expect.arrayContaining([
          expect.objectContaining({ eventName: "exposure" }),
          expect.objectContaining({ eventName: "goal" })
        ])
      )
    })

    it("should trim buffer to MAX_BUFFER_SIZE", async () => {
      const existingEvents: SDKEvent[] = new Array(1000).fill(null).map((_, i) => ({
        id: `event-${i}`,
        eventName: "exposure",
        data: {},
        timestamp: Date.now() - i
      }))

      mockSessionStorage.get.mockResolvedValue(existingEvents)
      mockSessionStorage.set.mockResolvedValue(undefined)

      await bufferSDKEvent("new-event", {}, Date.now())

      const savedBuffer = mockSessionStorage.set.mock.calls[0][1]
      expect(savedBuffer).toHaveLength(1000)
    })

    it("should generate unique event IDs", async () => {
      mockSessionStorage.get.mockResolvedValue([])
      mockSessionStorage.set.mockResolvedValue(undefined)

      await bufferSDKEvent("event1", {}, 1000)

      const firstCall = mockSessionStorage.set.mock.calls[0][1][0]
      const firstId = firstCall.id

      expect(firstId).toBeDefined()
      expect(firstId).toMatch(/^\d+-0\.\d+$/)
      expect(typeof firstId).toBe("string")
      expect(firstId).toContain("-")
    })

    it("should broadcast event via chrome.runtime.sendMessage", async () => {
      mockSessionStorage.get.mockResolvedValue([])
      mockSessionStorage.set.mockResolvedValue(undefined)

      const timestamp = Date.now()
      await bufferSDKEvent("exposure", { experiment: "test" }, timestamp)

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: "SDK_EVENT_BROADCAST",
        payload: {
          eventName: "exposure",
          data: { experiment: "test" },
          timestamp
        }
      })
    })

    it("should handle broadcast failure gracefully", async () => {
      mockSessionStorage.get.mockResolvedValue([])
      mockSessionStorage.set.mockResolvedValue(undefined)
      mockSendMessage.mockRejectedValue(new Error("No listeners"))

      await expect(bufferSDKEvent("exposure", {}, Date.now())).resolves.not.toThrow()
    })

    it("should throw error on storage failure", async () => {
      mockSessionStorage.get.mockRejectedValue(new Error("Storage error"))

      await expect(bufferSDKEvent("exposure", {}, Date.now())).rejects.toThrow("Storage error")
    })

    it("should keep newest events when trimming", async () => {
      const oldEvent: SDKEvent = {
        id: "old",
        eventName: "old-event",
        data: {},
        timestamp: 1000
      }

      const newerEvent: SDKEvent = {
        id: "newer",
        eventName: "newer-event",
        data: {},
        timestamp: 2000
      }

      mockSessionStorage.get.mockResolvedValue([oldEvent, newerEvent])
      mockSessionStorage.set.mockResolvedValue(undefined)

      await bufferSDKEvent("newest", {}, 3000)

      const savedBuffer = mockSessionStorage.set.mock.calls[0][1]
      expect(savedBuffer[savedBuffer.length - 1]).toMatchObject({
        eventName: "newest"
      })
    })
  })

  describe("getBufferedEvents", () => {
    it("should retrieve all buffered events", async () => {
      const events: SDKEvent[] = [
        {
          id: "1",
          eventName: "exposure",
          data: { experiment: "test1" },
          timestamp: Date.now()
        },
        {
          id: "2",
          eventName: "goal",
          data: { goal: "conversion" },
          timestamp: Date.now()
        }
      ]

      mockSessionStorage.get.mockResolvedValue(events)

      const result = await getBufferedEvents()

      expect(result).toEqual(events)
      expect(mockSessionStorage.get).toHaveBeenCalledWith("sdk_events_buffer")
    })

    it("should return empty array when no events buffered", async () => {
      mockSessionStorage.get.mockResolvedValue(null)

      const result = await getBufferedEvents()

      expect(result).toEqual([])
    })

    it("should throw error on storage failure", async () => {
      mockSessionStorage.get.mockRejectedValue(new Error("Storage error"))

      await expect(getBufferedEvents()).rejects.toThrow("Storage error")
    })
  })

  describe("clearBufferedEvents", () => {
    it("should clear all buffered events", async () => {
      mockSessionStorage.remove.mockResolvedValue(undefined)

      await clearBufferedEvents()

      expect(mockSessionStorage.remove).toHaveBeenCalledWith("sdk_events_buffer")
    })

    it("should throw error on storage failure", async () => {
      mockSessionStorage.remove.mockRejectedValue(new Error("Storage error"))

      await expect(clearBufferedEvents()).rejects.toThrow("Storage error")
    })
  })

  describe("event structure", () => {
    it("should create events with all required fields", async () => {
      mockSessionStorage.get.mockResolvedValue([])
      mockSessionStorage.set.mockResolvedValue(undefined)

      const eventName = "test-event"
      const eventData = { foo: "bar" }
      const timestamp = Date.now()

      await bufferSDKEvent(eventName, eventData, timestamp)

      const savedEvent = mockSessionStorage.set.mock.calls[0][1][0]

      expect(savedEvent).toMatchObject({
        id: expect.any(String),
        eventName,
        data: eventData,
        timestamp
      })
    })

    it("should handle complex event data", async () => {
      mockSessionStorage.get.mockResolvedValue([])
      mockSessionStorage.set.mockResolvedValue(undefined)

      const complexData = {
        nested: {
          object: {
            value: 123
          }
        },
        array: [1, 2, 3],
        string: "test",
        number: 42,
        boolean: true
      }

      await bufferSDKEvent("complex", complexData, Date.now())

      const savedEvent = mockSessionStorage.set.mock.calls[0][1][0]
      expect(savedEvent.data).toEqual(complexData)
    })
  })

  describe("buffer size management", () => {
    it("should maintain exactly MAX_BUFFER_SIZE events", async () => {
      const events: SDKEvent[] = new Array(999).fill(null).map((_, i) => ({
        id: `event-${i}`,
        eventName: "event",
        data: {},
        timestamp: i
      }))

      mockSessionStorage.get.mockResolvedValue(events)
      mockSessionStorage.set.mockResolvedValue(undefined)

      await bufferSDKEvent("new", {}, 1000)

      const savedBuffer = mockSessionStorage.set.mock.calls[0][1]
      expect(savedBuffer).toHaveLength(1000)
    })

    it("should remove oldest events when over limit", async () => {
      const events: SDKEvent[] = new Array(1000).fill(null).map((_, i) => ({
        id: `event-${i}`,
        eventName: "event",
        data: { index: i },
        timestamp: i
      }))

      mockSessionStorage.get.mockResolvedValue(events)
      mockSessionStorage.set.mockResolvedValue(undefined)

      await bufferSDKEvent("newest", { index: 1000 }, 1000)

      const savedBuffer = mockSessionStorage.set.mock.calls[0][1]
      expect(savedBuffer[0].data.index).toBe(1)
      expect(savedBuffer[savedBuffer.length - 1].data.index).toBe(1000)
    })
  })
})
