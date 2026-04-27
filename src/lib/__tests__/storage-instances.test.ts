import { Storage } from "@plasmohq/storage"

import { secureStorage, sessionStorage, storage } from "../storage-instances"

jest.mock("@plasmohq/storage", () => {
  const calls: any[] = []
  return {
    Storage: jest.fn().mockImplementation((config?: any) => {
      calls.push(config ?? "__no_args__")
      return { _config: config, get: jest.fn(), set: jest.fn() }
    }),
    __getConstructorCalls: () => calls
  }
})

const { __getConstructorCalls } = jest.requireMock("@plasmohq/storage") as {
  __getConstructorCalls: () => any[]
}

describe("storage-instances", () => {
  it("creates exactly three storage instances", () => {
    expect(Storage).toHaveBeenCalledTimes(3)
  })

  it("creates default storage with no config", () => {
    expect(__getConstructorCalls()).toContain("__no_args__")
  })

  it("creates secureStorage with area=local and secretKeyring=true", () => {
    const secureCall = __getConstructorCalls().find(
      (c) => c && c.area === "local" && c.secretKeyring === true
    )
    expect(secureCall).toBeDefined()
  })

  it("creates sessionStorage with area=session", () => {
    const sessionCall = __getConstructorCalls().find(
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
