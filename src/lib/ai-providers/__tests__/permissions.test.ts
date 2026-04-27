import {
  ensureProviderPermissions,
  hasProviderPermissions
} from "../permissions"
import { getProviderOrigins } from "../registry"

jest.mock("../registry", () => ({
  getProviderOrigins: jest.fn()
}))

const mockedGetProviderOrigins = getProviderOrigins as jest.MockedFunction<
  typeof getProviderOrigins
>

const mockContains = jest.fn()
const mockRequest = jest.fn()

;(global as any).chrome = {
  permissions: {
    contains: mockContains,
    request: mockRequest
  }
}

describe("permissions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("hasProviderPermissions", () => {
    it("should return true for bridge providers (no origins needed)", async () => {
      mockedGetProviderOrigins.mockReturnValue([])

      const result = await hasProviderPermissions("claude-subscription")

      expect(result).toBe(true)
      expect(mockContains).not.toHaveBeenCalled()
    })

    it("should return true when chrome.permissions.contains returns true", async () => {
      mockedGetProviderOrigins.mockReturnValue(["https://api.anthropic.com/*"])
      mockContains.mockResolvedValue(true)

      const result = await hasProviderPermissions("anthropic-api")

      expect(result).toBe(true)
      expect(mockContains).toHaveBeenCalledWith({
        origins: ["https://api.anthropic.com/*"]
      })
    })

    it("should return false when chrome.permissions.contains returns false", async () => {
      mockedGetProviderOrigins.mockReturnValue(["https://api.anthropic.com/*"])
      mockContains.mockResolvedValue(false)

      const result = await hasProviderPermissions("anthropic-api")

      expect(result).toBe(false)
    })

    it("should return false when chrome.permissions.contains throws", async () => {
      mockedGetProviderOrigins.mockReturnValue(["https://api.anthropic.com/*"])
      mockContains.mockRejectedValue(new Error("Permission check failed"))

      const result = await hasProviderPermissions("anthropic-api")

      expect(result).toBe(false)
    })
  })

  describe("ensureProviderPermissions", () => {
    it("should return true for bridge providers", async () => {
      mockedGetProviderOrigins.mockReturnValue([])

      const result = await ensureProviderPermissions("codex")

      expect(result).toBe(true)
      expect(mockContains).not.toHaveBeenCalled()
      expect(mockRequest).not.toHaveBeenCalled()
    })

    it("should return true when permissions already granted without calling request", async () => {
      mockedGetProviderOrigins.mockReturnValue(["https://api.openai.com/*"])
      mockContains.mockResolvedValue(true)

      const result = await ensureProviderPermissions("openai-api")

      expect(result).toBe(true)
      expect(mockContains).toHaveBeenCalledWith({
        origins: ["https://api.openai.com/*"]
      })
      expect(mockRequest).not.toHaveBeenCalled()
    })

    it("should call chrome.permissions.request when not already granted", async () => {
      mockedGetProviderOrigins.mockReturnValue(["https://api.openai.com/*"])
      mockContains.mockResolvedValue(false)
      mockRequest.mockResolvedValue(true)

      await ensureProviderPermissions("openai-api")

      expect(mockRequest).toHaveBeenCalledWith({
        origins: ["https://api.openai.com/*"]
      })
    })

    it("should return true when request is granted", async () => {
      mockedGetProviderOrigins.mockReturnValue(["https://api.openai.com/*"])
      mockContains.mockResolvedValue(false)
      mockRequest.mockResolvedValue(true)

      const result = await ensureProviderPermissions("openai-api")

      expect(result).toBe(true)
    })

    it("should return false when request is denied", async () => {
      mockedGetProviderOrigins.mockReturnValue(["https://api.openai.com/*"])
      mockContains.mockResolvedValue(false)
      mockRequest.mockResolvedValue(false)

      const result = await ensureProviderPermissions("openai-api")

      expect(result).toBe(false)
    })

    it("should return false when request throws", async () => {
      mockedGetProviderOrigins.mockReturnValue(["https://api.openai.com/*"])
      mockContains.mockResolvedValue(false)
      mockRequest.mockRejectedValue(new Error("Request failed"))

      const result = await ensureProviderPermissions("openai-api")

      expect(result).toBe(false)
    })
  })
})
