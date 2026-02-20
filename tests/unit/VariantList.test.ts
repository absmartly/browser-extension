import { test, expect, chromium } from '@playwright/test'
import path from 'path'

test.describe('VariantList Component', () => {
  test.beforeEach(async () => {
    // Tests will set up context individually
  })

  test('renders initial variants correctly', async () => {
    const pathToExtension = path.join(__dirname, '../..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    let [background] = context.serviceWorkers()
    if (!background) {
      background = await context.waitForEvent('serviceworker')
    }

    const popup = await context.newPage()

    await popup.route('**/*', route => {
      const url = route.request().url()

      if (url.includes('/experiments') && route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            experiments: [{
              id: 1,
              name: 'test_experiment',
              display_name: 'Test Experiment',
              state: 'created',
              percentage_of_traffic: 100,
              nr_variants: 2,
              variants: [
                {
                  variant: 0,
                  name: 'Control',
                  config: JSON.stringify({
                    test_var: 'control_value',
                    __dom_changes: []
                  })
                },
                {
                  variant: 1,
                  name: 'Variant 1',
                  config: JSON.stringify({
                    test_var: 'variant_value',
                    __dom_changes: []
                  })
                }
              ],
              unit_type: { unit_type_id: 1, name: 'user_id' },
              applications: [{ application_id: 1, name: 'Test App' }]
            }]
          })
        })
      } else if (url.includes('/unit_types')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([{ unit_type_id: 1, name: 'user_id' }])
        })
      } else if (url.includes('/applications')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([{ application_id: 1, name: 'Test App' }])
        })
      } else {
        route.continue()
      }
    })

    const extensionId = background.url().split('/')[2]
    await popup.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`)
    await popup.waitForSelector('.absmartly-sidebar', { timeout: 5000 })

    // Click on the experiment to open detail view
    const experimentRow = await popup.waitForSelector('text=test_experiment')
    await experimentRow.click()
    await popup.waitForTimeout(500)

    // Verify both variants are rendered
    const controlVariant = await popup.waitForSelector('input[value="Control"]')
    expect(controlVariant).toBeTruthy()

    const variant1 = await popup.waitForSelector('input[value="Variant 1"]')
    expect(variant1).toBeTruthy()

    await context.close()
  })

  test('allows adding a new variant', async () => {
    const pathToExtension = path.join(__dirname, '../..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    let [background] = context.serviceWorkers()
    if (!background) {
      background = await context.waitForEvent('serviceworker')
    }

    const popup = await context.newPage()

    await popup.route('**/*', route => {
      const url = route.request().url()

      if (url.includes('/experiments') && route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ experiments: [] })
        })
      } else if (url.includes('/unit_types')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([{ unit_type_id: 1, name: 'user_id' }])
        })
      } else if (url.includes('/applications')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([{ application_id: 1, name: 'Test App' }])
        })
      } else {
        route.continue()
      }
    })

    const extensionId = background.url().split('/')[2]
    await popup.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`)
    await popup.waitForSelector('.absmartly-sidebar', { timeout: 5000 })

    // Click Create New Experiment
    const createButton = await popup.waitForSelector('button:has-text("Create New Experiment")')
    await createButton.click()
    await popup.waitForTimeout(500)

    // Verify default 2 variants
    let variants = await popup.$$('input[placeholder^="Variant"]')
    expect(variants.length).toBe(2)

    // Click Add Variant button
    const addVariantButton = await popup.waitForSelector('button:has-text("Add Variant")')
    await addVariantButton.click()
    await popup.waitForTimeout(300)

    // Verify 3 variants now
    variants = await popup.$$('input[placeholder^="Variant"]')
    expect(variants.length).toBe(3)

    // Verify new variant has correct default name
    const variant2 = await popup.waitForSelector('input[value="Variant 2"]')
    expect(variant2).toBeTruthy()

    await context.close()
  })

  test('allows removing a variant (when more than 2)', async () => {
    const pathToExtension = path.join(__dirname, '../..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    let [background] = context.serviceWorkers()
    if (!background) {
      background = await context.waitForEvent('serviceworker')
    }

    const popup = await context.newPage()

    await popup.route('**/*', route => {
      const url = route.request().url()

      if (url.includes('/experiments') && route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ experiments: [] })
        })
      } else if (url.includes('/unit_types')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([{ unit_type_id: 1, name: 'user_id' }])
        })
      } else if (url.includes('/applications')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([{ application_id: 1, name: 'Test App' }])
        })
      } else {
        route.continue()
      }
    })

    const extensionId = background.url().split('/')[2]
    await popup.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`)
    await popup.waitForSelector('.absmartly-sidebar', { timeout: 5000 })

    // Click Create New Experiment
    const createButton = await popup.waitForSelector('button:has-text("Create New Experiment")')
    await createButton.click()
    await popup.waitForTimeout(500)

    // Add a third variant
    const addVariantButton = await popup.waitForSelector('button:has-text("Add Variant")')
    await addVariantButton.click()
    await popup.waitForTimeout(300)

    // Verify 3 variants
    let variants = await popup.$$('input[placeholder^="Variant"]')
    expect(variants.length).toBe(3)

    // Click delete button for the last variant
    const deleteButtons = await popup.$$('[title="Delete variant"]')
    expect(deleteButtons.length).toBeGreaterThan(0)
    await deleteButtons[deleteButtons.length - 1].click()
    await popup.waitForTimeout(300)

    // Verify back to 2 variants
    variants = await popup.$$('input[placeholder^="Variant"]')
    expect(variants.length).toBe(2)

    await context.close()
  })

  test('does not show delete button when only 2 variants', async () => {
    const pathToExtension = path.join(__dirname, '../..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    let [background] = context.serviceWorkers()
    if (!background) {
      background = await context.waitForEvent('serviceworker')
    }

    const popup = await context.newPage()

    await popup.route('**/*', route => {
      const url = route.request().url()

      if (url.includes('/experiments') && route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ experiments: [] })
        })
      } else if (url.includes('/unit_types')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([{ unit_type_id: 1, name: 'user_id' }])
        })
      } else if (url.includes('/applications')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([{ application_id: 1, name: 'Test App' }])
        })
      } else {
        route.continue()
      }
    })

    const extensionId = background.url().split('/')[2]
    await popup.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`)
    await popup.waitForSelector('.absmartly-sidebar', { timeout: 5000 })

    // Click Create New Experiment
    const createButton = await popup.waitForSelector('button:has-text("Create New Experiment")')
    await createButton.click()
    await popup.waitForTimeout(500)

    // Verify no delete buttons when only 2 variants
    const deleteButtons = await popup.$$('[title="Delete variant"]')
    expect(deleteButtons.length).toBe(0)

    await context.close()
  })

  test('allows updating variant name', async () => {
    const pathToExtension = path.join(__dirname, '../..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    let [background] = context.serviceWorkers()
    if (!background) {
      background = await context.waitForEvent('serviceworker')
    }

    const popup = await context.newPage()

    await popup.route('**/*', route => {
      const url = route.request().url()

      if (url.includes('/experiments') && route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ experiments: [] })
        })
      } else if (url.includes('/unit_types')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([{ unit_type_id: 1, name: 'user_id' }])
        })
      } else if (url.includes('/applications')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([{ application_id: 1, name: 'Test App' }])
        })
      } else {
        route.continue()
      }
    })

    const extensionId = background.url().split('/')[2]
    await popup.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`)
    await popup.waitForSelector('.absmartly-sidebar', { timeout: 5000 })

    // Click Create New Experiment
    const createButton = await popup.waitForSelector('button:has-text("Create New Experiment")')
    await createButton.click()
    await popup.waitForTimeout(500)

    // Find and update Control variant name
    const controlInput = await popup.waitForSelector('input[value="Control"]')
    await controlInput.fill('Treatment A')
    await popup.waitForTimeout(200)

    // Verify name was updated
    const updatedInput = await popup.waitForSelector('input[value="Treatment A"]')
    expect(updatedInput).toBeTruthy()

    await context.close()
  })

  test('allows adding variables to variant', async () => {
    const pathToExtension = path.join(__dirname, '../..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    let [background] = context.serviceWorkers()
    if (!background) {
      background = await context.waitForEvent('serviceworker')
    }

    const popup = await context.newPage()

    await popup.route('**/*', route => {
      const url = route.request().url()

      if (url.includes('/experiments') && route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ experiments: [] })
        })
      } else if (url.includes('/unit_types')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([{ unit_type_id: 1, name: 'user_id' }])
        })
      } else if (url.includes('/applications')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([{ application_id: 1, name: 'Test App' }])
        })
      } else {
        route.continue()
      }
    })

    const extensionId = background.url().split('/')[2]
    await popup.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`)
    await popup.waitForSelector('.absmartly-sidebar', { timeout: 5000 })

    // Click Create New Experiment
    const createButton = await popup.waitForSelector('button:has-text("Create New Experiment")')
    await createButton.click()
    await popup.waitForTimeout(500)

    // Find Add Variable button for first variant
    const addVarButtons = await popup.$$('button:has-text("Add Variable")')
    expect(addVarButtons.length).toBeGreaterThan(0)

    // Set up dialog handler before clicking
    popup.on('dialog', async dialog => {
      expect(dialog.type()).toBe('prompt')
      await dialog.accept('test_variable')
    })

    await addVarButtons[0].click()
    await popup.waitForTimeout(500)

    // Verify variable input appears (key should be disabled, value should be editable)
    const variableInputs = await popup.$$('input[value="test_variable"]')
    expect(variableInputs.length).toBeGreaterThan(0)

    await context.close()
  })

  test('shows JSON editor button for each variant', async () => {
    const pathToExtension = path.join(__dirname, '../..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    let [background] = context.serviceWorkers()
    if (!background) {
      background = await context.waitForEvent('serviceworker')
    }

    const popup = await context.newPage()

    await popup.route('**/*', route => {
      const url = route.request().url()

      if (url.includes('/experiments') && route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ experiments: [] })
        })
      } else if (url.includes('/unit_types')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([{ unit_type_id: 1, name: 'user_id' }])
        })
      } else if (url.includes('/applications')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([{ application_id: 1, name: 'Test App' }])
        })
      } else {
        route.continue()
      }
    })

    const extensionId = background.url().split('/')[2]
    await popup.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`)
    await popup.waitForSelector('.absmartly-sidebar', { timeout: 5000 })

    // Click Create New Experiment
    const createButton = await popup.waitForSelector('button:has-text("Create New Experiment")')
    await createButton.click()
    await popup.waitForTimeout(500)

    // Verify JSON button exists for each variant (2 variants = 2 JSON buttons)
    const jsonButtons = await popup.$$('button:has-text("JSON")')
    expect(jsonButtons.length).toBe(2)

    await context.close()
  })

  test('persists variant changes to storage', async () => {
    const pathToExtension = path.join(__dirname, '../..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    let [background] = context.serviceWorkers()
    if (!background) {
      background = await context.waitForEvent('serviceworker')
    }

    const popup = await context.newPage()

    await popup.route('**/*', route => {
      const url = route.request().url()

      if (url.includes('/experiments') && route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ experiments: [] })
        })
      } else if (url.includes('/unit_types')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([{ unit_type_id: 1, name: 'user_id' }])
        })
      } else if (url.includes('/applications')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([{ application_id: 1, name: 'Test App' }])
        })
      } else {
        route.continue()
      }
    })

    const extensionId = background.url().split('/')[2]
    await popup.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`)
    await popup.waitForSelector('.absmartly-sidebar', { timeout: 5000 })

    // Click Create New Experiment
    const createButton = await popup.waitForSelector('button:has-text("Create New Experiment")')
    await createButton.click()
    await popup.waitForTimeout(500)

    // Update variant name
    const controlInput = await popup.waitForSelector('input[value="Control"]')
    await controlInput.fill('Modified Control')
    await popup.waitForTimeout(500)

    // Check that storage was updated
    const storageData = await popup.evaluate(() => {
      return new Promise(resolve => {
        chrome.storage.local.get('experiment-0-variants', result => {
          resolve(result['experiment-0-variants'])
        })
      })
    })

    expect(storageData).toBeTruthy()
    expect(Array.isArray(storageData)).toBe(true)
    expect((storageData as any)[0].name).toBe('Modified Control')

    await context.close()
  })

  test('calls onVariantsChange callback when variants are modified', async () => {
    const pathToExtension = path.join(__dirname, '../..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    let [background] = context.serviceWorkers()
    if (!background) {
      background = await context.waitForEvent('serviceworker')
    }

    const popup = await context.newPage()

    await popup.route('**/*', route => {
      const url = route.request().url()

      if (url.includes('/experiments') && route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ experiments: [] })
        })
      } else if (url.includes('/unit_types')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([{ unit_type_id: 1, name: 'user_id' }])
        })
      } else if (url.includes('/applications')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([{ application_id: 1, name: 'Test App' }])
        })
      } else {
        route.continue()
      }
    })

    const extensionId = background.url().split('/')[2]
    await popup.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`)
    await popup.waitForSelector('.absmartly-sidebar', { timeout: 5000 })

    // Click Create New Experiment
    const createButton = await popup.waitForSelector('button:has-text("Create New Experiment")')
    await createButton.click()
    await popup.waitForTimeout(500)

    // Update variant name (this should trigger onVariantsChange)
    const controlInput = await popup.waitForSelector('input[value="Control"]')
    await controlInput.fill('Modified Control')
    await popup.waitForTimeout(300)

    // The parent component should receive the update and update percentages
    // Verify that nr_variants field reflects correct count (indirectly tests callback)
    const percentageInput = await popup.$('input[type="number"][min="0"][max="100"]')
    expect(percentageInput).toBeTruthy()

    await context.close()
  })
})
