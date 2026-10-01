/** @jest-environment node */
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import tls from 'node:tls'
import { installNodeEgressGuard, nodeEgressViolations } from '../helpers/node-egress-guard'

// Real transports: loopback must work; any other host must be refused before a
// connection is attempted (no DNS or network needed for the negative cases).
let server: http.Server
let port = 0
beforeAll(async () => {
  installNodeEgressGuard()
  server = http.createServer((_req, res) => res.end('ok'))
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  port = (server.address() as net.AddressInfo).port
})
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())) })

test('loopback fetch and http still work', async () => {
  expect(await (await fetch(`http://127.0.0.1:${port}/`)).text()).toBe('ok')
  const body = await new Promise<string>((resolve, reject) => {
    http.get({ host: 'localhost', port, path: '/' }, res => { let b = ''; res.on('data', c => { b += c }); res.on('end', () => resolve(b)) }).on('error', reject)
  })
  expect(body).toBe('ok')
})

test('non-loopback egress is refused and recorded on every guarded transport', async () => {
  const before = nodeEgressViolations().length
  await expect(fetch('https://dev-1.absmartly.com/v1/experiments')).rejects.toThrow(/blocked Node egress via fetch/)
  expect(() => https.get('https://registry.npmjs.org/')).toThrow(/via https.get/)
  expect(() => http.request({ hostname: 'example.org', port: 80 })).toThrow(/via http.request/)
  expect(() => net.connect({ host: 'example.org', port: 443 })).toThrow(/via net.connect/)
  expect(() => net.createConnection(443, 'example.org')).toThrow(/via net.createConnection/)
  expect(() => tls.connect({ host: 'example.org', port: 443 })).toThrow(/via tls.connect/)
  expect(nodeEgressViolations().slice(before).map(v => v.transport)).toEqual([
    'fetch', 'https.get', 'http.request', 'net.connect', 'net.createConnection', 'tls.connect'
  ])
})
