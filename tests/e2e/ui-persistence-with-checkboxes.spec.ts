import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import path from 'path'

const EXTENSION_PATH = path.join(__dirname, '../../build/chrome-mv3-dev')
const TEST_PAGE_URL = 'https://example.com'

function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`)
}

// Helper to apply DOM changes via extension's inject script
async function applyDOMChangeWithPersistence(
  page: Page,
  change: any,
  experimentName: string = '__test_experiment__'
) {
  await page.evaluate(
    ({ change, experimentName }) => {
      // The inject-sdk-plugin.js script exposes this function globally
      if (typeof (window as any).applyPreviewChange === 'function') {
        (window as any).applyPreviewChange(change, experimentName)
      } else {
        console.error('applyPreviewChange function not available')
      }
    },
    { change, experimentName }
  )
}

test.describe('UI Persistence - Style and Attribute Checkboxes', () => {
  let context: BrowserContext
  let extensionId: string

  test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
      ],
    })

    const background = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'))
    extensionId = background.url().split('/')[2]
    log(`Extension ID: ${extensionId}`)
  })

  test.afterAll(async () => {
    await context.close()
  })

  test('should persist styles when persistStyle is true', async () => {
    const page = await context.newPage()
    await page.goto(TEST_PAGE_URL)
    log('Navigated to test page')

    // Inject a test button with React-like behavior that overwrites styles
    await page.evaluate(() => {
      const button = document.createElement('button')
      button.id = 'persist-style-test'
      button.textContent = 'Test Button'
      button.style.cssText = 'background-color: blue; color: white; padding: 10px; margin: 20px;'

      // Simulate React overwriting styles after 800ms
      setTimeout(() => {
        console.log('[Page] React is overwriting background to red')
        button.style.backgroundColor = 'red'
      }, 800)

      document.body.appendChild(button)
    })
    log('Test button created')

    // Verify button exists
    await page.locator('#persist-style-test').waitFor({ state: 'visible' })

    // Apply style change with persistStyle: true via extension API
    await applyDOMChangeWithPersistence(page, {
      selector: '#persist-style-test',
      type: 'style',
      value: {
        backgroundColor: 'green',
        color: 'yellow',
      },
      persistStyle: true, // This simulates checking the "Persist Style" checkbox
    })
    log('Applied style change with persistStyle: true')

    // Verify the style was applied
    let bgColor = await page.locator('#persist-style-test').evaluate((el: HTMLElement) => el.style.backgroundColor)
    expect(bgColor).toBe('green')
    log(`Initial style applied: ${bgColor}`)

    // Wait for React to try overwriting (wait for mutation detection and re-apply)
    await page.waitForFunction(
      () => {
        const el = document.querySelector('#persist-style-test') as HTMLElement
        // After React tries to overwrite to red, persistence manager should re-apply green
        return el && el.style.backgroundColor === 'green'
      },
      { timeout: 3000 }
    )

    // Verify it's still green after React tried to overwrite
    bgColor = await page.locator('#persist-style-test').evaluate((el: HTMLElement) => el.style.backgroundColor)
    expect(bgColor).toBe('green')
    log('✅ Style persisted after React tried to overwrite')

    await page.close()
  })

  test('should persist attributes when persistAttribute is true', async () => {
    const page = await context.newPage()
    await page.goto(TEST_PAGE_URL)
    log('Navigated to test page')

    // Inject a test link with React-like behavior that overwrites attributes
    await page.evaluate(() => {
      const link = document.createElement('a')
      link.id = 'persist-attr-test'
      link.href = 'https://example.com/original'
      link.textContent = 'Test Link'
      link.setAttribute('data-test', 'original')
      link.setAttribute('title', 'Original Title')
      link.style.cssText = 'display: block; padding: 10px; margin: 20px;'

      // Simulate React overwriting attributes after 800ms
      setTimeout(() => {
        console.log('[Page] React is overwriting attributes')
        link.setAttribute('data-test', 'framework-reset')
        link.setAttribute('title', 'Framework Title')
      }, 800)

      document.body.appendChild(link)
    })
    log('Test link created')

    // Verify link exists
    await page.locator('#persist-attr-test').waitFor({ state: 'visible' })

    // Apply attribute change with persistAttribute: true via extension API
    await applyDOMChangeWithPersistence(page, {
      selector: '#persist-attr-test',
      type: 'attribute',
      value: {
        'data-test': 'persisted-value',
        title: 'Persisted Title',
      },
      persistAttribute: true, // This simulates checking the "Persist Attribute" checkbox
    })
    log('Applied attribute change with persistAttribute: true')

    // Verify the attributes were applied
    let testAttr = await page.locator('#persist-attr-test').getAttribute('data-test')
    let titleAttr = await page.locator('#persist-attr-test').getAttribute('title')
    expect(testAttr).toBe('persisted-value')
    expect(titleAttr).toBe('Persisted Title')
    log(`Initial attributes applied: data-test=${testAttr}, title=${titleAttr}`)

    // Wait for React to try overwriting and persistence to re-apply
    await page.waitForFunction(
      () => {
        const el = document.querySelector('#persist-attr-test')
        return (
          el &&
          el.getAttribute('data-test') === 'persisted-value' &&
          el.getAttribute('title') === 'Persisted Title'
        )
      },
      { timeout: 3000 }
    )

    // Verify attributes are still persisted after React tried to overwrite
    testAttr = await page.locator('#persist-attr-test').getAttribute('data-test')
    titleAttr = await page.locator('#persist-attr-test').getAttribute('title')
    expect(testAttr).toBe('persisted-value')
    expect(titleAttr).toBe('Persisted Title')
    log('✅ Attributes persisted after React tried to overwrite')

    await page.close()
  })

  test('should NOT persist when persistStyle is false', async () => {
    const page = await context.newPage()
    await page.goto(TEST_PAGE_URL)
    log('Navigated to test page')

    // Inject a test element
    await page.evaluate(() => {
      const div = document.createElement('div')
      div.id = 'no-persist-test'
      div.textContent = 'No Persist Test'
      div.style.cssText = 'background-color: blue; color: white; padding: 10px; margin: 20px;'

      // Simulate React overwriting styles after 800ms
      setTimeout(() => {
        console.log('[Page] React is overwriting background to red')
        div.style.backgroundColor = 'red'
      }, 800)

      document.body.appendChild(div)
    })
    log('Test element created')

    // Verify element exists
    await page.locator('#no-persist-test').waitFor({ state: 'visible' })

    // Apply style change with persistStyle: false via extension API
    await applyDOMChangeWithPersistence(page, {
      selector: '#no-persist-test',
      type: 'style',
      value: {
        backgroundColor: 'yellow',
      },
      persistStyle: false, // This simulates UNchecking the "Persist Style" checkbox
    })
    log('Applied style change with persistStyle: false')

    // Verify the style was applied
    let bgColor = await page.locator('#no-persist-test').evaluate((el: HTMLElement) => el.style.backgroundColor)
    expect(bgColor).toBe('yellow')
    log(`Initial style applied: ${bgColor}`)

    // Wait for React to overwrite it to red
    await page.waitForFunction(
      () => {
        const el = document.querySelector('#no-persist-test') as HTMLElement
        return el && el.style.backgroundColor === 'red'
      },
      { timeout: 3000 }
    )

    // Verify it's red (NOT yellow) - persistence did NOT happen
    bgColor = await page.locator('#no-persist-test').evaluate((el: HTMLElement) => el.style.backgroundColor)
    expect(bgColor).toBe('red')
    log('✅ Style was NOT persisted when persistStyle was false')

    await page.close()
  })
})
