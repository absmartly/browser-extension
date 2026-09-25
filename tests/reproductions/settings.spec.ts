import { test as base, expect, chromium, type Page, type Route } from '@playwright/test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

// FT-2252: Settings typing, auth recovery, endpoint syntax and dialog keyboard
// behaviour in the packaged MV3 build. The sidebar is opened as a top-level
// extension page at sidebar widths; the ABsmartly API is a synthetic fixture.
const repo = path.resolve(__dirname, '../..')
const build = process.env.REPRO_BUILD || path.join(repo, 'build/chrome-mv3-prod')
const endpoint = 'https://fixture.absmartly.com'
const GOOD_KEY = 'synthetic-good-key'
const USER = { id: 7, first_name: 'Synthetic', last_name: 'Fixture', email: 'fixture@example.invalid' }
const EXPERIMENT = {
  id: 501, name: 'ft_2252_fixture', display_name: 'Settings fixture experiment', state: 'created', status: 'created',
  type: 'test', variants: [], unit_type: { unit_type_id: 1, name: 'u' }, applications: [], owners: [], teams: [],
  experiment_tags: [], created_at: '2026-09-01T00:00:00Z'
}
const WIDTHS = { default: 384, narrow: 240 }

type Fixture = { width: number; page: Page }

const test = base.extend<Fixture>({
  width: [WIDTHS.default, { option: true }],
  page: async ({ width }, use, testInfo) => {
    const manifest = JSON.parse(readFileSync(path.join(build, 'manifest.json'), 'utf8'))
    expect(manifest.manifest_version).toBe(3)
    const profile = mkdtempSync(path.join(tmpdir(), 'ft2252-'))
    const viewport = { width, height: 800 }
    const context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium', headless: process.env.HEADED !== '1', viewport,
      recordVideo: { dir: testInfo.outputPath('video'), size: viewport },
      args: [`--disable-extensions-except=${build}`, `--load-extension=${build}`],
    })
    const respond = (route: Route, data: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    await context.route('**/*', route => {
      const url = new URL(route.request().url())
      if (!/^https?:$/.test(url.protocol)) return route.continue()
      if (url.origin !== endpoint) return route.abort('blockedbyclient')
      const authorized = (route.request().headers()['authorization'] || '') === `Api-Key ${GOOD_KEY}`
      if (url.pathname === '/auth/current-user') return authorized ? respond(route, { user: USER }) : respond(route, { errors: ['unauthorized'] }, 401)
      if (url.pathname === '/v1/experiments') return authorized ? respond(route, { experiments: [EXPERIMENT], total: 1 }) : respond(route, { errors: ['unauthorized'] }, 401)
      return respond(route, { applications: [], unit_types: [], metrics: [], experiment_tags: [], users: [], teams: [], favorites: [] })
    })
    await context.tracing.start({ screenshots: true, snapshots: true })
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
    const page = context.pages()[0] || await context.newPage()
    try {
      await page.goto(`chrome-extension://${new URL(worker.url()).host}/tabs/sidebar.html`)
      await expect(page.locator('#configure-settings-button')).toBeVisible()
      await use(page)
    } finally {
      await page.screenshot({ path: testInfo.outputPath('final.png') }).catch(() => {})
      await context.tracing.stop({ path: testInfo.outputPath('trace.zip') })
      await context.close()
      rmSync(profile, { recursive: true, force: true })
    }
  },
})

const shot = (page: Page, name: string) => page.screenshot({ path: test.info().outputPath(`${name}.png`) })

const saveConfig = async (page: Page, key: string) => {
  await page.locator('#absmartly-endpoint').fill(endpoint)
  await page.locator('#auth-method-apikey').check()
  await page.locator('#api-key-input').fill(key)
  await page.locator('#save-settings-button').click()
  await expect(page.locator('#experiments-heading')).toBeVisible()
}

for (const [label, width] of Object.entries(WIDTHS)) {
  test.describe(`${label} sidebar width (${width}px)`, () => {
    test.use({ width })

    test('SET-1 AI provider inputs keep focus and value while typing', async ({ page }) => {
      await page.locator('#configure-settings-button').click()
      await page.locator('#vibe-studio-toggle').click()
      await page.locator('#ai-provider-select').selectOption('openai-api')
      const key = page.locator('#ai-api-key')
      await key.click()
      await key.pressSequentially('sk-synthetic')
      await shot(page, 'set1-01-ai-key-typed')
      await expect(key).toHaveValue('sk-synthetic')
      await expect(key).toBeFocused()

      await page.locator('#custom-openai-api-endpoint-summary').click()
      const custom = page.locator('#custom-openai-api-endpoint')
      await custom.click()
      await custom.pressSequentially('https://llm')
      await shot(page, 'set1-02-custom-endpoint-typed')
      await expect(custom).toHaveValue('https://llm')
      await expect(custom).toBeFocused()
      await expect(custom).toBeVisible()
      // Neighbouring controls stay usable: keyboard moves on from the field.
      await expect(page.locator('#ai-provider-select')).toHaveValue('openai-api')
      await expect(page.locator('#openai-api-model-select')).toBeVisible()
    })

    test('SET-4 unsaved-changes dialog traps focus, cancels on Escape and restores focus', async ({ page }) => {
      await page.locator('#configure-settings-button').click()
      await saveConfig(page, GOOD_KEY)
      await page.locator('#nav-settings').click()
      await page.locator('#application-name-input').fill('ft-2252-app')
      const back = page.locator('#header-back-button')
      await back.focus()
      await page.keyboard.press('Enter')
      const dialog = page.locator('#unsaved-changes-modal')
      await expect(dialog).toBeVisible()
      await expect(page.locator('#unsaved-changes-cancel')).toBeFocused()
      await shot(page, 'set4-01-dialog-open')
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press('Tab')
        expect(await page.evaluate(() => !!document.activeElement?.closest('#unsaved-changes-modal'))).toBe(true)
      }
      await page.keyboard.press('Shift+Tab')
      expect(await page.evaluate(() => !!document.activeElement?.closest('#unsaved-changes-modal'))).toBe(true)
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      await expect(back).toBeFocused()
      await expect(page.locator('#application-name-input')).toHaveValue('ft-2252-app')
      await shot(page, 'set4-02-after-escape')
      // Keyboard Discard still navigates back without saving.
      await page.keyboard.press('Enter')
      await expect(page.locator('#unsaved-changes-cancel')).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(page.locator('#unsaved-changes-discard')).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page.locator('#experiments-heading')).toBeVisible()
    })
  })
}

test('SET-2 correcting an invalid API key right after saving it authenticates the list', async ({ page }) => {
  await page.locator('#configure-settings-button').click()
  await saveConfig(page, 'synthetic-bad-key')
  await expect(page.locator('#not-logged-in-banner')).toBeVisible()
  await shot(page, 'set2-01-bad-key-list')
  await page.locator('#nav-settings').click()
  await page.locator('#api-key-input').fill(GOOD_KEY)
  await page.locator('#save-settings-button').click()
  await expect(page.locator('#experiments-heading')).toBeVisible()
  await expect(page.locator('#not-logged-in-banner')).toBeHidden()
  await expect(page.locator(`[data-experiment-name="${EXPERIMENT.name}"]`)).toBeVisible()
  await shot(page, 'set2-02-good-key-list')
})

for (const invalid of ['http://a b', 'https://exa mple.com', 'not a url']) {
  test(`SET-3 endpoint "${invalid}" is rejected and not saved`, async ({ page }) => {
    await page.locator('#configure-settings-button').click()
    await saveConfig(page, GOOD_KEY)
    await page.locator('#nav-settings').click()
    const field = page.locator('#absmartly-endpoint')
    await field.fill(invalid)
    await page.locator('#save-settings-button').click()
    await expect(page.locator('#absmartly-endpoint-error')).toHaveText('Invalid endpoint URL. Use a valid HTTP or HTTPS URL.')
    await expect(field).toBeFocused()
    await expect(page.locator('#nav-settings')).toHaveCount(0)
    await shot(page, `set3-${invalid.replace(/\W+/g, '-')}-rejected`)
    await page.reload()
    await page.locator('#nav-settings').click()
    await expect(field).toHaveValue(endpoint)
  })
}
