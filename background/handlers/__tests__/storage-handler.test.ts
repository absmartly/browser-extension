import { Storage } from "@plasmohq/storage"
import {
  handleStorageGet,
  handleStorageSet,
  handleStorageRemove,
  getLocalStorage,
  setLocalStorage,
  getSecureStorage,
  setSecureStorage
} from "../storage-handler"

const mockStorage = {
  session: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn()
  },
  local: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn()
  },
  secure: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn()
  }
}

jest.mock("@plasmohq/storage", () => ({
  Storage: jest.fn((options?: any) => {
    if (options?.secretKeyring) {
      return mockStorage.secure
    }
    if (options?.area === "local") {
      return mockStorage.local
    }
    return mockStorage.session
  })
}))

jest.mock("~src/utils/debug", () => ({
  debugLog: jest.fn(),
  debugError: jest.fn(),
  debugWarn: jest.fn()
}))

describe("storage-handler", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStorage.session.get.mockReset()
    mockStorage.session.set.mockReset()
    mockStorage.session.remove.mockReset()
    mockStorage.local.get.mockReset()
    mockStorage.local.set.mockReset()
    mockStorage.local.remove.mockReset()
    mockStorage.secure.get.mockReset()
    mockStorage.secure.set.mockReset()
    mockStorage.secure.remove.mockReset()
  })

  describe("handleStorageGet", () => {
    it("should retrieve value from session storage", async () => {
      const testValue = { foo: "bar" }
      mockStorage.session.get.mockResolvedValue(testValue)

      const result = await handleStorageGet("test-key")

      expect(result).toEqual(testValue)
      expect(mockStorage.session.get).toHaveBeenCalledWith("test-key")
    })

    it("should return null for non-existent key", async () => {
      mockStorage.session.get.mockResolvedValue(null)

      const result = await handleStorageGet("non-existent")

      expect(result).toBeNull()
    })

    it("should throw error on storage failure", async () => {
      const error = new Error("Storage error")
      mockStorage.session.get.mockRejectedValue(error)

      await expect(handleStorageGet("test-key")).rejects.toThrow("Storage error")
    })
  })

  describe("handleStorageSet", () => {
    it("should set value in session storage", async () => {
      const testValue = { foo: "bar" }
      mockStorage.session.set.mockResolvedValue(undefined)

      await handleStorageSet("test-key", testValue)

      expect(mockStorage.session.set).toHaveBeenCalledWith("test-key", testValue)
    })

    it("should handle string values", async () => {
      mockStorage.session.set.mockResolvedValue(undefined)

      await handleStorageSet("test-key", "test-value")

      expect(mockStorage.session.set).toHaveBeenCalledWith("test-key", "test-value")
    })

    it("should handle number values", async () => {
      mockStorage.session.set.mockResolvedValue(undefined)

      await handleStorageSet("test-key", 123)

      expect(mockStorage.session.set).toHaveBeenCalledWith("test-key", 123)
    })

    it("should handle array values", async () => {
      const testArray = [1, 2, 3]
      mockStorage.session.set.mockResolvedValue(undefined)

      await handleStorageSet("test-key", testArray)

      expect(mockStorage.session.set).toHaveBeenCalledWith("test-key", testArray)
    })

    it("should throw error on storage failure", async () => {
      const error = new Error("Storage error")
      mockStorage.session.set.mockRejectedValue(error)

      await expect(handleStorageSet("test-key", "value")).rejects.toThrow("Storage error")
    })
  })

  describe("handleStorageRemove", () => {
    it("should remove key from session storage", async () => {
      mockStorage.session.remove.mockResolvedValue(undefined)

      await handleStorageRemove("test-key")

      expect(mockStorage.session.remove).toHaveBeenCalledWith("test-key")
    })

    it("should throw error on storage failure", async () => {
      const error = new Error("Storage error")
      mockStorage.session.remove.mockRejectedValue(error)

      await expect(handleStorageRemove("test-key")).rejects.toThrow("Storage error")
    })
  })

  describe("getLocalStorage", () => {
    it("should retrieve value from local storage", async () => {
      const testValue = { foo: "bar" }
      mockStorage.local.get.mockResolvedValue(testValue)

      const result = await getLocalStorage("test-key")

      expect(result).toEqual(testValue)
      expect(mockStorage.local.get).toHaveBeenCalledWith("test-key")
    })

    it("should return null for non-existent key", async () => {
      mockStorage.local.get.mockResolvedValue(null)

      const result = await getLocalStorage("non-existent")

      expect(result).toBeNull()
    })

    it("should throw error on storage failure", async () => {
      const error = new Error("Storage error")
      mockStorage.local.get.mockRejectedValue(error)

      await expect(getLocalStorage("test-key")).rejects.toThrow("Storage error")
    })
  })

  describe("setLocalStorage", () => {
    it("should set value in local storage", async () => {
      const testValue = { foo: "bar" }
      mockStorage.local.set.mockResolvedValue(undefined)

      await setLocalStorage("test-key", testValue)

      expect(mockStorage.local.set).toHaveBeenCalledWith("test-key", testValue)
    })

    it("should throw error on storage failure", async () => {
      const error = new Error("Storage error")
      mockStorage.local.set.mockRejectedValue(error)

      await expect(setLocalStorage("test-key", "value")).rejects.toThrow("Storage error")
    })
  })

  describe("getSecureStorage", () => {
    it("should retrieve value from secure storage", async () => {
      const testValue = "secret-api-key"
      mockStorage.secure.get.mockResolvedValue(testValue)

      const result = await getSecureStorage("api-key")

      expect(result).toEqual(testValue)
      expect(mockStorage.secure.get).toHaveBeenCalledWith("api-key")
    })

    it("should return null for non-existent key", async () => {
      mockStorage.secure.get.mockResolvedValue(null)

      const result = await getSecureStorage("non-existent")

      expect(result).toBeNull()
    })

    it("should throw error on storage failure", async () => {
      const error = new Error("Secure storage error")
      mockStorage.secure.get.mockRejectedValue(error)

      await expect(getSecureStorage("api-key")).rejects.toThrow("Secure storage error")
    })
  })

  describe("setSecureStorage", () => {
    it("should set value in secure storage", async () => {
      const secretValue = "super-secret-key"
      mockStorage.secure.set.mockResolvedValue(undefined)

      await setSecureStorage("api-key", secretValue)

      expect(mockStorage.secure.set).toHaveBeenCalledWith("api-key", secretValue)
    })

    it("should throw error on storage failure", async () => {
      const error = new Error("Secure storage error")
      mockStorage.secure.set.mockRejectedValue(error)

      await expect(setSecureStorage("api-key", "value")).rejects.toThrow("Secure storage error")
    })
  })

  describe("Storage initialization", () => {
    it("should create session storage with correct options", () => {
      handleStorageGet("test")

      expect(Storage).toHaveBeenCalledWith({ area: "session" })
    })

    it("should create local storage with correct options", () => {
      getLocalStorage("test")

      expect(Storage).toHaveBeenCalledWith({ area: "local" })
    })

    it("should create secure storage with correct options", () => {
      getSecureStorage("test")

      expect(Storage).toHaveBeenCalledWith({
        area: "local",
        secretKeyring: true
      })
    })
  })
})
