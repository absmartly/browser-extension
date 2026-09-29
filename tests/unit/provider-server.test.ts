/** @jest-environment node */
import { isProviderURL } from "../helpers/provider-network"
import {
  createLiveProvider,
  createProviderServer,
  type ProviderController
} from "../helpers/provider-server"

let provider: ProviderController
const request = (
  content: string | any[] = "Make buttons orange",
  extra = {}
) => ({
  model: "claude-sonnet-4-5",
  max_tokens: 4096,
  messages: [{ role: "user", content }],
  tools: [{ name: "dom_changes_generator" }, { name: "css_query" }],
  ...extra
})
const post = (body: unknown, path = "/v1/messages") =>
  fetch(provider.endpoint.replace("localhost", "127.0.0.1") + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": provider.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(body)
  })
beforeEach(async () => {
  provider = await createProviderServer()
})
afterEach(async () => {
  await provider.close()
})

test("returns native tool responses and accepts the matching real tool-result round", async () => {
  provider.script([
    {
      promptIncludes: "buttons orange",
      response: {
        tools: [
          { id: "query-1", name: "css_query", input: { selector: "#target" } }
        ]
      }
    },
    {
      toolResultFor: "query-1",
      assertRequest: (body) =>
        expect(body.messages.at(-1)?.content).toEqual([
          {
            type: "tool_result",
            tool_use_id: "query-1",
            content: '<button id="target">Real DOM</button>'
          }
        ]),
      response: {
        tools: [
          {
            id: "dom-1",
            name: "dom_changes_generator",
            input: { action: "append", domChanges: [], response: "done" }
          }
        ]
      }
    }
  ])
  const first = (await (await post(request())).json()) as any
  expect(first).toMatchObject({
    type: "message",
    role: "assistant",
    stop_reason: "tool_use",
    content: [{ type: "tool_use", id: "query-1", name: "css_query" }]
  })
  const second = await post(
    request("", {
      messages: [
        { role: "user", content: "Make buttons orange" },
        { role: "assistant", content: first.content },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "query-1",
              content: '<button id="target">Real DOM</button>'
            }
          ]
        }
      ]
    })
  )
  expect(second.status).toBe(200)
  provider.assertComplete()
})

test.each(["unexpected", "mismatch", "malformed"])(
  "fails closed on %s inference",
  async (kind) => {
    if (kind === "mismatch")
      provider.script([
        {
          promptIncludes: "different prompt",
          response: { text: "never returned" }
        }
      ])
    const response = await post(kind === "malformed" ? {} : request())
    expect(response.status).toBe(500)
    expect(response.headers.get("x-should-retry")).toBe("false")
    expect(() => provider.assertComplete()).toThrow()
  }
)

test("rejects unconsumed expectations and unrecognized routes", async () => {
  provider.script([
    { promptIncludes: "not requested", response: { text: "unused" } }
  ])
  expect(() => provider.assertComplete()).toThrow("not consumed")
  expect((await post(request(), "/v1/not-messages")).status).toBe(500)
  expect(() => provider.assertComplete()).toThrow("Unexpected provider request")
})

test("provides model metadata and CORS without consuming inference scripts", async () => {
  const preflight = await fetch(
    provider.endpoint.replace("localhost", "127.0.0.1") + "/v1/messages",
    { method: "OPTIONS" }
  )
  expect(preflight.status).toBe(204)
  const response = await fetch(
    provider.endpoint.replace("localhost", "127.0.0.1") + "/v1/models"
  )
  expect(await response.json()).toMatchObject({
    data: expect.arrayContaining([
      expect.objectContaining({ id: "claude-sonnet-4-5", type: "model" })
    ])
  })
  expect(provider.requests).toHaveLength(0)
  provider.assertComplete()
})

test("returns scripted API error contract without adding SDK retries", async () => {
  provider.script([
    {
      promptIncludes: "buttons",
      status: 429,
      error: { type: "rate_limit_error", message: "fixture rate limit" },
      headers: { "retry-after": "3600" }
    }
  ])
  const response = await post(request())
  expect(response.status).toBe(429)
  expect(response.headers.get("retry-after")).toBe("3600")
  expect(await response.json()).toEqual({
    type: "error",
    error: { type: "rate_limit_error", message: "fixture rate limit" }
  })
  provider.assertComplete()
})

test("permits a new-turn tool id for independent generations", async () => {
  provider.script(
    [1, 2].map(() => ({
      promptIncludes: "buttons",
      response: {
        tools: [{ id: "dom-result", name: "dom_changes_generator", input: {} }]
      }
    }))
  )
  expect((await post(request())).status).toBe(200)
  expect((await post(request())).status).toBe(200)
  provider.assertComplete()
})

test("classifies provider fallbacks while preserving Office and target-page traffic", () => {
  expect(isProviderURL("https://api.anthropic.com/v1/messages")).toBe(true)
  expect(
    isProviderURL("https://custom.invalid/proxy/v1/models", [
      "https://custom.invalid/proxy"
    ])
  ).toBe(true)
  expect(
    isProviderURL(
      "https://generativelanguage.googleapis.com/v1beta/models/a:generateContent"
    )
  ).toBe(true)
  expect(isProviderURL("http://localhost:3000/health")).toBe(true)
  expect(isProviderURL("http://localhost:9000/health")).toBe(true)
  expect(
    isProviderURL("https://custom-bridge.invalid/health", [
      "https://custom-bridge.invalid"
    ])
  ).toBe(true)
  expect(
    isProviderURL("http://localhost:51234/conversations", [
      "http://localhost:51234"
    ])
  ).toBe(true)
  expect(isProviderURL("https://office.test/v1/experiments")).toBe(false)
  expect(isProviderURL("http://localhost:3456/visual-editor-test.html")).toBe(
    false
  )
})

test("live mode cannot silently fall back to a provider or subscription", () => {
  expect(() => createLiveProvider(undefined, "key")).toThrow("explicit")
  expect(() => createLiveProvider("https://proxy.invalid", undefined)).toThrow(
    "explicit"
  )
})

test("rejects a tool result without its preceding assistant tool-use message", async () => {
  provider.script([
    {
      promptIncludes: "buttons",
      response: {
        tools: [
          { id: "query-1", name: "css_query", input: { selector: "#target" } }
        ]
      }
    },
    { toolResultFor: "query-1", response: { text: "must not return" } }
  ])
  expect((await post(request())).status).toBe(200)
  expect(
    (
      await post(
        request([
          { type: "tool_result", tool_use_id: "query-1", content: "<button />" }
        ])
      )
    ).status
  ).toBe(500)
  expect(() => provider.assertComplete()).toThrow(
    "Missing matching tool_result"
  )
})

test("rejects repeated tool-use IDs within a native conversation chain", async () => {
  provider.script([
    {
      promptIncludes: "buttons",
      response: {
        tools: [
          { id: "query-1", name: "css_query", input: { selector: "#target" } }
        ]
      }
    },
    {
      toolResultFor: "query-1",
      response: {
        tools: [
          { id: "query-1", name: "css_query", input: { selector: "#other" } }
        ]
      }
    }
  ])
  const first = (await (await post(request())).json()) as any
  const next = await post(
    request("", {
      messages: [
        { role: "user", content: "Make buttons orange" },
        { role: "assistant", content: first.content },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "query-1",
              content: "<button />"
            }
          ]
        }
      ]
    })
  )
  expect(next.status).toBe(500)
  expect(() => provider.assertComplete()).toThrow("Duplicate tool id")
})

test("requires the actual SDK version header", async () => {
  const response = await fetch(
    provider.endpoint.replace("localhost", "127.0.0.1") + "/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": provider.apiKey
      },
      body: JSON.stringify(request())
    }
  )
  expect(response.status).toBe(500)
  expect(() => provider.assertComplete()).toThrow("Anthropic version header")
})
