import type { BrowserContext, Route } from '@playwright/test'

// Fail-closed network boundary for the deterministic suite. Every http(s)
// request from pages, extension pages and the MV3 service worker is either
// fulfilled by a controlled local server or aborted and recorded.
export type EgressViolation = { method: string; url: string; source: string }

export interface NetworkBoundary {
  violations: EgressViolation[]
  handleRoute(route: Route): Promise<boolean>
  assertNoViolations(): void
}

// Forward with the original method/headers/body and fulfill from a buffered
// copy, so a page or worker that goes away mid-request cannot leave Playwright
// fulfilling from a disposed response.
const GONE = /closed|disposed|Target page/
export const forward = async (route: Route, target: string) => {
  const url = new URL(route.request().url())
  try {
    const response = await route.fetch({ url: target + url.pathname + url.search, maxRedirects: 0 })
    const body = await response.body()
    await route.fulfill({ status: response.status(), headers: response.headers(), body })
  } catch (error) {
    // The requesting page/worker went away mid-forward (test teardown). The
    // fixture server still validated and recorded the request itself.
    if (GONE.test(String(error))) return
    throw error
  }
}

export async function installNetworkBoundary(
  context: BrowserContext,
  options: { allowedOrigins: string[]; forwards: Record<string, string> }
): Promise<NetworkBoundary> {
  const violations: EgressViolation[] = []
  const allowed = new Set(options.allowedOrigins)
  const handleRoute = async (route: Route): Promise<boolean> => {
    const url = new URL(route.request().url())
    if (!/^https?:$/.test(url.protocol)) return false
    const target = options.forwards[url.origin]
    if (target) {
      await forward(route, target)
      return true
    }
    if (allowed.has(url.origin)) return false
    const worker = route.request().serviceWorker()
    violations.push({ method: route.request().method(), url: `${url.origin}${url.pathname}`, source: worker ? 'service-worker' : (route.request().frame()?.url() || 'unknown') })
    await route.abort('blockedbyclient')
    return true
  }
  await context.route('**/*', async route => {
    if (!(await handleRoute(route))) await route.fallback()
  })
  return {
    violations,
    handleRoute,
    assertNoViolations: () => {
      if (violations.length) throw new Error(`Unexpected network egress:\n${violations.map(v => `- ${v.method} ${v.url} (${v.source})`).join('\n')}`)
    }
  }
}
