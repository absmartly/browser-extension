import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'
import { injectSidebar, log, initializeTestLogging } from './utils/test-helpers'
import { createExperiment } from './helpers/ve-experiment-setup'

const TEST_PAGE_URL = '/visual-editor-test.html'

test.describe('Style Input Overflow Test', () => {
  let testPage: Page

  test.beforeEach(async ({ context }) => {
    initializeTestLogging()
    testPage = await context.newPage()
  })

  test.afterEach(async () => {
    if (testPage && !process.env.SLOW) await testPage.close()
  })

  test('Verify style input handles long values without overflow', async ({ extensionUrl }) => {
    log('Starting style input overflow test')

    await testPage.goto(TEST_PAGE_URL, { waitUntil: 'domcontentloaded' })
    await testPage.setViewportSize({ width: 1920, height: 1080 })

    log('Injecting sidebar')
    const sidebar = await injectSidebar(testPage, extensionUrl)

    log('Creating new experiment')
    await createExperiment(sidebar)

    log('Adding DOM change')
    const addButton = sidebar.locator('#add-dom-change-button').first()
    await addButton.scrollIntoViewIfNeeded()
    await addButton.click()

    log('Waiting for DOM change form')
    const selectorInput = sidebar.locator('#dom-change-selector-1-new')
    await selectorInput.waitFor({ state: 'visible', timeout: 3000 })

    log('Filling selector')
    await selectorInput.fill('.banner')

    log('Selecting Inline Style')
    const changeTypeSelect = sidebar.locator('#dom-change-type-1-new')
    await changeTypeSelect.waitFor({ state: 'visible', timeout: 3000 })
    await changeTypeSelect.selectOption('style')

    log('Looking for CSS style editor')
    const styleEditor = sidebar.locator('.bg-gray-900').first()
    const allInputs = styleEditor.locator('input')
    const propertyKeyInput = allInputs.nth(0)
    const propertyValueInput = allInputs.nth(1)

    log('Filling property name: background')
    await propertyKeyInput.fill('background')
    await propertyKeyInput.press('Tab')

    const longUrl = 'url(https://www.example.com/very/long/path/to/some/background/image/that/will/definitely/overflow/94e559c1aa9cb4db8b124567890abcdef.png)'
    log(`Filling long value: ${longUrl}`)
    await propertyValueInput.fill(longUrl)

    log('Checking input element computed styles')
    const inputStyles = await propertyValueInput.evaluate((el) => {
      const styles = window.getComputedStyle(el)
      return {
        overflow: styles.overflow,
        textOverflow: styles.textOverflow,
      }
    })
    log(`Input styles: ${JSON.stringify(inputStyles)}`)

    expect(inputStyles.textOverflow).toBe('ellipsis')
    expect(['hidden', 'clip']).toContain(inputStyles.overflow)
    log('Value input has proper overflow handling (ellipsis)')

    log('Testing properties dropdown visibility')
    await propertyKeyInput.clear()
    await propertyKeyInput.click()

    log('Waiting for suggestions dropdown')
    const dropdown = styleEditor.locator('.absolute.z-50.bg-gray-800')
    await dropdown.waitFor({ state: 'visible', timeout: 3000 })

    const dropdownBox = await dropdown.boundingBox()
    const editorBox = await styleEditor.boundingBox()

    if (dropdownBox && editorBox) {
      const dropdownBottom = dropdownBox.y + dropdownBox.height
      const editorBottom = editorBox.y + editorBox.height
      log(`Dropdown bottom: ${dropdownBottom}, Editor bottom: ${editorBottom}`)
      expect(dropdownBottom).toBeGreaterThan(editorBottom)
      log('Dropdown is fully visible and not clipped by overflow')
    }

    await propertyKeyInput.fill('back')

    const isDropdownVisible = await dropdown.isVisible().catch(() => false)
    if (isDropdownVisible) {
      log('Dropdown remains visible with filtered results')
    } else {
      log('Dropdown hidden after filtering - expected when no suggestions match')
    }

    log('Test complete')
  })
})
