// Settings probes are deterministic HTTP responses. They never authorize an
// inference request, which still requires an explicit per-test script.
export function providerProbeResponse(method: string, url: URL) {
  const models = /\/models\/?$/.test(url.pathname)
  const health = /\/health$/.test(url.pathname)
  if (!models && !health) return undefined
  const headers = {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET, OPTIONS"
  }
  if (method === "OPTIONS") return { status: 204, headers, body: undefined }
  if (method !== "GET") return undefined
  // Includes saved custom bridge endpoints/ports as well as Claude and Codex
  // defaults. Never connect to a developer's running, authenticated bridge.
  if (health)
    return { status: 503, headers, body: { ok: false, authenticated: false } }
  return {
    status: 200,
    headers,
    body: {
      // Each adapter consumes its native shape. Custom endpoints may serve
      // several families, so expose fixed metadata for each supported parser.
      data: [
        {
          id: "claude-sonnet-4-5",
          type: "model",
          display_name: "Fixture Sonnet",
          name: "Fixture Sonnet"
        },
        {
          id: "gpt-4-turbo",
          type: "model",
          display_name: "Fixture GPT",
          name: "Fixture GPT"
        },
        {
          id: "openai/gpt-4-turbo",
          type: "model",
          display_name: "Fixture Router",
          name: "Fixture Router"
        }
      ],
      has_more: false,
      models: [
        {
          name: "models/gemini-1.5-pro",
          displayName: "Fixture Gemini",
          supportedGenerationMethods: ["generateContent"]
        }
      ]
    }
  }
}
