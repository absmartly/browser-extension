/** @jest-environment node */
import { forward } from '../helpers/network-boundary'

// A fake Route: only the members forward() uses.
const route = (fetchImpl: () => Promise<any>, fulfill = jest.fn()) => ({
  request: () => ({ url: () => 'https://e2e-api.absmartly.com/v1/applications?items=1' }),
  fetch: jest.fn(fetchImpl),
  fulfill
}) as any

test('forwards to the loopback target with path and query', async () => {
  const fulfill = jest.fn()
  const r = route(async () => ({ body: async () => Buffer.from('{}'), status: () => 200, headers: () => ({}) }), fulfill)
  await forward(r, 'http://127.0.0.1:1234')
  expect(r.fetch).toHaveBeenCalledWith({ url: 'http://127.0.0.1:1234/v1/applications?items=1', maxRedirects: 0 })
  expect(fulfill).toHaveBeenCalledWith({ status: 200, headers: {}, body: Buffer.from('{}') })
})

test('a requester disposed mid-forward is ignored at every stage', async () => {
  await expect(forward(route(async () => { throw new Error('Target page, context or browser has been closed') }), 'http://x')).resolves.toBeUndefined()
  await expect(forward(route(async () => ({ body: async () => { throw new Error('apiResponse.body: Response has been disposed') } })), 'http://x')).resolves.toBeUndefined()
  const fulfill = jest.fn(async () => { throw new Error('route.fulfill: Fetch response has been disposed') })
  await expect(forward(route(async () => ({ body: async () => Buffer.from(''), status: () => 200, headers: () => ({}) }), fulfill), 'http://x')).resolves.toBeUndefined()
})

test('any other forwarding failure still surfaces', async () => {
  await expect(forward(route(async () => { throw new Error('connect ECONNREFUSED 127.0.0.1:1234') }), 'http://x')).rejects.toThrow(/ECONNREFUSED/)
})
