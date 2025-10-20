import { test, expect, chromium } from '@playwright/test'
import path from 'path'

test.describe('ExperimentCodeInjection Component', () => {
  test('renders code injection section collapsed by default', async () => {
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
                {
                  variant: 0,
                  name: 'Control',
                  config: JSON.stringify({
                    test_var: 'value',
                    __inject_html: {
                      headStart: '<script>console.log("head start")</script>',
                      bodyEnd: '<script>console.log("body end")</script>'
                    }
                  })
                },
                {
                  variant: 1,
                  name: 'Variant 1',
                  config: '{}'
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

    // Verify Code Injection header exists
    const codeInjectionHeader = await popup.waitForSelector('text=Code Injection')
    expect(codeInjectionHeader).toBeTruthy()

    // Verify sections are collapsed by default (no code editor visible)
    const codeEditors = await popup.$$('textarea')
    expect(codeEditors.length).toBe(0)

    await context.close()
  })

  test('shows badge with count of non-empty code sections', async () => {
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
                {
                  variant: 0,
                  name: 'Control',
                  config: JSON.stringify({
                    test_var: 'value',
                    __inject_html: {
                      headStart: '<script>console.log("head start")</script>',
                      headEnd: '<script>console.log("head end")</script>',
                      bodyStart: '<script>console.log("body start")</script>'
                    }
                  })
                },
                {
                  variant: 1,
                  name: 'Variant 1',
                  config: '{}'
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

    // Verify badge shows count of 3 sections with code
    const badge = await popup.waitForSelector('text=3 sections')
    expect(badge).toBeTruthy()

    await context.close()
  })

  test('expands to show code sections when clicked', async () => {
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
                {
                  variant: 0,
                  name: 'Control',
                  config: JSON.stringify({
                    test_var: 'value',
                    __inject_html: {
                      headStart: '<script>console.log("test")</script>'
                    }
                  })
                },
                {
                  variant: 1,
                  name: 'Variant 1',
                  config: '{}'
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

    // Click to expand Code Injection section
    const codeInjectionHeader = await popup.waitForSelector('text=Code Injection')
    await codeInjectionHeader.click()
    await popup.waitForTimeout(300)

    // Verify all 4 code section headers are now visible
    const headStartHeader = await popup.waitForSelector('text=Top of <head>')
    expect(headStartHeader).toBeTruthy()

    const headEndHeader = await popup.waitForSelector('text=Bottom of <head>')
    expect(headEndHeader).toBeTruthy()

    const bodyStartHeader = await popup.waitForSelector('text=Top of <body>')
    expect(bodyStartHeader).toBeTruthy()

    const bodyEndHeader = await popup.waitForSelector('text=Bottom of <body>')
    expect(bodyEndHeader).toBeTruthy()

    await context.close()
  })

  test('shows URL filtering section', async () => {
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
                {
                  variant: 0,
                  name: 'Control',
                  config: JSON.stringify({
                    test_var: 'value',
                    __inject_html: {
                      headStart: '<script>console.log("test")</script>',
                      urlFilter: {
                        mode: 'simple',
                        include: ['*.example.com*'],
                        exclude: ['*/admin/*']
                      }
                    }
                  })
                },
                {
                  variant: 1,
                  name: 'Variant 1',
                  config: '{}'
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

    // Click to expand Code Injection section
    const codeInjectionHeader = await popup.waitForSelector('text=Code Injection')
    await codeInjectionHeader.click()
    await popup.waitForTimeout(300)

    // Verify URL Filter section exists
    const urlFilterHeader = await popup.waitForSelector('text=URL Filter')
    expect(urlFilterHeader).toBeTruthy()

    // Click to expand URL Filter section
    await urlFilterHeader.click()
    await popup.waitForTimeout(300)

    // Verify include pattern is shown
    const includeInput = await popup.waitForSelector('input[value="*.example.com*"]')
    expect(includeInput).toBeTruthy()

    // Verify exclude pattern is shown
    const excludeInput = await popup.waitForSelector('input[value="*/admin/*"]')
    expect(excludeInput).toBeTruthy()

    await context.close()
  })

  test('shows "Copy URL filter from DOM changes" button when DOM changes have URL filter', async () => {
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
                {
                  variant: 0,
                  name: 'Control',
                  config: JSON.stringify({
                    test_var: 'value',
                    __dom_changes: {
                      changes: [],
                      urlFilter: {
                        mode: 'simple',
                        include: ['*.test.com*'],
                        exclude: []
                      }
                    },
                    __inject_html: {
                      headStart: '<script>console.log("test")</script>'
                    }
                  })
                },
                {
                  variant: 1,
                  name: 'Variant 1',
                  config: '{}'
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

    // Click to expand Code Injection section
    const codeInjectionHeader = await popup.waitForSelector('text=Code Injection')
    await codeInjectionHeader.click()
    await popup.waitForTimeout(300)

    // Verify copy button exists
    const copyButton = await popup.waitForSelector('text=Copy URL filter from DOM changes')
    expect(copyButton).toBeTruthy()

    await context.close()
  })

  test('disables editing for running experiments', async () => {
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
              nr_variants: 2,
              variants: [
                {
                  variant: 0,
                  name: 'Control',
                  config: JSON.stringify({
                    test_var: 'value',
                    __inject_html: {
                      headStart: '<script>console.log("test")</script>'
                    }
                  })
                },
                {
                  variant: 1,
                  name: 'Variant 1',
                  config: '{}'
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
    const experimentRow = await popup.waitForSelector('text=running_experiment')
    await experimentRow.click()
    await popup.waitForTimeout(500)

    // Click to expand Code Injection section
    const codeInjectionHeader = await popup.waitForSelector('text=Code Injection')
    await codeInjectionHeader.click()
    await popup.waitForTimeout(300)

    // Verify edit buttons are disabled
    const editButtons = await popup.$$('button:has-text("Edit")')
    for (const button of editButtons) {
      const isDisabled = await button.getAttribute('disabled')
      expect(isDisabled).toBeTruthy()
    }

    await context.close()
  })

  test('allows adding code to empty sections', async () => {
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
                {
                  variant: 0,
                  name: 'Control',
                  config: JSON.stringify({
                    test_var: 'value'
                  })
                },
                {
                  variant: 1,
                  name: 'Variant 1',
                  config: '{}'
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

    // Click to expand Code Injection section
    const codeInjectionHeader = await popup.waitForSelector('text=Code Injection')
    await codeInjectionHeader.click()
    await popup.waitForTimeout(300)

    // Verify all 4 "Add Code" buttons exist for empty sections
    const addCodeButtons = await popup.$$('button:has-text("Add Code")')
    expect(addCodeButtons.length).toBe(4)

    await context.close()
  })

  test('updates Save Changes button when code is modified', async () => {
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

    // Create a main page where the editor will open
    const mainPage = await context.newPage()
    await mainPage.goto('https://example.com')

    const sidebar = await context.newPage()

    await sidebar.route('**/*', route => {
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
                    test_var: 'value'
                  })
                },
                {
                  variant: 1,
                  name: 'Variant 1',
                  config: '{}'
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
    await sidebar.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`)
    await sidebar.waitForSelector('.absmartly-sidebar', { timeout: 5000 })

    // Click on experiment
    const experimentRow = await sidebar.waitForSelector('text=test_experiment')
    await experimentRow.click()
    await sidebar.waitForTimeout(500)

    // Initially Save button should show "Save Changes" (no bullet)
    let saveButton = await sidebar.waitForSelector('button:has-text("Save Changes")')
    expect(saveButton).toBeTruthy()

    // Click to expand Code Injection section
    const codeInjectionHeader = await sidebar.waitForSelector('text=Custom Code Injection')
    await codeInjectionHeader.click()
    await sidebar.waitForTimeout(300)

    // Click headStart section to open editor
    await sidebar.click('text=Start of <head>')

    // Editor opens in MAIN PAGE, not sidebar
    await mainPage.waitForSelector('#absmartly-code-editor-fullscreen', { timeout: 5000 })

    // Add code in the editor
    const textarea = await mainPage.$('textarea')
    await textarea!.fill('<script>console.log("test")</script>')

    // Save the code
    await mainPage.click('button:has-text("Save")')
    await mainPage.waitForSelector('#absmartly-code-editor-fullscreen', { state: 'hidden' })

    // After modification, main Save button in sidebar should show "• Save Changes"
    saveButton = await sidebar.waitForSelector('button:has-text("• Save Changes")')
    expect(saveButton).toBeTruthy()

    await mainPage.close()
    await sidebar.close()
    await context.close()
  })
})
