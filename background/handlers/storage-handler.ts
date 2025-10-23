import { Storage } from "@plasmohq/storage"
import { debugLog, debugError } from "~src/utils/debug"

/**
 * Handles storage GET operations from content scripts
 * @param key Storage key to retrieve
 * @returns Promise resolving to the stored value or null
 */
export async function handleStorageGet(key: string): Promise<any> {
  const sessionStorage = new Storage({ area: "session" })
  try {
    const value = await sessionStorage.get(key)
    debugLog("[Storage] GET:", key, "=", value)
    return value
  } catch (error) {
    debugError("[Storage] GET error:", error)
    throw error
  }
}

/**
 * Handles storage SET operations from content scripts
 * @param key Storage key to set
 * @param value Value to store
 */
export async function handleStorageSet(key: string, value: any): Promise<void> {
  const sessionStorage = new Storage({ area: "session" })
  try {
    await sessionStorage.set(key, value)
    debugLog("[Storage] SET:", key, "=", value)
  } catch (error) {
    debugError("[Storage] SET error:", error)
    throw error
  }
}

/**
 * Removes a key from storage
 * @param key Storage key to remove
 */
export async function handleStorageRemove(key: string): Promise<void> {
  const sessionStorage = new Storage({ area: "session" })
  try {
    await sessionStorage.remove(key)
    debugLog("[Storage] REMOVE:", key)
  } catch (error) {
    debugError("[Storage] REMOVE error:", error)
    throw error
  }
}

/**
 * Gets a value from local storage (non-session)
 */
export async function getLocalStorage(key: string): Promise<any> {
  const localStorage = new Storage({ area: "local" })
  try {
    const value = await localStorage.get(key)
    debugLog("[Storage] Local GET:", key, "=", value)
    return value
  } catch (error) {
    debugError("[Storage] Local GET error:", error)
    throw error
  }
}

/**
 * Sets a value in local storage (non-session)
 */
export async function setLocalStorage(key: string, value: any): Promise<void> {
  const localStorage = new Storage({ area: "local" })
  try {
    await localStorage.set(key, value)
    debugLog("[Storage] Local SET:", key, "=", value)
  } catch (error) {
    debugError("[Storage] Local SET error:", error)
    throw error
  }
}

/**
 * Gets a value from secure storage (encrypted)
 */
export async function getSecureStorage(key: string): Promise<any> {
  const secureStorage = new Storage({
    area: "local",
    secretKeyring: true
  } as any)
  try {
    const value = await secureStorage.get(key)
    debugLog("[Storage] Secure GET:", key, "=", value ? "[REDACTED]" : null)
    return value
  } catch (error) {
    debugError("[Storage] Secure GET error:", error)
    throw error
  }
}

/**
 * Sets a value in secure storage (encrypted)
 */
export async function setSecureStorage(key: string, value: any): Promise<void> {
  const secureStorage = new Storage({
    area: "local",
    secretKeyring: true
  } as any)
  try {
    await secureStorage.set(key, value)
    debugLog("[Storage] Secure SET:", key, "= [REDACTED]")
  } catch (error) {
    debugError("[Storage] Secure SET error:", error)
    throw error
  }
}
