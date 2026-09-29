import type { BrowserContext } from "@playwright/test"

import { providerProbeResponse } from "./provider-probes"
import type { ProviderController } from "./provider-server"

export function isProviderURL(
  value: string,
  registeredEndpoints: readonly string[] = []
): boolean {
  const url = new URL(value)
  if (!/^https?:$/.test(url.protocol)) return false
  return (
    [
      "api.anthropic.com",
      "api.openai.com",
      "openrouter.ai",
      "generativelanguage.googleapis.com",
      "llmproxy.absmartly-dev.com"
    ].includes(url.hostname) ||
    registeredEndpoints.some((endpoint) => {
      const registered = new URL(endpoint)
      const prefix = registered.pathname.replace(/\/$/, "")
      return (
        registered.origin === url.origin &&
        (!prefix ||
          url.pathname === prefix ||
          url.pathname.startsWith(prefix + "/"))
      )
    }) ||
    (["localhost", "127.0.0.1"].includes(url.hostname) &&
      ["3000", "3001", "3002", "3003", "3004", "3010", "9000"].includes(
        url.port
      ))
  )
}

function hasInferenceProtocol(
  request: import("@playwright/test").Request
): boolean {
  // Custom inference endpoints must not escape merely because a new scenario
  // forgot to register one. Match provider protocol, never a generic URL path.
  if (request.headers()["anthropic-version"]) return true
  if (request.method() !== "POST") return false
  try {
    const body = request.postDataJSON()
    return Boolean(
      body &&
        ((typeof body.model === "string" && Array.isArray(body.messages)) ||
          (typeof body.session_id === "string" &&
            typeof body.cwd === "string" &&
            ["ask", "allow"].includes(body.permissionMode)) ||
          (Array.isArray(body.contents) &&
            /:generateContent$/.test(new URL(request.url()).pathname)))
    )
  } catch {
    return false
  }
}

export async function installProviderGuard(
  context: BrowserContext,
  provider: ProviderController
) {
  if (process.env.PLAYWRIGHT_DISABLE_SERVICE_WORKER_NETWORK)
    throw new Error(
      "Mock provider tests require service-worker network interception"
    )
  const allowedOrigin = new URL(provider.endpoint).origin
  const blocked = (request: import("@playwright/test").Request) =>
    new URL(request.url()).origin !== allowedOrigin &&
    (isProviderURL(request.url(), provider.registeredEndpoints) ||
      hasInferenceProtocol(request))
  const guard = async (
    route: import("@playwright/test").Route
  ): Promise<boolean> => {
    if (!blocked(route.request())) return false
    const url = new URL(route.request().url())
    const probe = providerProbeResponse(route.request().method(), url)
    if (probe) {
      await route.fulfill({
        status: probe.status,
        headers: probe.headers,
        body: JSON.stringify(probe.body)
      })
      return true
    }
    provider.recordViolation(
      `Blocked provider egress: ${route.request().method()} ${url.origin}${url.pathname}`
    )
    await route.abort("blockedbyclient")
    return true
  }
  const defaultGuard = async (route: import("@playwright/test").Route) => {
    if (!(await guard(route))) await route.fallback()
  }
  const originalContextRoute = context.route.bind(context)
  await originalContextRoute("**/*", defaultGuard)

  // Page routes take priority over context routes. Wrap later registrations
  // so a broad scenario route using continue() cannot bypass this boundary.
  const wrapRoutes = (
    target: BrowserContext | import("@playwright/test").Page
  ) => {
    const originalRoute = target.route.bind(target)
    const originalUnroute = target.unroute.bind(target)
    const wrapped = new Map<Function, any>()
    target.route = async (url, handler, options) => {
      let guarded = wrapped.get(handler)
      if (!guarded) {
        guarded = async (
          route: import("@playwright/test").Route,
          request: import("@playwright/test").Request
        ) => {
          if (!(await guard(route))) await handler(route, request)
        }
        wrapped.set(handler, guarded)
      }
      return await originalRoute(url, guarded, options)
    }
    target.unroute = async (url, handler) => {
      await originalUnroute(
        url,
        handler ? wrapped.get(handler) || handler : undefined
      )
      if (target === context && !handler)
        await originalContextRoute("**/*", defaultGuard)
    }
    const originalUnrouteAll = target.unrouteAll.bind(target)
    target.unrouteAll = async (options) => {
      await originalUnrouteAll(options)
      if (target === context) await originalContextRoute("**/*", defaultGuard)
    }
  }
  wrapRoutes(context)
  context.pages().forEach(wrapRoutes)
  context.on("page", wrapRoutes)
  // A scenario route must not silently swallow a forbidden request or turn it
  // into success; this observer also catches later route overrides.
  context.on("request", (request) => {
    if (
      blocked(request) &&
      !providerProbeResponse(request.method(), new URL(request.url()))
    ) {
      const url = new URL(request.url())
      provider.recordViolation(
        `Unexpected provider request: ${request.method()} ${url.origin}${url.pathname}`
      )
    }
  })
}
