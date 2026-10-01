import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import tls from 'node:tls'

// Deterministic-mode guard for the Node test process (Playwright main process
// and workers). Outbound connections may only target loopback. Covered
// transports: global fetch (undici, by URL), http/https.request/get,
// net.connect/createConnection and tls.connect. Not covered: child processes
// (e.g. the static test server or the browser), raw dgram/UDP and DNS lookups
// that never connect. The browser itself is guarded by network-boundary.ts.
export type NodeEgressViolation = { transport: string; target: string }

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
const violations: NodeEgressViolation[] = []
let installed = false

export const nodeEgressViolations = () => [...violations]

function check(transport: string, host: string | undefined | null, target: string) {
  const name = (host || 'localhost').replace(/^\[|\]$/g, '')
  if (LOOPBACK.has(name) || LOOPBACK.has(`[${name}]`)) return
  violations.push({ transport, target })
  throw new Error(`Deterministic E2E blocked Node egress via ${transport} to ${target}`)
}

const hostOf = (args: any[]): [string | undefined, string] => {
  const [first, second] = args
  if (typeof first === 'string' || first instanceof URL) {
    const u = new URL(String(first))
    return [u.hostname, `${u.protocol}//${u.host}`]
  }
  const options = first && typeof first === 'object' ? first : second || {}
  const host = options.hostname ?? options.host
  return [host, `${host ?? 'localhost'}:${options.port ?? ''}`]
}

export function installNodeEgressGuard() {
  if (installed) return
  installed = true

  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url)
    check('fetch', url.hostname, `${url.protocol}//${url.host}`)
    return originalFetch(input, init)
  }) as typeof fetch

  for (const [name, mod] of [['http', http], ['https', https]] as const) {
    for (const method of ['request', 'get'] as const) {
      const original = (mod as any)[method]
      ;(mod as any)[method] = function (...args: any[]) {
        const [host, target] = hostOf(args)
        check(`${name}.${method}`, host, target)
        return original.apply(this, args)
      }
    }
  }

  for (const [name, mod, method] of [['net', net, 'connect'], ['net', net, 'createConnection'], ['tls', tls, 'connect']] as const) {
    const original = (mod as any)[method]
    ;(mod as any)[method] = function (...args: any[]) {
      const [first, second] = args
      // Unix sockets / pipes are local by definition.
      if (first && typeof first === 'object' && first.path) return original.apply(this, args)
      if (typeof first === 'string' && !/^\d+$/.test(first)) return original.apply(this, args)
      const host = typeof first === 'object' ? (first.host ?? first.servername) : typeof second === 'string' ? second : undefined
      const port = typeof first === 'object' ? first.port : first
      check(`${name}.${method}`, host, `${host ?? 'localhost'}:${port}`)
      return original.apply(this, args)
    }
  }
}
