import { test, expect } from './fixture'

test('packaged iframe stays ready under inspection and reload/remount', async ({ page, sidebar, mount }) => {
  const welcome = sidebar.getByRole('button', { name: 'Configure Settings' })
  // Bounded persistence observation; readiness itself uses locator assertions.
  const end = Date.now() + 15000
  do {
    await expect(welcome).toBeVisible()
    expect(await page.locator('#absmartly-sidebar-iframe').getAttribute('srcdoc')).toBeNull()
    await page.screenshot()
  } while (Date.now() < end)
  await welcome.click()
  await expect(sidebar.getByRole('button', { name: 'Save Settings', exact: true })).toBeVisible()
  await sidebar.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(welcome).toBeVisible()
  await page.reload()
  await mount()
  await expect(welcome).toBeVisible()
})

test('empty endpoint Save exposes and focuses invalid field or visible error summary', async ({ page, sidebar }, testInfo) => {
  await sidebar.getByRole('button', { name: 'Configure Settings' }).click()
  const input = sidebar.getByPlaceholder('https://api.absmartly.com')
  await input.fill('')
  await sidebar.getByRole('button', { name: 'Save Settings', exact: true }).click()
  await expect(sidebar.getByText('API Endpoint is required', { exact: true })).toBeAttached()
  const feedback = async () => sidebar.locator('body').evaluate(body => {
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight && getComputedStyle(e).visibility !== 'hidden'
    }
    const field = body.querySelector('input[placeholder="https://api.absmartly.com"]')!
    const summary = [...body.querySelectorAll('[role="alert"]')].some(e => /endpoint|required/i.test(e.textContent || '') && visible(e))
    return { accessibleFeedback: (visible(field) && document.activeElement === field) || summary, rect: field.getBoundingClientRect().toJSON(), focus: document.activeElement?.textContent }
  })
  try {
    await expect.poll(async () => (await feedback()).accessibleFeedback).toBe(true)
  } finally {
    await testInfo.attach('validation-feedback', { body: JSON.stringify(await feedback(), null, 2), contentType: 'application/json' })
    await page.screenshot({ path: testInfo.outputPath('validation.png') })
  }
})

test('JWT settings reject malformed URL syntax instead of persisting it', async ({ page, sidebar, origin }, testInfo) => {
  await sidebar.getByRole('button', { name: 'Configure Settings' }).click()
  const endpoint = sidebar.getByPlaceholder('https://api.absmartly.com')
  await endpoint.fill(origin)
  await sidebar.getByRole('button', { name: 'Save Settings', exact: true }).click()
  await sidebar.getByRole('button', { name: 'Settings', exact: true }).click()
  await endpoint.fill('http://[')
  await sidebar.getByRole('button', { name: 'Save Settings', exact: true }).click()
  // Observe the UI outcome, but never accept a transient async error as proof
  // of rejection. Independently reload and read back the durable config via UI.
  await expect.poll(() => sidebar.locator('body').evaluate(body => {
    if (body.querySelector('button[aria-label="Settings"]')) return true
    const field = body.querySelector<HTMLInputElement>('input[placeholder="https://api.absmartly.com"]')
    return !!field && (!field.validity.valid || /invalid.*(url|endpoint)|(url|endpoint).*invalid/i.test(body.textContent || ''))
  })).toBe(true)
  await expect(sidebar.getByText('Invalid endpoint URL. Use a valid HTTP or HTTPS URL.', { exact: true })).toBeVisible()
  await expect(endpoint).toBeFocused()
  await page.screenshot({ path: testInfo.outputPath('invalid-url-rejected.png') })
  const src = await page.locator('#absmartly-sidebar-iframe').getAttribute('src')
  await page.reload()
  await page.evaluate(url => {
    const iframe = document.createElement('iframe')
    iframe.id = 'absmartly-sidebar-iframe'
    iframe.src = url!
    iframe.style.cssText = 'position:fixed;right:0;top:0;width:384px;height:100vh;border:0;background:white'
    document.body.appendChild(iframe)
  }, src)
  const configure = sidebar.getByRole('button', { name: 'Configure Settings', exact: true })
  const settings = sidebar.getByRole('button', { name: 'Settings', exact: true })
  await expect(configure.or(settings)).toBeVisible()
  await (await configure.isVisible() ? configure : settings).click()
  await expect(endpoint).toBeVisible()
  const stored = await endpoint.inputValue()
  await testInfo.attach('invalid-endpoint-readback', { body: JSON.stringify({ afterReload: true, visibleStoredValue: stored }), contentType: 'application/json' })
  expect(stored, 'Malformed URL must not survive Save and a fresh document load').not.toBe('http://[')
  expect(stored, 'Previous valid endpoint is preserved').toBe(origin)
})

for (const aliases of [false, true]) {
  test(`one SDK goal produces one debug row (${aliases ? 'context aliases' : 'single context reference'})`, async ({ page, sidebar, origin, mount }, testInfo) => {
    if (aliases) {
      await page.goto(`${origin}/?aliases=1`)
      await expect(page.locator('#sdk-status')).toHaveText('Offline SDK ready')
      await mount()
    }
    await sidebar.getByRole('button', { name: 'Configure Settings' }).click()
    await sidebar.getByPlaceholder('https://api.absmartly.com').fill(origin)
    await sidebar.getByRole('button', { name: 'Save Settings', exact: true }).click()
    await sidebar.getByRole('button', { name: 'Events Debug', exact: true }).click()
    await expect(sidebar.getByText('No events captured yet', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Queue one offline goal' }).click()
    const goals = sidebar.locator('#events-debug-event-list').getByText('goal', { exact: true })
    await expect(goals.first()).toBeVisible()
    const fixtureEvents = (await page.locator('#sdk-log').innerText()).trim().split('\n').map(line => JSON.parse(line))
    expect(fixtureEvents.filter(event => event.name === 'goal')).toHaveLength(1)
    await expect(page.locator('#absmartly-sidebar-iframe')).toHaveCount(1)
    try { await expect(goals).toHaveCount(1) } finally {
      await testInfo.attach('sdk-event-identity', { body: JSON.stringify({ aliases, fixtureEvents, sidebar: await sidebar.locator('body').innerText(), rows: await goals.count() }, null, 2), contentType: 'application/json' })
    }
    await page.screenshot({ path: testInfo.outputPath('one-goal-one-row.png') })
    for (let count = 2; count <= 4; count++) {
      await page.getByRole('button', { name: 'Queue one offline goal' }).click()
      await expect(goals).toHaveCount(count)
    }
    await sidebar.getByTitle('Pause', { exact: true }).click()
    await page.getByRole('button', { name: 'Queue one offline goal' }).click()
    await sidebar.getByTitle('Resume', { exact: true }).click()
    await page.getByRole('button', { name: 'Queue one offline goal' }).click()
    await expect(goals).toHaveCount(5)
    await sidebar.getByTitle('Clear all events', { exact: true }).click()
    await sidebar.getByRole('button', { name: 'Clear All', exact: true }).click()
    await expect(goals).toHaveCount(0)
    await page.getByRole('button', { name: 'Queue one offline goal' }).click()
    await expect(goals).toHaveCount(1)
    await sidebar.getByRole('button', { name: 'Go back', exact: true }).click()
    await sidebar.getByRole('button', { name: 'Events Debug', exact: true }).click()
    await expect(goals).toHaveCount(1)
    await page.getByRole('button', { name: 'Queue one offline goal' }).click()
    await expect(goals).toHaveCount(2)
  })
}

test('missing API key is focused and visible', async ({ sidebar, origin }) => {
  await sidebar.getByRole('button', { name: 'Configure Settings' }).click()
  await sidebar.getByPlaceholder('https://api.absmartly.com').fill(origin)
  await sidebar.locator('#auth-method-apikey').check()
  await sidebar.getByRole('button', { name: 'Save Settings', exact: true }).click()
  await expect(sidebar.locator('#api-key-input')).toBeFocused()
  await expect(sidebar.locator('#api-key-input')).toBeInViewport()
  await expect(sidebar.getByText('API Key is required when using API Key authentication', { exact: true })).toBeVisible()
})
