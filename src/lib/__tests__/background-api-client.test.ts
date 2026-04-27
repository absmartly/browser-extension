import { BackgroundAPIClient } from "../background-api-client"

describe("BackgroundAPIClient", () => {
  let client: BackgroundAPIClient

  beforeEach(() => {
    client = new BackgroundAPIClient()
    ;(global as any).chrome = {
      runtime: {
        sendMessage: jest.fn()
      }
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("sendOperation - error handling", () => {
    it("should throw when background returns undefined (service worker crashed)", async () => {
      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue(undefined)

      await expect(client.getApplications()).rejects.toThrow(
        "Background service worker did not respond"
      )
    })

    it("should throw when background returns null", async () => {
      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue(null)

      await expect(client.getApplications()).rejects.toThrow(
        "Background service worker did not respond"
      )
    })

    it("should throw APIError on failure response", async () => {
      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
        success: false,
        error: "Unauthorized",
        isAuthError: true
      })

      await expect(client.getApplications()).rejects.toThrow("Unauthorized")
    })
  })

  describe("makeRequest - error handling", () => {
    it("should throw when background returns undefined", async () => {
      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue(undefined)

      await expect(client.getFavorites()).rejects.toThrow(
        "Background service worker did not respond"
      )
    })
  })

  describe("getExperiments", () => {
    it("should return experiments with pagination info", async () => {
      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          experiments: [{ id: 1, name: "Test" }],
          total: 100,
          has_more: true
        }
      })

      const result = await client.getExperiments({ page: 1, items: 25 })

      expect(result.experiments).toHaveLength(1)
      expect(result.total).toBe(100)
      expect(result.hasMore).toBe(true)
    })

    it("should use API_REQUEST for pagination support", async () => {
      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        data: { experiments: [] }
      })

      await client.getExperiments({ state: "running" } as any)

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: "API_REQUEST",
        method: "GET",
        path: "/experiments",
        data: { state: "running" }
      })
    })
  })

  describe("getExperiment", () => {
    it("should fetch single experiment via typed operation", async () => {
      const mockExperiment = { id: 42, name: "Test" }
      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        data: mockExperiment
      })

      const result = await client.getExperiment(42)

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: "API_OPERATION",
        operation: { op: "getExperiment", id: 42 }
      })
      expect(result).toEqual(mockExperiment)
    })
  })

  describe("setExperimentFavorite", () => {
    it("should send favoriteExperiment operation", async () => {
      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        data: undefined
      })

      await client.setExperimentFavorite(10, true)

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: "API_OPERATION",
        operation: { op: "favoriteExperiment", id: 10, favorite: true }
      })
    })
  })

  describe("getCustomSectionFields", () => {
    it("should fetch custom section fields successfully", async () => {
      const mockFields = [
        { id: 1, title: "Hypothesis", type: "text" },
        { id: 2, title: "Purpose", type: "string" }
      ]

      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        data: mockFields
      })

      const result = await client.getCustomSectionFields()

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: "API_OPERATION",
        operation: { op: "listCustomSectionFields" }
      })
      expect(result).toEqual(mockFields)
    })

    it("should return empty array when data is not an array", async () => {
      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        data: null
      })

      const result = await client.getCustomSectionFields()
      expect(result).toEqual([])
    })
  })

  describe("getApplications", () => {
    it("should fetch applications via typed operation", async () => {
      const mockApps = [{ id: 1, name: "App1" }]
      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        data: mockApps
      })

      const result = await client.getApplications()

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: "API_OPERATION",
        operation: { op: "listApplications" }
      })
      expect(result).toEqual(mockApps)
    })
  })
})
