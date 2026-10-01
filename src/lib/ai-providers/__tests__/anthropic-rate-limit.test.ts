/** @jest-environment node */
import Anthropic from "@anthropic-ai/sdk"

import { respectRateLimitCooldown } from "../rate-limit-fetch"

jest.unmock("@anthropic-ai/sdk")

describe("Anthropic SDK cooldown handling", () => {
  it.each([
    { "retry-after": "3600" },
    { "retry-after": "60" },
    { "retry-after-ms": "60000" },
    { "retry-after": new Date(Date.now() + 3600000).toUTCString() }
  ])(
    "does not retry before a long server cooldown has elapsed (%j)",
    async (cooldown) => {
      const transport = jest.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                type: "rate_limit_error",
                message: "Fixture quota exhausted"
              }
            }),
            {
              status: 429,
              headers: { ...cooldown, "content-type": "application/json" }
            }
          )
      )
      const client = new Anthropic({
        apiKey: "synthetic-not-a-secret",
        fetch: respectRateLimitCooldown(transport)
      })
      await expect(
        client.messages.create({
          model: "fixture-model",
          max_tokens: 1,
          messages: [{ role: "user", content: "fixture" }]
        })
      ).rejects.toMatchObject({
        status: 429,
        message: expect.stringContaining("Fixture quota exhausted")
      })
      expect(transport).toHaveBeenCalledTimes(1)
    }
  )

  it.each([429, 500])(
    "preserves transient retries and the successful response (HTTP %s)",
    async (status) => {
      const transport = jest
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: { message: "brief limit" } }), {
            status,
            headers: {
              "retry-after-ms": "1",
              "content-type": "application/json"
            }
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: "fixture-success", content: [] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          })
        )
      const client = new Anthropic({
        apiKey: "synthetic-not-a-secret",
        fetch: respectRateLimitCooldown(transport)
      })
      await expect(
        client.messages.create({
          model: "fixture-model",
          max_tokens: 1,
          messages: [{ role: "user", content: "fixture" }]
        })
      ).resolves.toMatchObject({ id: "fixture-success" })
      expect(transport).toHaveBeenCalledTimes(2)
    }
  )

  it.each([undefined, "invalid", "-1"])(
    "does not change absent/invalid cooldown handling (%s)",
    async (after) => {
      const headers = new Headers()
      if (after) headers.set("retry-after", after)
      const response = new Response("fixture error", { status: 429, headers })
      const wrapped = await respectRateLimitCooldown(
        jest.fn().mockResolvedValue(response)
      )("https://fixture.invalid")
      expect(wrapped).toBe(response)
    }
  )
})
