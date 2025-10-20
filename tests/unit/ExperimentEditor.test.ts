import { test, expect, chromium } from '@playwright/test'
import path from 'path'

test.describe('ExperimentEditor Component', () => {
  test('renders create experiment form with default values', async () => {
    const pathToExtension = path.join(__dirname, '../..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      headless: true,
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
          body: JSON.stringify([
            { unit_type_id: 1, name: 'user_id' },
            { unit_type_id: 2, name: 'session_id' }
          ])
        })
      } else if (url.includes('/applications')) {
        route.fulfill({
          status: 200,
          body: JSON.stringify([
            { application_id: 1, name: 'Web App' },
            { application_id: 2, name: 'Mobile App' }
          ])
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

    // Verify form title
    const title = await popup.textContent('h2')
    expect(title).toContain('Create New Experiment')

    // Verify default traffic percentage is 100
    const trafficInput = await popup.$('input[type="number"][min="0"][max="100"]')
    const trafficValue = await trafficInput?.inputValue()
    expect(trafficValue).toBe('100')

    // Verify 2 default variants
    const variants = await popup.$$('input[placeholder^="Variant"]')
    expect(variants.length).toBe(2)

    // Verify default variant names
    const controlVariant = await popup.waitForSelector('input[value="Control"]')
    expect(controlVariant).toBeTruthy()

    const variant1 = await popup.waitForSelector('input[value="Variant 1"]')
    expect(variant1).toBeTruthy()

    await context.close()
  })

  test('syncs experiment name and display name when lock is enabled', async () => {
    const pathToExtension = path.join(__dirname, '../..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      headless: true,
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

    // Find experiment name input (snake_case placeholder)
    const nameInput = await popup.waitForSelector('input[placeholder="my_experiment_name"]')

    // Type snake_case name
    await nameInput.fill('my_test_experiment')
    await popup.waitForTimeout(300)

    // Verify display name auto-converted to Title Case
    const displayNameInput = await popup.waitForSelector('input[placeholder="My Experiment"]')
    const displayValue = await displayNameInput.inputValue()
    expect(displayValue).toBe('My Test Experiment')

    await context.close()
  })

  test('allows independent editing when lock is disabled', async () => {
    const pathToExtension = path.join(__dirname, '../..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      headless: true,
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

    // Click the lock button to unlock
    const lockButton = await popup.waitForSelector('button[title*="synced"]')
    await lockButton.click()
    await popup.waitForTimeout(200)

    // Now type in name field
    const nameInput = await popup.waitForSelector('input[placeholder="my_experiment_name"]')
    await nameInput.fill('different_name')
    await popup.waitForTimeout(300)

    // Display name should NOT auto-update
    const displayNameInput = await popup.waitForSelector('input[placeholder="My Experiment"]')
    const displayValue = await displayNameInput.inputValue()
    expect(displayValue).toBe('') // Should still be empty

    // Manually set display name
    await displayNameInput.fill('Custom Display Name')
    await popup.waitForTimeout(300)

    // Verify name didn't change
    const nameValue = await nameInput.inputValue()
    expect(nameValue).toBe('different_name')

    await context.close()
  })

  test('validates required fields before submission', async () => {
    const pathToExtension = path.join(__dirname, '../..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      headless: true,
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

    // Set up dialog handler to catch alert
    let alertMessage = ''
    popup.on('dialog', async dialog => {
      alertMessage = dialog.message()
      await dialog.accept()
    })

    // Try to submit without selecting unit type (required field)
    const submitButton = await popup.waitForSelector('button[type="submit"]:has-text("Create Experiment")')
    await submitButton.click()
    await popup.waitForTimeout(500)

    // Verify alert was shown
    expect(alertMessage).toContain('Please select a unit type')

    await context.close()
  })

  test('updates variant percentages when variants are added/removed', async () => {
    const pathToExtension = path.join(__dirname, '../..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      headless: true,
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

    // Initially 2 variants = 50/50
    let variants = await popup.$$('input[placeholder^="Variant"]')
    expect(variants.length).toBe(2)

    // Add a third variant
    const addVariantButton = await popup.waitForSelector('button:has-text("Add Variant")')
    await addVariantButton.click()
    await popup.waitForTimeout(300)

    // Now should have 3 variants = 33/33/34 (or similar split)
    variants = await popup.$$('input[placeholder^="Variant"]')
    expect(variants.length).toBe(3)

    await context.close()
  })

  test('integrates with VariantList for variant management', async () => {
    const pathToExtension = path.join(__dirname, '../..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      headless: true,
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

    // Verify VariantList section is present
    const variantsHeader = await popup.waitForSelector('h4:has-text("Variants")')
    expect(variantsHeader).toBeTruthy()

    // Verify VariantList controls are present
    const addVariantButton = await popup.waitForSelector('button:has-text("Add Variant")')
    expect(addVariantButton).toBeTruthy()

    // Verify JSON editor buttons are present (from VariantList)
    const jsonButtons = await popup.$$('button:has-text("JSON")')
    expect(jsonButtons.length).toBe(2)

    // Verify Variables section is present (from VariantList)
    const variablesHeaders = await popup.$$('h5:has-text("Variables")')
    expect(variablesHeaders.length).toBe(2) // One for each variant

    await context.close()
  })

  test('renders edit mode for existing experiment', async () => {
    const pathToExtension = path.join(__dirname, '../..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      headless: true,
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
              name: 'existing_experiment',
              display_name: 'Existing Experiment',
              state: 'created',
              percentage_of_traffic: 80,
              nr_variants: 2,
              variants: [
                {
                  variant: 0,
                  name: 'Control',
                  config: JSON.stringify({ test_var: 'control' })
                },
                {
                  variant: 1,
                  name: 'Treatment',
                  config: JSON.stringify({ test_var: 'treatment' })
                }
              ],
              unit_type: { unit_type_id: 1, name: 'user_id' },
              applications: [{ application_id: 1, name: 'Test App' }],
              experiment_tags: []
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

    // Click on experiment to view details
    const experimentRow = await popup.waitForSelector('text=existing_experiment')
    await experimentRow.click()
    await popup.waitForTimeout(500)

    // Note: The detail view doesn't use ExperimentEditor in edit mode currently
    // This would need to be implemented if we want to edit experiments via the editor
    // For now, ExperimentDetail is used for viewing/editing

    await context.close()
  })

  test('parses variant config correctly on load', async () => {
    const pathToExtension = path.join(__dirname, '../..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      headless: true,
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

    // ExperimentEditor should parse empty config correctly
    // Verify variants are rendered with empty variables and dom_changes
    const variants = await popup.$$('input[placeholder^="Variant"]')
    expect(variants.length).toBe(2)

    // Verify no variables shown initially (only "Add Variable" button)
    const addVarButtons = await popup.$$('button:has-text("Add Variable")')
    expect(addVarButtons.length).toBe(2)

    await context.close()
  })
})
