import { createServer, type Server } from "node:http"

import { providerProbeResponse } from "./provider-probes"

export type ProviderRequest = {
  model: string
  max_tokens: number
  messages: Array<{ role: string; content: string | any[] }>
  tools?: Array<{ name: string; input_schema?: unknown }>
  [key: string]: any
}
export type ProviderStep = {
  promptIncludes?: string
  toolResultFor?: string
  assertRequest?: (body: ProviderRequest) => void
  response?: {
    tools?: Array<{ id: string; name: string; input: Record<string, unknown> }>
    text?: string
  }
  status?: number
  error?: { type: string; message: string }
  headers?: Record<string, string>
}
export interface ProviderController {
  endpoint: string
  registeredEndpoints: readonly string[]
  registerEndpoint(endpoint: string): void
  apiKey: string
  requests: ProviderRequest[]
  script(steps: ProviderStep[]): void
  recordViolation(message: string): void
  assertComplete(): void
  close(): Promise<void>
}

export async function createProviderServer(): Promise<ProviderController> {
  const steps: ProviderStep[] = []
  const requests: ProviderRequest[] = []
  const violations: string[] = []
  const issuedTools = new Map<string, string>()
  const registeredEndpoints: string[] = []
  let messageId = 0
  const server: Server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Headers", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    res.setHeader("Content-Type", "application/json")
    const send = (status: number, body: unknown) => {
      res.writeHead(status)
      res.end(JSON.stringify(body))
    }
    try {
      const url = new URL(req.url || "/", "http://localhost")
      if (
        req.method === "OPTIONS" &&
        ["/v1/messages", "/v1/models"].includes(url.pathname)
      ) {
        res.writeHead(204)
        res.end()
        return
      }
      const probe = providerProbeResponse(req.method || "", url)
      if (probe) {
        send(probe.status, probe.body)
        return
      }
      if (req.method !== "POST" || url.pathname !== "/v1/messages")
        throw new Error(
          `Unexpected provider request: ${req.method} ${url.pathname}`
        )
      if (!req.headers["x-api-key"])
        throw new Error("Missing Anthropic API key header")
      if (req.headers["anthropic-version"] !== "2023-06-01")
        throw new Error("Missing or unsupported Anthropic version header")
      const chunks: Buffer[] = []
      let length = 0
      for await (const chunk of req) {
        length += chunk.length
        if (length > 16 * 1024 * 1024)
          throw new Error("Provider request exceeds 16 MiB")
        chunks.push(Buffer.from(chunk))
      }
      const body = JSON.parse(
        Buffer.concat(chunks).toString()
      ) as ProviderRequest
      if (
        !body.model ||
        !Number.isFinite(body.max_tokens) ||
        body.max_tokens <= 0 ||
        !Array.isArray(body.messages) ||
        !body.messages.length ||
        body.messages.at(-1)?.role !== "user"
      )
        throw new Error("Malformed Anthropic messages request")
      requests.push(body)
      const step = steps.shift()
      if (!step) throw new Error("Unscripted Anthropic messages request")
      const last = body.messages.at(-1)!.content
      const text =
        typeof last === "string"
          ? last
          : last
              .filter((block) => block.type === "text")
              .map((block) => block.text)
              .join("\n")
      if (
        step.promptIncludes !== undefined &&
        !text.includes(step.promptIncludes)
      )
        throw new Error(
          `Provider prompt did not contain scripted text: ${step.promptIncludes}`
        )
      if (step.toolResultFor) {
        const assistant = body.messages.at(-2)
        if (
          !issuedTools.has(step.toolResultFor) ||
          assistant?.role !== "assistant" ||
          !Array.isArray(assistant.content) ||
          !assistant.content.some(
            (block) =>
              block.type === "tool_use" &&
              block.id === step.toolResultFor &&
              block.name === issuedTools.get(step.toolResultFor)
          ) ||
          !Array.isArray(last) ||
          !last.some(
            (block) =>
              block.type === "tool_result" &&
              block.tool_use_id === step.toolResultFor
          )
        )
          throw new Error(`Missing matching tool_result: ${step.toolResultFor}`)
      }
      step.assertRequest?.(body)
      for (const [name, value] of Object.entries(step.headers || {}))
        res.setHeader(name, value)
      if ((step.status || 200) >= 400) {
        res.setHeader("x-should-retry", "false")
        send(step.status!, {
          type: "error",
          error: step.error || {
            type: "api_error",
            message: "Scripted provider error"
          }
        })
        return
      }
      const content: any[] = []
      if (step.response?.text !== undefined)
        content.push({ type: "text", text: step.response.text })
      for (const tool of step.response?.tools || []) {
        if (!body.tools?.some((declared) => declared.name === tool.name))
          throw new Error(`Response tool was not declared: ${tool.name}`)
        if (
          content.some(
            (block) => block.type === "tool_use" && block.id === tool.id
          ) ||
          body.messages.some(
            (message) =>
              Array.isArray(message.content) &&
              message.content.some(
                (block) => block.type === "tool_use" && block.id === tool.id
              )
          )
        )
          throw new Error(`Duplicate tool id in request chain: ${tool.id}`)
        issuedTools.set(tool.id, tool.name)
        content.push({ type: "tool_use", ...tool })
      }
      if (!content.length)
        throw new Error("Scripted provider response must contain text or tools")
      send(200, {
        id: `msg_fixture_${++messageId}`,
        type: "message",
        role: "assistant",
        model: body.model,
        content,
        stop_reason: step.response?.tools?.length ? "tool_use" : "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 }
      })
    } catch (error) {
      violations.push(error instanceof Error ? error.message : String(error))
      if (!res.headersSent) {
        res.setHeader("x-should-retry", "false")
        send(500, {
          type: "error",
          error: {
            type: "api_error",
            message: "Provider fixture rejected request"
          }
        })
      } else res.end()
    }
  })
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject)
      resolve()
    })
  })
  const address = server.address() as { port: number }
  return {
    endpoint: `http://localhost:${address.port}`,
    registeredEndpoints,
    registerEndpoint(endpoint) {
      const url = new URL(endpoint)
      if (!["http:", "https:"].includes(url.protocol))
        throw new Error("Invalid fixture provider endpoint")
      registeredEndpoints.push(url.origin + url.pathname.replace(/\/$/, ""))
    },
    apiKey: "fixture-anthropic-not-a-secret",
    requests,
    script(next) {
      for (const step of next) {
        if (
          step.promptIncludes === undefined &&
          !step.toolResultFor &&
          !step.assertRequest
        )
          throw new Error("Provider step requires a request expectation")
      }
      steps.push(...next)
    },
    recordViolation(message) {
      violations.push(message)
    },
    assertComplete() {
      if (violations.length || steps.length)
        throw new Error(
          [
            ...violations,
            ...(steps.length
              ? [`${steps.length} provider response(s) not consumed`]
              : [])
          ].join("\n")
        )
    },
    async close() {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
    }
  }
}

export function createLiveProvider(
  endpoint: string | undefined,
  apiKey: string | undefined
): ProviderController {
  if (!endpoint || !apiKey)
    throw new Error("liveAI requires an explicit provider endpoint and API key")
  const url = new URL(endpoint)
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Invalid live provider endpoint")
  return {
    endpoint,
    registeredEndpoints: [],
    registerEndpoint() {},
    apiKey,
    requests: [],
    script() {},
    recordViolation(message) {
      throw new Error(message)
    },
    assertComplete() {},
    async close() {}
  }
}
