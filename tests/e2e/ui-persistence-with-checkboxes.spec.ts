import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'

const TEST_PAGE_URL = '/visual-editor-test.html'

function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`)
}

async function injectSDKBridge(page: Page, extensionUrl: (path: string) => string): Promise<void> {
  const bundleUrl = extensionUrl('absmartly-sdk-bridge.bundle.js')
  await page.evaluate((url) => {
    return new Promise<void>((resolve) => {
      const script = document.createElement('script')
      script.src = url
      script.onload = () => resolve()
      script.onerror = () => resolve()
      document.head.appendChild(script)
    })
  }, bundleUrl)
}

async function applyDOMChangeWithPersistence(
  page: Page,
  change: any,
  experimentName: string = '__test_experiment__'
) {
  await page.evaluate(
    ({ change, experimentName }) => {
      window.postMessage({
        source: 'absmartly-extension',
        type: 'PREVIEW_CHANGES',
        payload: {
          changes: [change],
          experimentName: experimentName,
          variantName: 'test-variant'
        }
      }, window.location.origin)
    },
    { change, experimentName }
  )
}

test.describe('UI Persistence - Style and Attribute Checkboxes', () => {
  test('should persist styles when persistStyle is true', async ({ context, extensionUrl }) => {
    const page = await context.newPage()
    await page.goto(`http://localhost:3456${TEST_PAGE_URL}`, { waitUntil: 'domcontentloaded', timeout: 10000 })
    log('Navigated to test page')

    await injectSDKBridge(page, extensionUrl)
    log('SDK bridge injected')

    await page.evaluate(() => {
      const button = document.createElement('button')
      button.id = 'persist-style-test'
      button.textContent = 'Test Button'
      button.style.cssText = 'background-color: blue; color: white; padding: 10px; margin: 20px;'

      setTimeout(() => {
        console.log('[Page] React is overwriting background to red')
        button.style.backgroundColor = 'red'
      }, 800)

      document.body.appendChild(button)
    })
    log('Test button created')

    await page.locator('#persist-style-test').waitFor({ state: 'visible' })

    await applyDOMChangeWithPersistence(page, {
      selector: '#persist-style-test',
      type: 'style',
      value: {
        backgroundColor: 'green',
        color: 'yellow',
      },
      persistStyle: true,
    })
    log('Applied style change with persistStyle: true')

    let bgColor = await page.locator('#persist-style-test').evaluate((el: HTMLElement) => el.style.backgroundColor)
    expect(bgColor).toBe('green')
    log(`Initial style applied: ${bgColor}`)

    await page.waitForFunction(
      () => {
        const el = document.querySelector('#persist-style-test') as HTMLElement
        return el && el.style.backgroundColor === 'green'
      },
      { timeout: 3000 }
    )

    bgColor = await page.locator('#persist-style-test').evaluate((el: HTMLElement) => el.style.backgroundColor)
    expect(bgColor).toBe('green')
    log('Style persisted after React tried to overwrite')

    await page.close()
  })

  test('should persist attributes when persistAttribute is true', async ({ context, extensionUrl }) => {
    const page = await context.newPage()
    await page.goto(`http://localhost:3456${TEST_PAGE_URL}`, { waitUntil: 'domcontentloaded', timeout: 10000 })
    log('Navigated to test page')

    await injectSDKBridge(page, extensionUrl)
    log('SDK bridge injected')

    await page.evaluate(() => {
      const link = document.createElement('a')
      link.id = 'persist-attr-test'
      link.href = 'https://example.com/original'
      link.textContent = 'Test Link'
      link.setAttribute('data-test', 'original')
      link.setAttribute('title', 'Original Title')
      link.style.cssText = 'display: block; padding: 10px; margin: 20px;'

      setTimeout(() => {
        console.log('[Page] React is overwriting attributes')
        link.setAttribute('data-test', 'framework-reset')
        link.setAttribute('title', 'Framework Title')
      }, 800)

      document.body.appendChild(link)
    })
    log('Test link created')

    await page.locator('#persist-attr-test').waitFor({ state: 'visible' })

    await applyDOMChangeWithPersistence(page, {
      selector: '#persist-attr-test',
      type: 'attribute',
      value: {
        'data-test': 'persisted-value',
        title: 'Persisted Title',
      },
      persistAttribute: true,
    })
    log('Applied attribute change with persistAttribute: true')

    let testAttr = await page.locator('#persist-attr-test').getAttribute('data-test')
    let titleAttr = await page.locator('#persist-attr-test').getAttribute('title')
    expect(testAttr).toBe('persisted-value')
    expect(titleAttr).toBe('Persisted Title')
    log(`Initial attributes applied: data-test=${testAttr}, title=${titleAttr}`)

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

    testAttr = await page.locator('#persist-attr-test').getAttribute('data-test')
    titleAttr = await page.locator('#persist-attr-test').getAttribute('title')
    expect(testAttr).toBe('persisted-value')
    expect(titleAttr).toBe('Persisted Title')
    log('Attributes persisted after React tried to overwrite')

    await page.close()
  })

  test('should NOT persist when persistStyle is false', async ({ context, extensionUrl }) => {
    const page = await context.newPage()
    await page.goto(`http://localhost:3456${TEST_PAGE_URL}`, { waitUntil: 'domcontentloaded', timeout: 10000 })
    log('Navigated to test page')

    await injectSDKBridge(page, extensionUrl)
    log('SDK bridge injected')

    await page.evaluate(() => {
      const div = document.createElement('div')
      div.id = 'no-persist-test'
      div.textContent = 'No Persist Test'
      div.style.cssText = 'background-color: blue; color: white; padding: 10px; margin: 20px;'

      setTimeout(() => {
        console.log('[Page] React is overwriting background to red')
        div.style.backgroundColor = 'red'
      }, 800)

      document.body.appendChild(div)
    })
    log('Test element created')

    await page.locator('#no-persist-test').waitFor({ state: 'visible' })

    await applyDOMChangeWithPersistence(page, {
      selector: '#no-persist-test',
      type: 'style',
      value: {
        backgroundColor: 'yellow',
      },
      persistStyle: false,
    })
    log('Applied style change with persistStyle: false')

    let bgColor = await page.locator('#no-persist-test').evaluate((el: HTMLElement) => el.style.backgroundColor)
    expect(bgColor).toBe('yellow')
    log(`Initial style applied: ${bgColor}`)

    await page.waitForFunction(
      () => {
        const el = document.querySelector('#no-persist-test') as HTMLElement
        return el && el.style.backgroundColor === 'red'
      },
      { timeout: 3000 }
    )

    bgColor = await page.locator('#no-persist-test').evaluate((el: HTMLElement) => el.style.backgroundColor)
    expect(bgColor).toBe('red')
    log('Style was NOT persisted when persistStyle was false')

    await page.close()
  })
})
