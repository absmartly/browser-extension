import { AI_REQUEST_TIMEOUT_MS } from "./constants"

/** The SDK falls back to sub-second retries when Retry-After is >=60s.
 * A cooldown beyond our operation budget must remain a rate-limit failure,
 * not become a burst of requests before the server permits another attempt.
 * Short cooldowns and other errors retain the SDK's existing retry policy.
 */
export function respectRateLimitCooldown(
  transport: typeof fetch = globalThis.fetch
): typeof fetch {
  return async (input, init) => {
    const response = await transport(input, init)
    if (response.status !== 429) return response

    const millis = response.headers.get("retry-after-ms")
    const after = response.headers.get("retry-after")
    let delay = millis ? Number(millis) : NaN
    if (!Number.isFinite(delay) && after) {
      const seconds = Number(after)
      delay = Number.isFinite(seconds)
        ? seconds * 1000
        : Date.parse(after) - Date.now()
    }
    if (!Number.isFinite(delay) || delay < AI_REQUEST_TIMEOUT_MS)
      return response

    const headers = new Headers(response.headers)
    headers.set("x-should-retry", "false")
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    })
  }
}
