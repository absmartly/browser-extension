import { test, expect } from '@playwright/test'
// import { setupTestPage } from './test-utils'

test.describe('ExperimentMetadata Component', () => {
  test.beforeEach(async ({ page }) => {
    // The component will use the real useABsmartly hook which makes API calls
    // The API calls will be handled by the background script or mocked at that level
  })

  test('renders loading state initially', async ({ page }) => {
    await page.setContent(`
      <div id="root"></div>
      <script type="module">
        import React from 'react'
        import { createRoot } from 'react-dom/client'
        import { ExperimentMetadata } from '/src/components/ExperimentMetadata.tsx'

        const root = createRoot(document.getElementById('root'))
        root.render(
          React.createElement(ExperimentMetadata, {
            data: {
              percentage_of_traffic: 100,
              unit_type_id: null,
              application_ids: []
            },
            onChange: () => {},
            canEdit: true
          })
        )
      </script>
    `)

    // Should show loading message initially
    const loadingText = page.locator('text=Loading metadata...')
    await expect(loadingText).toBeVisible()
  })

  test('renders metadata fields after loading', async ({ page }) => {
    await page.setContent(`
      <div id="root"></div>
      <script type="module">
        import React from 'react'
        import { createRoot } from 'react-dom/client'
        import { ExperimentMetadata } from '/src/components/ExperimentMetadata.tsx'

        const root = createRoot(document.getElementById('root'))
        root.render(
          React.createElement(ExperimentMetadata, {
            data: {
              percentage_of_traffic: 75,
              unit_type_id: 1,
              application_ids: [1]
            },
            onChange: () => {},
            canEdit: true
          })
        )
      </script>
    `)

    // Wait for loading to complete
    await page.waitForSelector('text=Loading metadata...', { state: 'hidden' })

    // Check that all fields are rendered
    await expect(page.locator('label:has-text("Traffic Percentage")')).toBeVisible()
    await expect(page.locator('label:has-text("Unit Type")')).toBeVisible()
    await expect(page.locator('label:has-text("Applications")')).toBeVisible()

    // Check that traffic percentage input has correct value
    const trafficInput = page.locator('input[type="number"]')
    await expect(trafficInput).toHaveValue('75')
  })

  test('allows updating traffic percentage', async ({ page }) => {
    let onChangeCalled = false
    let capturedData = null

    await page.exposeFunction('handleChange', (data: any) => {
      onChangeCalled = true
      capturedData = data
    })

    await page.setContent(`
      <div id="root"></div>
      <script type="module">
        import React from 'react'
        import { createRoot } from 'react-dom/client'
        import { ExperimentMetadata } from '/src/components/ExperimentMetadata.tsx'

        const root = createRoot(document.getElementById('root'))
        root.render(
          React.createElement(ExperimentMetadata, {
            data: {
              percentage_of_traffic: 50,
              unit_type_id: 1,
              application_ids: [1]
            },
            onChange: (data) => window.handleChange(data),
            canEdit: true
          })
        )
      </script>
    `)

    await page.waitForSelector('text=Loading metadata...', { state: 'hidden' })

    const trafficInput = page.locator('input[type="number"]')
    await trafficInput.fill('80')

    await page.waitForFunction(() => (window as any).onChangeCalled === true)

    const data = await page.evaluate(() => (window as any).capturedData)
    expect(data.percentage_of_traffic).toBe(80)
  })

  test('allows selecting unit type', async ({ page }) => {
    let capturedData = null

    await page.exposeFunction('handleChange', (data: any) => {
      capturedData = data
    })

    await page.setContent(`
      <div id="root"></div>
      <script type="module">
        import React from 'react'
        import { createRoot } from 'react-dom/client'
        import { ExperimentMetadata } from '/src/components/ExperimentMetadata.tsx'

        const root = createRoot(document.getElementById('root'))
        root.render(
          React.createElement(ExperimentMetadata, {
            data: {
              percentage_of_traffic: 100,
              unit_type_id: null,
              application_ids: []
            },
            onChange: (data) => window.handleChange(data),
            canEdit: true
          })
        )
      </script>
    `)

    await page.waitForSelector('text=Loading metadata...', { state: 'hidden' })

    // Select unit type
    const unitTypeSelect = page.locator('select').first()
    await unitTypeSelect.selectOption('2')

    await page.waitForTimeout(100) // Wait for onChange to be called

    const data = await page.evaluate(() => (window as any).capturedData)
    expect(data.unit_type_id).toBe(2)
  })

  test('allows selecting application', async ({ page }) => {
    let capturedData = null

    await page.exposeFunction('handleChange', (data: any) => {
      capturedData = data
    })

    await page.setContent(`
      <div id="root"></div>
      <script type="module">
        import React from 'react'
        import { createRoot } from 'react-dom/client'
        import { ExperimentMetadata } from '/src/components/ExperimentMetadata.tsx'

        const root = createRoot(document.getElementById('root'))
        root.render(
          React.createElement(ExperimentMetadata, {
            data: {
              percentage_of_traffic: 100,
              unit_type_id: 1,
              application_ids: []
            },
            onChange: (data) => window.handleChange(data),
            canEdit: true
          })
        )
      </script>
    `)

    await page.waitForSelector('text=Loading metadata...', { state: 'hidden' })

    // Select application
    const appSelect = page.locator('select').nth(1)
    await appSelect.selectOption('3')

    await page.waitForTimeout(100) // Wait for onChange to be called

    const data = await page.evaluate(() => (window as any).capturedData)
    expect(data.application_ids).toEqual([3])
  })

  test('disables fields when canEdit is false', async ({ page }) => {
    await page.setContent(`
      <div id="root"></div>
      <script type="module">
        import React from 'react'
        import { createRoot } from 'react-dom/client'
        import { ExperimentMetadata } from '/src/components/ExperimentMetadata.tsx'

        const root = createRoot(document.getElementById('root'))
        root.render(
          React.createElement(ExperimentMetadata, {
            data: {
              percentage_of_traffic: 75,
              unit_type_id: 1,
              application_ids: [1]
            },
            onChange: () => {},
            canEdit: false
          })
        )
      </script>
    `)

    await page.waitForSelector('text=Loading metadata...', { state: 'hidden' })

    // All inputs should be disabled
    const trafficInput = page.locator('input[type="number"]')
    await expect(trafficInput).toBeDisabled()

    const unitTypeSelect = page.locator('select').first()
    await expect(unitTypeSelect).toBeDisabled()

    const appSelect = page.locator('select').nth(1)
    await expect(appSelect).toBeDisabled()
  })

  test('displays unit types from API', async ({ page }) => {
    await page.setContent(`
      <div id="root"></div>
      <script type="module">
        import React from 'react'
        import { createRoot } from 'react-dom/client'
        import { ExperimentMetadata } from '/src/components/ExperimentMetadata.tsx'

        const root = createRoot(document.getElementById('root'))
        root.render(
          React.createElement(ExperimentMetadata, {
            data: {
              percentage_of_traffic: 100,
              unit_type_id: null,
              application_ids: []
            },
            onChange: () => {},
            canEdit: true
          })
        )
      </script>
    `)

    await page.waitForSelector('text=Loading metadata...', { state: 'hidden' })

    // Check that unit types are loaded
    const unitTypeSelect = page.locator('select').first()
    const options = await unitTypeSelect.locator('option').allTextContents()

    expect(options).toContain('User ID')
    expect(options).toContain('Session ID')
    expect(options).toContain('Anonymous ID')
  })

  test('displays applications from API', async ({ page }) => {
    await page.setContent(`
      <div id="root"></div>
      <script type="module">
        import React from 'react'
        import { createRoot } from 'react-dom/client'
        import { ExperimentMetadata } from '/src/components/ExperimentMetadata.tsx'

        const root = createRoot(document.getElementById('root'))
        root.render(
          React.createElement(ExperimentMetadata, {
            data: {
              percentage_of_traffic: 100,
              unit_type_id: 1,
              application_ids: []
            },
            onChange: () => {},
            canEdit: true
          })
        )
      </script>
    `)

    await page.waitForSelector('text=Loading metadata...', { state: 'hidden' })

    // Check that applications are loaded
    const appSelect = page.locator('select').nth(1)
    const options = await appSelect.locator('option').allTextContents()

    expect(options).toContain('Web App')
    expect(options).toContain('Mobile App')
    expect(options).toContain('Admin Panel')
  })

  test('preserves selected values after rerender', async ({ page }) => {
    await page.setContent(`
      <div id="root"></div>
      <script type="module">
        import React from 'react'
        import { createRoot } from 'react-dom/client'
        import { ExperimentMetadata } from '/src/components/ExperimentMetadata.tsx'

        const root = createRoot(document.getElementById('root'))
        root.render(
          React.createElement(ExperimentMetadata, {
            data: {
              percentage_of_traffic: 65,
              unit_type_id: 2,
              application_ids: [3]
            },
            onChange: () => {},
            canEdit: true
          })
        )
      </script>
    `)

    await page.waitForSelector('text=Loading metadata...', { state: 'hidden' })

    // Check that values are preserved
    const trafficInput = page.locator('input[type="number"]')
    await expect(trafficInput).toHaveValue('65')

    const unitTypeSelect = page.locator('select').first()
    await expect(unitTypeSelect).toHaveValue('2')

    const appSelect = page.locator('select').nth(1)
    await expect(appSelect).toHaveValue('3')
  })
})
