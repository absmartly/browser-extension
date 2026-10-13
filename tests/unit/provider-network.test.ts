/** @jest-environment node */
import { EventEmitter } from "node:events"

import { installProviderGuard } from "../helpers/provider-network"
import { providerProbeResponse } from "../helpers/provider-probes"

function target() {
  const handlers: Function[] = []
  return Object.assign(new EventEmitter(), {
    handlers,
    route: jest.fn(async (_url, handler) => {
      handlers.push(handler)
    }),
    unroute: jest.fn(async (_url, handler) => {
      if (handler) handlers.splice(handlers.indexOf(handler), 1)
      else handlers.splice(0)
    }),
    unrouteAll: jest.fn(async () => {
      handlers.splice(0)
    })
  })
}

function requestRoute(url: string, method = "GET") {
  return {
    request: () => ({
      url: () => url,
      method: () => method,
      headers: () => ({}),
      postDataJSON: () => undefined
    }),
    fulfill: jest.fn(async () => {}),
    abort: jest.fn(async () => {}),
    fallback: jest.fn(async () => {})
  }
}

test.each([
  "https://api.anthropic.com/v1/models",
  "https://api.openai.com/v1/models",
  "https://openrouter.ai/api/v1/models",
  "https://generativelanguage.googleapis.com/v1beta/models?key=synthetic",
  "https://custom.invalid/proxy/models"
])("model discovery stays at the boundary: %s", async (url) => {
  const context = Object.assign(target(), { pages: () => [] })
  const recordViolation = jest.fn()
  await installProviderGuard(
    context as any,
    {
      endpoint: "http://localhost:45678",
      registeredEndpoints: ["https://custom.invalid/proxy"],
      recordViolation
    } as any
  )
  const route = requestRoute(url)
  await context.handlers[0](route)
  expect(route.fulfill).toHaveBeenCalledWith(
    expect.objectContaining({ status: 200 })
  )
  expect(route.fallback).not.toHaveBeenCalled()
  expect(recordViolation).not.toHaveBeenCalled()
})

test.each([
  "http://localhost:3000/health",
  "http://localhost:9000/health",
  "http://localhost:51234/health",
  "https://custom-bridge.invalid/health"
])("bridge probe is deterministically offline: %s", async (value) => {
  expect(providerProbeResponse("GET", new URL(value))).toMatchObject({
    status: 503,
    body: { ok: false, authenticated: false }
  })
  expect(providerProbeResponse("POST", new URL(value))).toBeUndefined()
})

test("probe metadata never accepts inference or consumes a model generation path", () => {
  expect(
    providerProbeResponse(
      "POST",
      new URL("https://api.anthropic.com/v1/messages")
    )
  ).toBeUndefined()
  expect(
    providerProbeResponse(
      "POST",
      new URL(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini:generateContent"
      )
    )
  ).toBeUndefined()
  expect(
    providerProbeResponse(
      "POST",
      new URL("http://localhost:9000/conversations")
    )
  ).toBeUndefined()
})

test("later broad page and context handlers cannot allow remote inference", async () => {
  const page = target()
  const context = Object.assign(target(), { pages: () => [page] })
  const recordViolation = jest.fn()
  await installProviderGuard(
    context as any,
    { endpoint: "http://localhost:45678", recordViolation } as any
  )
  for (const surface of [page, context]) {
    const scenarioHandler = jest.fn()
    await surface.route("**/*", scenarioHandler)
    const route = requestRoute("http://localhost:9000/conversations", "POST")
    await surface.handlers.at(-1)!(route)
    expect(route.abort).toHaveBeenCalledWith("blockedbyclient")
    expect(scenarioHandler).not.toHaveBeenCalled()
  }
  expect(recordViolation).toHaveBeenCalledTimes(2)
})

test("removing scenario routes retains the fail-closed boundary", async () => {
  const context = Object.assign(target(), { pages: () => [] })
  const recordViolation = jest.fn()
  await installProviderGuard(
    context as any,
    { endpoint: "http://localhost:45678", recordViolation } as any
  )
  await context.unrouteAll()
  const route = requestRoute("https://api.anthropic.com/v1/messages", "POST")
  await context.handlers[0](route)
  expect(route.abort).toHaveBeenCalledWith("blockedbyclient")
  expect(recordViolation).toHaveBeenCalled()
})

test("ordinary Office and target-page paths retain their real transport", async () => {
  const context = Object.assign(target(), { pages: () => [] })
  const recordViolation = jest.fn()
  await installProviderGuard(
    context as any,
    {
      endpoint: "http://localhost:45678",
      registeredEndpoints: ["https://shared.invalid/ai"],
      recordViolation
    } as any
  )
  for (const url of [
    "https://office.absmartly.com/health",
    "https://page.invalid/models",
    "https://page.invalid/conversations",
    "https://shared.invalid/v1/experiments"
  ]) {
    const route = requestRoute(url)
    await context.handlers[0](route)
    expect(route.fallback).toHaveBeenCalled()
    expect(route.fulfill).not.toHaveBeenCalled()
    expect(route.abort).not.toHaveBeenCalled()
  }
  expect(recordViolation).not.toHaveBeenCalled()
})

test("unregistered custom inference still fails closed on its native protocol", async () => {
  const context = Object.assign(target(), { pages: () => [] })
  const recordViolation = jest.fn()
  await installProviderGuard(
    context as any,
    { endpoint: "http://localhost:45678", recordViolation } as any
  )
  const route = requestRoute("https://unknown-provider.invalid/custom", "POST")
  const request = route.request()
  request.headers = () => ({ "anthropic-version": "2023-06-01" })
  route.request = () => request
  await context.handlers[0](route)
  expect(route.abort).toHaveBeenCalledWith("blockedbyclient")
  expect(recordViolation).toHaveBeenCalled()
})
