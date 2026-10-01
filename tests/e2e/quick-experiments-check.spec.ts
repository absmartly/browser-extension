import { test, expect } from '../fixtures/extension'
import { setupTestPage } from './utils/test-helpers'
import { experimentRecord } from '../helpers/management-api/records'

const TEST_PAGE_URL = '/visual-editor-test.html'

// The sidebar's first list request is issued only after config/auth and
// editor-resource loading, so "no loading spinner" can be observed before
// loading has begun. Wait for the list response itself, then for the exact
// rendered outcome of that response.
async function openAndAwaitList(context: any, extensionUrl: (p: string) => string) {
  const listResponse = context.waitForEvent('response', {
    predicate: (r: any) => r.request().method() === 'GET' && new URL(r.url()).pathname === '/v1/experiments'
  })
  const testPage = await context.newPage()
  const { sidebar } = await setupTestPage(testPage, extensionUrl, TEST_PAGE_URL)
  const response = await listResponse
  expect(response.status()).toBe(200)
  return { testPage, sidebar, body: await response.json() }
}

test.describe('Quick Experiments Check', () => {
  test('Check experiments are loading from API', async ({ context, extensionUrl, managementApi }) => {
    managementApi.state.experiments.push(
      experimentRecord({ name: 'quick_check_draft', display_name: 'Quick Check Draft', state: 'created', created_at: '2026-09-02T10:00:00.000Z' }),
      experimentRecord({ name: 'quick_check_ready', display_name: 'Quick Check Ready', state: 'ready', created_at: '2026-09-01T10:00:00.000Z' })
    )
    const { testPage, sidebar, body } = await openAndAwaitList(context, extensionUrl)

    expect(body.experiments.map((e: any) => e.name)).toEqual(['quick_check_draft', 'quick_check_ready'])
    await expect.poll(() => sidebar.locator('[data-testid="experiment-list-item"] [data-experiment-name]')
      .evaluateAll(nodes => nodes.map(n => n.getAttribute('data-experiment-name'))))
      .toEqual(['quick_check_draft', 'quick_check_ready'])
    await expect(sidebar.locator('#no-experiments-message')).toHaveCount(0)
    await testPage.close()
  })

  test('shows the empty state when the API returns no experiments', async ({ context, extensionUrl, managementApi }) => {
    const { testPage, sidebar, body } = await openAndAwaitList(context, extensionUrl)
    expect(body.experiments).toEqual([])
    expect(managementApi.callsTo('GET', '/v1/experiments').length).toBeGreaterThan(0)
    await expect(sidebar.locator('#no-experiments-message')).toHaveText('No experiments found')
    await expect(sidebar.locator('[data-testid="experiment-list-item"]')).toHaveCount(0)
    await testPage.close()
  })
})
