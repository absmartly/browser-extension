import { fetchResource, requireEditorResources } from '../helpers/resource-prefetch'

test('recovers a transient timeout without fabricating empty data', async () => {
  const request = jest.fn().mockRejectedValueOnce(Object.assign(new Error('secret URL'), { name: 'AbortError' }))
    .mockResolvedValue({ ok: true, json: async () => ({ applications: [{ id: 1 }] }) })
  expect(await fetchResource('applications', request, async () => {})).toEqual([{ id: 1 }])
  expect(request).toHaveBeenCalledTimes(2)
})
test('exhaustion fails setup explicitly rather than returning a partial cache', async () => {
  const request = jest.fn().mockRejectedValue(Object.assign(new Error('secret'), { name: 'AbortError' }))
  await expect(fetchResource('applications', request, async () => {}, 2)).rejects.toThrow('Pre-fetch applications failed after 2 attempts: request timeout; cache not published')
})
test('non-retriable authentication failure is not retried or disguised', async () => {
  const request = jest.fn().mockResolvedValue({ ok: false, status: 401 })
  await expect(fetchResource('applications', request, async () => {})).rejects.toThrow('HTTP 401')
  expect(request).toHaveBeenCalledTimes(1)
})
test('valid optional empty response is preserved, missing required resources are rejected', async () => {
  expect(await fetchResource('metrics', async () => ({ ok: true, status: 200, json: async () => ({ metrics: [] }) }))).toEqual([])
  expect(() => requireEditorResources({ applications: [], unitTypes: [{ id: 1 }] })).toThrow('applications is empty')
  expect(() => requireEditorResources({ applications: [{ id: 1 }], unitTypes: [{ id: 1 }] })).not.toThrow()
})
