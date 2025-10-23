import axios from "axios"

const mockStorage = {
  regular: {
    get: jest.fn(),
    set: jest.fn()
  },
  secure: {
    get: jest.fn(),
    set: jest.fn()
  }
}

jest.mock("axios")
jest.mock("@plasmohq/storage", () => ({
  Storage: jest.fn((options?: any) => {
    if (options?.secretKeyring) {
      return mockStorage.secure
    }
    return mockStorage.regular
  })
}))
jest.mock("~src/utils/debug", () => ({
  debugLog: jest.fn(),
  debugError: jest.fn(),
  debugWarn: jest.fn()
}))

import {
  validateAPIEndpoint,
  getConfig,
  isAuthError,
  getJWTCookie,
  openLoginPage,
  makeAPIRequest
} from "../auth-handler"

const mockedAxios = jest.mocked(axios)

describe("auth-handler", () => {
  beforeEach(() => {
    jest.clearAllMocks()

    global.chrome = {
      cookies: {
        getAll: jest.fn()
      },
      tabs: {
        create: jest.fn()
      }
    } as any
  })

  describe("validateAPIEndpoint", () => {
    it("should accept valid absmartly.com domain", () => {
      expect(validateAPIEndpoint("https://api.absmartly.com/v1")).toBe(true)
    })

    it("should accept valid absmartly.io domain", () => {
      expect(validateAPIEndpoint("https://sandbox.absmartly.io/v1")).toBe(true)
    })

    it("should accept subdomain of allowed domains", () => {
      expect(validateAPIEndpoint("https://test.api.absmartly.com/v1")).toBe(true)
    })

    it("should reject non-absmartly domains", () => {
      expect(validateAPIEndpoint("https://evil.com/v1")).toBe(false)
    })

    it("should reject invalid URLs", () => {
      expect(validateAPIEndpoint("not-a-url")).toBe(false)
    })

    it("should handle exact domain match", () => {
      expect(validateAPIEndpoint("https://absmartly.com")).toBe(true)
      expect(validateAPIEndpoint("https://absmartly.io")).toBe(true)
    })
  })

  describe("getConfig", () => {
    it("should return null when no config exists", async () => {
      mockStorage.regular.get.mockResolvedValue(null)
      const config = await getConfig()
      expect(config).toBeNull()
    })

    it("should merge config with secure API key", async () => {
      const storedConfig = {
        apiEndpoint: "https://api.absmartly.com/v1",
        applicationId: 123
      }

      mockStorage.regular.get.mockResolvedValue(storedConfig)
      mockStorage.secure.get.mockResolvedValue("secure-api-key")

      const config = await getConfig()

      expect(config).toEqual({
        apiEndpoint: "https://api.absmartly.com/v1",
        applicationId: 123,
        apiKey: "secure-api-key"
      })
    })

    it("should throw error for invalid API endpoint", async () => {
      const storedConfig = {
        apiEndpoint: "https://evil.com/v1",
        applicationId: 123
      }

      mockStorage.regular.get.mockResolvedValue(storedConfig)
      mockStorage.secure.get.mockResolvedValue(null)

      await expect(getConfig()).rejects.toThrow("Invalid API endpoint: Only ABsmartly domains are allowed")
    })

    it("should use apiKey from config if no secure key exists", async () => {
      const storedConfig = {
        apiEndpoint: "https://api.absmartly.com/v1",
        apiKey: "fallback-key"
      }

      mockStorage.regular.get.mockResolvedValue(storedConfig)
      mockStorage.secure.get.mockResolvedValue(null)

      const config = await getConfig()

      expect(config?.apiKey).toBe("fallback-key")
    })
  })

  describe("isAuthError", () => {
    it("should return true for 401 status", () => {
      const error = { response: { status: 401 } }
      expect(isAuthError(error)).toBe(true)
    })

    it("should return true for 403 status", () => {
      const error = { response: { status: 403 } }
      expect(isAuthError(error)).toBe(true)
    })

    it("should return false for other status codes", () => {
      expect(isAuthError({ response: { status: 404 } })).toBe(false)
      expect(isAuthError({ response: { status: 500 } })).toBe(false)
      expect(isAuthError({ response: { status: 200 } })).toBe(false)
    })

    it("should return false for errors without response", () => {
      expect(isAuthError({})).toBe(false)
      expect(isAuthError({ message: "Network error" })).toBe(false)
    })
  })

  describe("getJWTCookie", () => {
    it("should find JWT cookie by exact name", async () => {
      const mockCookie = {
        name: "jwt",
        value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
        domain: ".absmartly.com"
      }

      ;(chrome.cookies.getAll as jest.Mock).mockResolvedValue([mockCookie])

      const token = await getJWTCookie("https://api.absmartly.com")

      expect(token).toBe(mockCookie.value)
    })

    it("should find JWT cookie by token structure (3 parts)", async () => {
      const mockCookie = {
        name: "custom_token",
        value: "part1.part2.part3",
        domain: ".absmartly.com"
      }

      ;(chrome.cookies.getAll as jest.Mock).mockResolvedValue([mockCookie])

      const token = await getJWTCookie("https://api.absmartly.com")

      expect(token).toBe(mockCookie.value)
    })

    it("should try multiple cookie lookup strategies", async () => {
      const mockCookie = {
        name: "jwt",
        value: "token.value.here",
        domain: ".absmartly.com"
      }

      ;(chrome.cookies.getAll as jest.Mock).mockResolvedValue([mockCookie])

      await getJWTCookie("https://api.absmartly.com")

      expect(chrome.cookies.getAll).toHaveBeenCalledTimes(3)
    })

    it("should return null when no JWT cookie found", async () => {
      ;(chrome.cookies.getAll as jest.Mock).mockResolvedValue([])

      const token = await getJWTCookie("https://api.absmartly.com")

      expect(token).toBeNull()
    })

    it("should handle invalid URL gracefully", async () => {
      const token = await getJWTCookie("not-a-url")

      expect(token).toBeNull()
    })

    it("should deduplicate cookies from multiple strategies", async () => {
      const mockCookie = {
        name: "jwt",
        value: "token.value.here",
        domain: ".absmartly.com"
      }

      ;(chrome.cookies.getAll as jest.Mock)
        .mockResolvedValueOnce([mockCookie])
        .mockResolvedValueOnce([mockCookie])
        .mockResolvedValueOnce([mockCookie])

      const token = await getJWTCookie("https://api.absmartly.com")

      expect(token).toBe(mockCookie.value)
    })

    it("should recognize common JWT cookie names", async () => {
      const cookieNames = ["jwt", "JWT", "access_token", "auth_token", "authorization"]

      for (const name of cookieNames) {
        const mockCookie = {
          name,
          value: "token.value.here",
          domain: ".absmartly.com"
        }

        ;(chrome.cookies.getAll as jest.Mock).mockResolvedValue([mockCookie])

        const token = await getJWTCookie("https://api.absmartly.com")

        expect(token).toBe(mockCookie.value)
      }
    })
  })

  describe("openLoginPage", () => {
    it("should open login page when not authenticated", async () => {
      mockStorage.regular.get.mockResolvedValue({
        apiEndpoint: "https://api.absmartly.com/v1"
      })
      mockStorage.secure.get.mockResolvedValue(null)

      mockedAxios.mockRejectedValue({ response: { status: 401 } })

      const result = await openLoginPage()

      expect(result.authenticated).toBe(false)
      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: "https://api.absmartly.com"
      })
    })

    it("should not open login page if already authenticated", async () => {
      mockStorage.regular.get.mockResolvedValue({
        apiEndpoint: "https://api.absmartly.com/v1"
      })
      mockStorage.secure.get.mockResolvedValue(null)

      mockedAxios.mockResolvedValue({ data: { ok: true } })

      const result = await openLoginPage()

      expect(result.authenticated).toBe(true)
      expect(chrome.tabs.create).not.toHaveBeenCalled()
    })

    it("should return false when no API endpoint configured", async () => {
      mockStorage.regular.get.mockResolvedValue(null)

      const result = await openLoginPage()

      expect(result.authenticated).toBe(false)
      expect(chrome.tabs.create).not.toHaveBeenCalled()
    })

    it("should handle API endpoint with /api suffix", async () => {
      mockStorage.regular.get.mockResolvedValue({
        apiEndpoint: "https://api.absmartly.com/api/v1"
      })
      mockStorage.secure.get.mockResolvedValue(null)

      mockedAxios.mockRejectedValue({ response: { status: 401 } })

      await openLoginPage()

      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: "https://api.absmartly.com"
      })
    })
  })

  describe("makeAPIRequest", () => {
    beforeEach(() => {
      mockStorage.regular.get.mockResolvedValue({
        apiEndpoint: "https://api.absmartly.com/v1",
        authMethod: "apikey",
        apiKey: "test-api-key"
      })
      mockStorage.secure.get.mockResolvedValue("test-api-key")
    })

    it("should make successful GET request with API key", async () => {
      const mockResponse = { data: { experiments: [] } }
      mockedAxios.mockResolvedValue(mockResponse)

      const result = await makeAPIRequest("GET", "/experiments")

      expect(result).toEqual(mockResponse.data)
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          url: "https://api.absmartly.com/v1/experiments",
          headers: expect.objectContaining({
            Authorization: "Api-Key test-api-key"
          })
        })
      )
    })

    it("should make POST request with data", async () => {
      const mockData = { name: "Test Experiment" }
      const mockResponse = { data: { id: 1 } }
      mockedAxios.mockResolvedValue(mockResponse)

      const result = await makeAPIRequest("POST", "/experiments", mockData)

      expect(result).toEqual(mockResponse.data)
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: "https://api.absmartly.com/v1/experiments",
          data: mockData
        })
      )
    })

    it("should convert GET request data to query parameters", async () => {
      const mockResponse = { data: { experiments: [] } }
      mockedAxios.mockResolvedValue(mockResponse)

      await makeAPIRequest("GET", "/experiments", { state: "running", limit: 10 })

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://api.absmartly.com/v1/experiments?state=running&limit=10"
        })
      )
    })

    it("should use JWT auth when authMethod is jwt", async () => {
      mockStorage.regular.get.mockResolvedValue({
        apiEndpoint: "https://api.absmartly.com/v1",
        authMethod: "jwt"
      })

      ;(chrome.cookies.getAll as jest.Mock).mockResolvedValue([{
        name: "jwt",
        value: "jwt.token.here",
        domain: ".absmartly.com"
      }])

      const mockResponse = { data: { experiments: [] } }
      mockedAxios.mockResolvedValue(mockResponse)

      await makeAPIRequest("GET", "/experiments")

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "JWT jwt.token.here"
          })
        })
      )
    })

    it("should throw AUTH_EXPIRED on 401 error", async () => {
      mockedAxios.mockRejectedValue({
        response: { status: 401, data: { error: "Unauthorized" } }
      })

      ;(chrome.cookies.getAll as jest.Mock).mockResolvedValue([])

      await expect(makeAPIRequest("GET", "/experiments", undefined, false)).rejects.toThrow("AUTH_EXPIRED")
    })

    it("should retry with JWT when API key fails", async () => {
      mockStorage.regular.get.mockResolvedValue({
        apiEndpoint: "https://api.absmartly.com/v1",
        authMethod: "apikey",
        apiKey: "test-api-key"
      })

      ;(chrome.cookies.getAll as jest.Mock).mockResolvedValue([{
        name: "jwt",
        value: "jwt.token.here",
        domain: ".absmartly.com"
      }])

      mockedAxios
        .mockRejectedValueOnce({ response: { status: 401 } })
        .mockResolvedValueOnce({ data: { success: true } })

      const result = await makeAPIRequest("GET", "/experiments")

      expect(result).toEqual({ success: true })
      expect(mockedAxios).toHaveBeenCalledTimes(2)
    })

    it("should retry with API key when JWT fails", async () => {
      mockStorage.regular.get.mockResolvedValue({
        apiEndpoint: "https://api.absmartly.com/v1",
        authMethod: "jwt",
        apiKey: "test-api-key"
      })
      mockStorage.secure.get.mockResolvedValue("test-api-key")

      ;(chrome.cookies.getAll as jest.Mock).mockResolvedValue([])

      mockedAxios
        .mockRejectedValueOnce({ response: { status: 401 } })
        .mockResolvedValueOnce({ data: { success: true } })

      const result = await makeAPIRequest("GET", "/experiments")

      expect(result).toEqual({ success: true })
      expect(mockedAxios).toHaveBeenCalledTimes(2)
    })

    it("should handle endpoint with trailing slashes", async () => {
      mockStorage.regular.get.mockResolvedValue({
        apiEndpoint: "https://api.absmartly.com/v1/",
        authMethod: "apikey",
        apiKey: "test-api-key"
      })

      const mockResponse = { data: {} }
      mockedAxios.mockResolvedValue(mockResponse)

      await makeAPIRequest("GET", "/experiments")

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://api.absmartly.com/v1/experiments"
        })
      )
    })

    it("should handle path without leading slash", async () => {
      const mockResponse = { data: {} }
      mockedAxios.mockResolvedValue(mockResponse)

      await makeAPIRequest("GET", "experiments")

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://api.absmartly.com/v1/experiments"
        })
      )
    })

    it("should add /v1 to endpoint if not present", async () => {
      mockStorage.regular.get.mockResolvedValue({
        apiEndpoint: "https://api.absmartly.com",
        authMethod: "apikey",
        apiKey: "test-api-key"
      })

      const mockResponse = { data: {} }
      mockedAxios.mockResolvedValue(mockResponse)

      await makeAPIRequest("GET", "/experiments")

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://api.absmartly.com/v1/experiments"
        })
      )
    })

    it("should throw error when no API endpoint configured", async () => {
      mockStorage.regular.get.mockResolvedValue({
        apiKey: "test-key"
      })

      await expect(makeAPIRequest("GET", "/experiments")).rejects.toThrow("No API endpoint configured")
    })

    it("should use Bearer prefix for non-JWT tokens", async () => {
      mockStorage.regular.get.mockResolvedValue({
        apiEndpoint: "https://api.absmartly.com/v1",
        authMethod: "jwt"
      })

      ;(chrome.cookies.getAll as jest.Mock).mockResolvedValue([{
        name: "jwt",
        value: "non-jwt-token",
        domain: ".absmartly.com"
      }])

      const mockResponse = { data: {} }
      mockedAxios.mockResolvedValue(mockResponse)

      await makeAPIRequest("GET", "/experiments")

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer non-jwt-token"
          })
        })
      )
    })

    it("should filter out undefined query parameters", async () => {
      const mockResponse = { data: {} }
      mockedAxios.mockResolvedValue(mockResponse)

      await makeAPIRequest("GET", "/experiments", {
        state: "running",
        limit: undefined,
        offset: null
      })

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://api.absmartly.com/v1/experiments?state=running"
        })
      )
    })
  })
})
