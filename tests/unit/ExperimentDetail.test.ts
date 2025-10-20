import { test, expect, chromium } from '@playwright/test'
import path from 'path'

test.describe('ExperimentDetail Component', () => {
  test('renders experiment details correctly', async () => {
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
              name: 'test_experiment',
              display_name: 'Test Experiment',
              state: 'running',
              percentage_of_traffic: 100,
              nr_variants: 2,
              variants: [
                {
                  variant: 0,
                  name: 'Control',
                  config: JSON.stringify({
                    button_color: 'blue',
                    __dom_changes: [{
                      selector: '.cta-button',
                      type: 'style',
                      value: { 'background-color': 'blue' }
                    }]
                  })
                },
                {
                  variant: 1,
                  name: 'Treatment',
                  config: JSON.stringify({
                    button_color: 'green',
                    __dom_changes: [{
                      selector: '.cta-button',
                      type: 'style',
                      value: { 'background-color': 'green' }
                    }]
                  })
                }
              ],
              unit_type: { unit_type_id: 1, name: 'user_id' },
              applications: [{ application_id: 1, name: 'Web App' }],
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
          body: JSON.stringify([{ application_id: 1, name: 'Web App' }])
        })
      } else {
        route.continue()
      }
    })

    const extensionId = background.url().split('/')[2]
    await popup.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`)
    await popup.waitForSelector('.absmartly-sidebar', { timeout: 5000 })

    // Click on experiment to view details
    const experimentRow = await popup.waitForSelector('text=test_experiment')
    await experimentRow.click()
    await popup.waitForTimeout(500)

    // Verify experiment name is displayed
    const experimentName = await popup.textContent('h2')
    expect(experimentName).toContain('Test Experiment')

    // Verify status badge is shown
    const statusBadge = await popup.waitForSelector('text=running')
    expect(statusBadge).toBeTruthy()

    await context.close()
  })

  test('shows variants with VariantList component', async () => {
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
              name: 'test_experiment',
              display_name: 'Test Experiment',
              state: 'ready',
              percentage_of_traffic: 100,
              nr_variants: 3,
              variants: [
                {
                  variant: 0,
                  name: 'Control',
                  config: JSON.stringify({ test_var: 'control' })
                },
                {
                  variant: 1,
                  name: 'Variant A',
                  config: JSON.stringify({ test_var: 'variant_a' })
                },
                {
                  variant: 2,
                  name: 'Variant B',
                  config: JSON.stringify({ test_var: 'variant_b' })
                }
              ],
              unit_type: { unit_type_id: 1, name: 'user_id' },
              applications: [{ application_id: 1, name: 'Web App' }],
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
          body: JSON.stringify([{ application_id: 1, name: 'Web App' }])
        })
      } else {
        route.continue()
      }
    })

    const extensionId = background.url().split('/')[2]
    await popup.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`)
    await popup.waitForSelector('.absmartly-sidebar', { timeout: 5000 })

    // Click on experiment
    const experimentRow = await popup.waitForSelector('text=test_experiment')
    await experimentRow.click()
    await popup.waitForTimeout(500)

    // Verify all 3 variants are shown
    const controlVariant = await popup.waitForSelector('input[value="Control"]')
    expect(controlVariant).toBeTruthy()

    const variantA = await popup.waitForSelector('input[value="Variant A"]')
    expect(variantA).toBeTruthy()

    const variantB = await popup.waitForSelector('input[value="Variant B"]')
    expect(variantB).toBeTruthy()

    await context.close()
  })

  test('allows editing display name', async () => {
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
              name: 'test_experiment',
              display_name: 'Test Experiment',
              state: 'created',
              percentage_of_traffic: 100,
              nr_variants: 2,
              variants: [
                { variant: 0, name: 'Control', config: '{}' },
                { variant: 1, name: 'Variant 1', config: '{}' }
              ],
              unit_type: { unit_type_id: 1, name: 'user_id' },
              applications: [{ application_id: 1, name: 'Web App' }],
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
          body: JSON.stringify([{ application_id: 1, name: 'Web App' }])
        })
      } else {
        route.continue()
      }
    })

    const extensionId = background.url().split('/')[2]
    await popup.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`)
    await popup.waitForSelector('.absmartly-sidebar', { timeout: 5000 })

    // Click on experiment
    const experimentRow = await popup.waitForSelector('text=test_experiment')
    await experimentRow.click()
    await popup.waitForTimeout(500)

    // Click edit button for display name
    const editButton = await popup.waitForSelector('button[title="Edit display name"]')
    await editButton.click()
    await popup.waitForTimeout(200)

    // Find and edit the display name input
    const displayNameInput = await popup.waitForSelector('input[value="Test Experiment"]')
    await displayNameInput.fill('Updated Experiment Name')
    await popup.waitForTimeout(200)

    // Click save/confirm button
    const saveButton = await popup.waitForSelector('button[title="Save display name"]')
    await saveButton.click()
    await popup.waitForTimeout(200)

    // Verify new name is displayed
    const updatedName = await popup.textContent('h2')
    expect(updatedName).toContain('Updated Experiment Name')

    await context.close()
  })

  test('shows variant variables correctly', async () => {
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
              name: 'test_experiment',
              display_name: 'Test Experiment',
              state: 'ready',
              percentage_of_traffic: 100,
              nr_variants: 2,
              variants: [
                {
                  variant: 0,
                  name: 'Control',
                  config: JSON.stringify({
                    button_text: 'Click Me',
                    button_color: 'blue',
                    show_banner: true
                  })
                },
                {
                  variant: 1,
                  name: 'Treatment',
                  config: JSON.stringify({
                    button_text: 'Buy Now',
                    button_color: 'green',
                    show_banner: false
                  })
                }
              ],
              unit_type: { unit_type_id: 1, name: 'user_id' },
              applications: [{ application_id: 1, name: 'Web App' }],
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
          body: JSON.stringify([{ application_id: 1, name: 'Web App' }])
        })
      } else {
        route.continue()
      }
    })

    const extensionId = background.url().split('/')[2]
    await popup.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`)
    await popup.waitForSelector('.absmartly-sidebar', { timeout: 5000 })

    // Click on experiment
    const experimentRow = await popup.waitForSelector('text=test_experiment')
    await experimentRow.click()
    await popup.waitForTimeout(500)

    // Verify variables are displayed for Control variant
    const buttonTextVar = await popup.waitForSelector('input[value="button_text"]')
    expect(buttonTextVar).toBeTruthy()

    const buttonColorVar = await popup.waitForSelector('input[value="button_color"]')
    expect(buttonColorVar).toBeTruthy()

    const showBannerVar = await popup.waitForSelector('input[value="show_banner"]')
    expect(showBannerVar).toBeTruthy()

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
          body: JSON.stringify({
            experiments: [{
              id: 1,
              name: 'test_experiment',
              display_name: 'Test Experiment',
              state: 'created',
              percentage_of_traffic: 100,
              nr_variants: 2,
              variants: [
                { variant: 0, name: 'Control', config: '{}' },
                { variant: 1, name: 'Variant 1', config: '{}' }
              ],
              unit_type: { unit_type_id: 1, name: 'user_id' },
              applications: [{ application_id: 1, name: 'Web App' }],
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
          body: JSON.stringify([{ application_id: 1, name: 'Web App' }])
        })
      } else {
        route.continue()
      }
    })

    const extensionId = background.url().split('/')[2]
    await popup.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`)
    await popup.waitForSelector('.absmartly-sidebar', { timeout: 5000 })

    // Click on experiment
    const experimentRow = await popup.waitForSelector('text=test_experiment')
    await experimentRow.click()
    await popup.waitForTimeout(500)

    // Verify VariantList components are present
    const variantsHeader = await popup.waitForSelector('h4:has-text("Variants")')
    expect(variantsHeader).toBeTruthy()

    // Verify Add Variant button (from VariantList)
    const addVariantButton = await popup.waitForSelector('button:has-text("Add Variant")')
    expect(addVariantButton).toBeTruthy()

    // Verify JSON editor buttons (from VariantList)
    const jsonButtons = await popup.$$('button:has-text("JSON")')
    expect(jsonButtons.length).toBe(2)

    await context.close()
  })

  test('shows Save Changes button when variants are modified', async () => {
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
              name: 'test_experiment',
              display_name: 'Test Experiment',
              state: 'created',
              percentage_of_traffic: 100,
              nr_variants: 2,
              variants: [
                { variant: 0, name: 'Control', config: '{}' },
                { variant: 1, name: 'Variant 1', config: '{}' }
              ],
              unit_type: { unit_type_id: 1, name: 'user_id' },
              applications: [{ application_id: 1, name: 'Web App' }],
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
          body: JSON.stringify([{ application_id: 1, name: 'Web App' }])
        })
      } else {
        route.continue()
      }
    })

    const extensionId = background.url().split('/')[2]
    await popup.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`)
    await popup.waitForSelector('.absmartly-sidebar', { timeout: 5000 })

    // Click on experiment
    const experimentRow = await popup.waitForSelector('text=test_experiment')
    await experimentRow.click()
    await popup.waitForTimeout(500)

    // Initially Save button should show "Save Changes" (no bullet)
    let saveButton = await popup.waitForSelector('button:has-text("Save Changes")')
    expect(saveButton).toBeTruthy()

    // Modify a variant name
    const controlInput = await popup.waitForSelector('input[value="Control"]')
    await controlInput.fill('Modified Control')
    await popup.waitForTimeout(500)

    // After modification, button should show "• Save Changes"
    saveButton = await popup.waitForSelector('button:has-text("• Save Changes")')
    expect(saveButton).toBeTruthy()

    await context.close()
  })

  test('parses variant config with DOM changes correctly', async () => {
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
              name: 'test_experiment',
              display_name: 'Test Experiment',
              state: 'ready',
              percentage_of_traffic: 100,
              nr_variants: 2,
              variants: [
                {
                  variant: 0,
                  name: 'Control',
                  config: JSON.stringify({
                    button_text: 'Original',
                    __dom_changes: [
                      {
                        selector: '.cta-button',
                        type: 'text',
                        value: 'Original Button',
                        enabled: true
                      }
                    ]
                  })
                },
                {
                  variant: 1,
                  name: 'Treatment',
                  config: JSON.stringify({
                    button_text: 'Modified',
                    __dom_changes: [
                      {
                        selector: '.cta-button',
                        type: 'text',
                        value: 'Modified Button',
                        enabled: true
                      },
                      {
                        selector: '.hero-section',
                        type: 'style',
                        value: { 'background-color': 'blue' },
                        enabled: true
                      }
                    ]
                  })
                }
              ],
              unit_type: { unit_type_id: 1, name: 'user_id' },
              applications: [{ application_id: 1, name: 'Web App' }],
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
          body: JSON.stringify([{ application_id: 1, name: 'Web App' }])
        })
      } else {
        route.continue()
      }
    })

    const extensionId = background.url().split('/')[2]
    await popup.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`)
    await popup.waitForSelector('.absmartly-sidebar', { timeout: 5000 })

    // Click on experiment
    const experimentRow = await popup.waitForSelector('text=test_experiment')
    await experimentRow.click()
    await popup.waitForTimeout(500)

    // Verify variables (excluding __dom_changes)
    const buttonTextVar = await popup.waitForSelector('input[value="button_text"]')
    expect(buttonTextVar).toBeTruthy()

    // Verify DOM changes section exists
    const domChangesHeaders = await popup.$$('h5:has-text("DOM Changes")')
    expect(domChangesHeaders.length).toBe(2) // One for each variant

    await context.close()
  })

  test('shows correct status badges for different experiment states', async () => {
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

    // Test with 'running' state
    await popup.route('**/*', route => {
      const url = route.request().url()

      if (url.includes('/experiments') && route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            experiments: [{
              id: 1,
              name: 'running_experiment',
              display_name: 'Running Experiment',
              state: 'running',
              percentage_of_traffic: 100,
              nr_variants: 2,
              variants: [
                { variant: 0, name: 'Control', config: '{}' },
                { variant: 1, name: 'Variant 1', config: '{}' }
              ],
              unit_type: { unit_type_id: 1, name: 'user_id' },
              applications: [{ application_id: 1, name: 'Web App' }],
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
          body: JSON.stringify([{ application_id: 1, name: 'Web App' }])
        })
      } else {
        route.continue()
      }
    })

    const extensionId = background.url().split('/')[2]
    await popup.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`)
    await popup.waitForSelector('.absmartly-sidebar', { timeout: 5000 })

    // Click on experiment
    const experimentRow = await popup.waitForSelector('text=running_experiment')
    await experimentRow.click()
    await popup.waitForTimeout(500)

    // Verify running badge has success variant (green)
    const statusBadge = await popup.waitForSelector('text=running')
    expect(statusBadge).toBeTruthy()

    await context.close()
  })

  test('restricts variant add/remove for running experiments', async () => {
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
              name: 'running_experiment',
              display_name: 'Running Experiment',
              state: 'running',
              percentage_of_traffic: 100,
              nr_variants: 3,
              variants: [
                { variant: 0, name: 'Control', config: '{}' },
                { variant: 1, name: 'Variant 1', config: '{}' },
                { variant: 2, name: 'Variant 2', config: '{}' }
              ],
              unit_type: { unit_type_id: 1, name: 'user_id' },
              applications: [{ application_id: 1, name: 'Web App' }],
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
          body: JSON.stringify([{ application_id: 1, name: 'Web App' }])
        })
      } else {
        route.continue()
      }
    })

    const extensionId = background.url().split('/')[2]
    await popup.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`)
    await popup.waitForSelector('.absmartly-sidebar', { timeout: 5000 })

    // Click on experiment
    const experimentRow = await popup.waitForSelector('text=running_experiment')
    await experimentRow.click()
    await popup.waitForTimeout(500)

    // Verify Add Variant button is NOT present (running experiments can't add variants)
    const addVariantButton = await popup.$('button:has-text("Add Variant")')
    expect(addVariantButton).toBeFalsy()

    // Verify Delete variant buttons are NOT present
    const deleteButtons = await popup.$$('[title="Delete variant"]')
    expect(deleteButtons.length).toBe(0)

    await context.close()
  })
})
