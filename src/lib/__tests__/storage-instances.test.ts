const constructorCalls: any[] = []

jest.mock("@plasmohq/storage", () => ({
  Storage: jest.fn().mockImplementation((config?: any) => {
    constructorCalls.push(config ?? "__no_args__")
    return { _config: config, get: jest.fn(), set: jest.fn() }
  }),
}))

import { storage, secureStorage, sessionStorage } from "../storage-instances"
import { Storage } from "@plasmohq/storage"

describe("storage-instances", () => {
  it("creates exactly three storage instances", () => {
    expect(Storage).toHaveBeenCalledTimes(3)
  })

  it("creates default storage with no config", () => {
    expect(constructorCalls).toContain("__no_args__")
  })

  it("creates secureStorage with area=local and secretKeyring=true", () => {
    const secureCall = constructorCalls.find(
      (c) => c && c.area === "local" && c.secretKeyring === true
    )
    expect(secureCall).toBeDefined()
  })

  it("creates sessionStorage with area=session", () => {
    const sessionCall = constructorCalls.find(
      (c) => c && c.area === "session"
    )
    expect(sessionCall).toBeDefined()
  })

  it("exports storage, secureStorage, and sessionStorage", () => {
    expect(storage).toBeDefined()
    expect(secureStorage).toBeDefined()
    expect(sessionStorage).toBeDefined()
  })

  it("exports distinct instances for each storage type", () => {
    expect(storage).not.toBe(secureStorage)
    expect(storage).not.toBe(sessionStorage)
    expect(secureStorage).not.toBe(sessionStorage)
  })
})
