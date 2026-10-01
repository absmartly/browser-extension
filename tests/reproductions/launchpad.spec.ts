import { test, expect } from './fixture'

test('packaged iframe stays ready under inspection and reload/remount', async ({ page, sidebar, mount }) => {
  const welcome = sidebar.locator('#configure-settings-button')
  // Bounded persistence observation; readiness itself uses locator assertions.
  const end = Date.now() + 15000
  do {
    await expect(welcome).toBeVisible()
    expect(await page.locator('#absmartly-sidebar-iframe').getAttribute('srcdoc')).toBeNull()
    await page.screenshot()
  } while (Date.now() < end)
  await welcome.click()
  await expect(sidebar.locator('#save-settings-button')).toBeVisible()
  await sidebar.locator('#cancel-button').click()
  await expect(welcome).toBeVisible()
  await page.reload()
  await mount()
  await expect(welcome).toBeVisible()
})

test('empty endpoint Save exposes and focuses invalid field or visible error summary', async ({ page, sidebar }, testInfo) => {
  await sidebar.locator('#configure-settings-button').click()
  const input = sidebar.locator('#absmartly-endpoint')
  await input.fill('')
  await sidebar.locator('#save-settings-button').click()
  await expect(sidebar.locator('#absmartly-endpoint-error')).toHaveText('API Endpoint is required')
  const feedback = async () => sidebar.locator('body').evaluate(body => {
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight && getComputedStyle(e).visibility !== 'hidden'
    }
    const field = body.querySelector('#absmartly-endpoint')!
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
  await sidebar.locator('#configure-settings-button').click()
  const endpoint = sidebar.locator('#absmartly-endpoint')
  await endpoint.fill(origin)
  await sidebar.locator('#save-settings-button').click()
  await sidebar.locator('#nav-settings').click()
  await endpoint.fill('http://[')
  await sidebar.locator('#save-settings-button').click()
  // Observe the UI outcome, but never accept a transient async error as proof
  // of rejection. Independently reload and read back the durable config via UI.
  await expect.poll(() => sidebar.locator('body').evaluate(body => {
    if (body.querySelector('#nav-settings')) return true
    const field = body.querySelector<HTMLInputElement>('#absmartly-endpoint')
    return !!field && (!field.validity.valid || /invalid.*(url|endpoint)|(url|endpoint).*invalid/i.test(body.textContent || ''))
  })).toBe(true)
  await expect(sidebar.locator('#absmartly-endpoint-error')).toHaveText('Invalid endpoint URL. Use a valid HTTP or HTTPS URL.')
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
  const configure = sidebar.locator('#configure-settings-button')
  const settings = sidebar.locator('#nav-settings')
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
    await sidebar.locator('#configure-settings-button').click()
    await sidebar.locator('#absmartly-endpoint').fill(origin)
    await sidebar.locator('#save-settings-button').click()
    await sidebar.locator('#nav-events').click()
    await expect(sidebar.locator('#events-debug-empty-state')).toBeVisible()
    const queue = page.locator('#goal')
    const goals = sidebar.locator('#events-debug-event-list [data-testid="event-item"][data-event-name="goal"]')
    // The fixture numbers each goal; the row of the latest one proves all
    // earlier in-order broadcasts have arrived, so the count is settled.
    const goalRow = (seq: number) => goals.filter({ hasText: `"seq":${seq}` })
    await queue.click()
    await expect(goalRow(1)).toBeVisible()
    const fixtureEvents = (await page.locator('#sdk-log').innerText()).trim().split('\n').map(line => JSON.parse(line))
    expect(fixtureEvents.filter(event => event.name === 'goal')).toHaveLength(1)
    await expect(page.locator('#absmartly-sidebar-iframe')).toHaveCount(1)
    try { await expect(goals).toHaveCount(1) } finally {
      await testInfo.attach('sdk-event-identity', { body: JSON.stringify({ aliases, fixtureEvents, sidebar: await sidebar.locator('body').innerText(), rows: await goals.count() }, null, 2), contentType: 'application/json' })
    }
    await page.screenshot({ path: testInfo.outputPath('one-goal-one-row.png') })
    for (let count = 2; count <= 4; count++) {
      await queue.click()
      await expect(goalRow(count)).toBeVisible()
      await expect(goals).toHaveCount(count)
    }
    await sidebar.locator('#events-debug-pause-button').click()
    await expect(sidebar.locator('#events-debug-pause-status')).toBeVisible()
    await queue.click() // seq 5, dropped while paused
    await sidebar.locator('#events-debug-pause-button').click()
    await expect(sidebar.locator('#events-debug-pause-status')).toHaveCount(0)
    await queue.click() // seq 6
    await expect(goalRow(6)).toBeVisible()
    await expect(goalRow(5)).toHaveCount(0)
    await expect(goals).toHaveCount(5)
    await sidebar.locator('#events-debug-clear-button').click()
    await sidebar.locator('#clear-all-button').click()
    await expect(goals).toHaveCount(0)
    await queue.click()
    await expect(goalRow(7)).toBeVisible()
    await expect(goals).toHaveCount(1)
    await sidebar.locator('#header-back-button').click()
    await sidebar.locator('#nav-events').click()
    await expect(goals).toHaveCount(1)
    await queue.click()
    await expect(goalRow(8)).toBeVisible()
    await expect(goals).toHaveCount(2)
  })
}

test('missing API key is focused and visible', async ({ sidebar, origin }) => {
  await sidebar.locator('#configure-settings-button').click()
  await sidebar.locator('#absmartly-endpoint').fill(origin)
  await sidebar.locator('#auth-method-apikey').check()
  await sidebar.locator('#save-settings-button').click()
  await expect(sidebar.locator('#api-key-input')).toBeFocused()
  await expect(sidebar.locator('#api-key-input')).toBeInViewport()
  await expect(sidebar.locator('#api-key-input-error')).toHaveText('API Key is required when using API Key authentication')
})
