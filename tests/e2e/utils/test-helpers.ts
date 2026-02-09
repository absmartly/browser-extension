import { type Page, type FrameLocator, type Locator, expect } from '@playwright/test'

/**
 * Injects the extension sidebar into a test page
 * The sidebar iframe gets proper extension context because it's loaded via chrome.runtime.getURL()
 * @param page - Playwright page object
 * @param extensionUrl - Function to get extension URLs
 * @returns The sidebar frame locator
 */
export async function injectSidebar(page: Page, extensionUrl: (path: string) => string): Promise<FrameLocator> {
  const sidebarUrl = extensionUrl('tabs/sidebar.html')

  await page.evaluate((url) => {
    const existingSidebar = document.getElementById('absmartly-sidebar-root') as HTMLElement
    if (existingSidebar) {
      return
    }

    const originalPadding = document.body.style.paddingRight || '0px'
    document.body.setAttribute('data-absmartly-original-padding-right', originalPadding)
    document.body.style.transition = 'padding-right 0.3s ease-in-out'
    document.body.style.paddingRight = '384px'

    const container = document.createElement('div')
    container.id = 'absmartly-sidebar-root'
    container.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 384px;
      height: 100vh;
      background-color: white;
      border-left: 1px solid #e5e7eb;
      box-shadow: -4px 0 6px -1px rgba(0, 0, 0, 0.1);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #111827;
      transform: translateX(0);
      transition: transform 0.3s ease-in-out;
    `

    const iframe = document.createElement('iframe')
    iframe.id = 'absmartly-sidebar-iframe'
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
    `
    iframe.src = url

    container.appendChild(iframe)
    document.body.appendChild(container)
  }, sidebarUrl)

  const sidebar = page.frameLocator('#absmartly-sidebar-iframe')
  await sidebar.locator('body').waitFor({ timeout: 10000 })

  return sidebar
}

/**
 * Injects a minimal version of the sidebar (without extra styling)
 * Useful when you just need the sidebar functionality without full styling
 */
export async function injectSidebarMinimal(page: Page, extensionUrl: (path: string) => string): Promise<FrameLocator> {
  await page.evaluate((extUrl) => {
    document.body.style.paddingRight = '384px'

    const container = document.createElement('div')
    container.id = 'absmartly-sidebar-root'
    container.style.cssText = `
      position: fixed; top: 0; right: 0; width: 384px; height: 100vh;
      background-color: white; border-left: 1px solid #e5e7eb;
      z-index: 2147483647;
    `

    const iframe = document.createElement('iframe')
    iframe.id = 'absmartly-sidebar-iframe'
    iframe.style.cssText = 'width: 100%; height: 100%; border: none;'
    iframe.src = extUrl

    container.appendChild(iframe)
    document.body.appendChild(container)
  }, extensionUrl('tabs/sidebar.html'))

  const sidebar = page.frameLocator('#absmartly-sidebar-iframe')
  await sidebar.locator('body').waitFor({ timeout: 10000 })

  return sidebar
}

export async function debugWait(_ms: number = 300): Promise<void> {
}

/**
 * Sets up console logging for a page
 * Useful for debugging test failures
 * @param page - Playwright page object
 * @param filter - Optional filter function to only log certain messages
 */
export function setupConsoleLogging(
  page: Page,
  filter?: (msg: { type: string; text: string }) => boolean
): Array<{ type: string; text: string }> {
  const messages: Array<{ type: string; text: string }> = []
  const DEBUG_MODE = process.env.DEBUG === '1' || process.env.PWDEBUG === '1'

  page.on('console', (msg) => {
    const msgType = msg.type()
    const msgText = msg.text()
    const message = { type: msgType, text: msgText }

    messages.push(message)

    if (DEBUG_MODE) {
      if (!filter || filter(message)) {
        console.log(`  📝 [${msgType}] ${msgText}`)
      }
    }
  })

  return messages
}

/**
 * Waits for an experiment to be available in the list
 * @param sidebar - Sidebar frame locator
 * @returns Whether experiments are available
 */
export async function waitForExperiments(sidebar: FrameLocator): Promise<boolean> {
  const experimentItem = sidebar
    .locator('div[role="button"], button, [class*="cursor-pointer"]')
    .filter({ hasText: /Experiment|Test/i })
    .first()

  return await experimentItem.isVisible({ timeout: 10000 }).catch(() => false)
}

/**
 * Dispatches a synthetic click via MouseEvent on an element inside a FrameLocator
 * Useful when regular .click() is flaky due to overlay/positioning, or when
 * we want to simulate a bubbling/cancelable event like the app expects.
 *
 * @param frame - FrameLocator containing the target element
 * @param selector - CSS selector for the target element
 * @param waitVisibleTimeout - Optional timeout to wait for visibility
 */
export async function click(
  target: FrameLocator | Page,
  selectorOrLocator: string | Locator,
  waitVisibleTimeout: number = 5000
): Promise<void> {
  let locator: Locator
  if (typeof selectorOrLocator === 'string') {
    if ('locator' in target && typeof (target as any).locator === 'function') {
      // Works for both Page and FrameLocator
      locator = (target as any).locator(selectorOrLocator)
    } else {
      throw new Error('Invalid target passed to click helper')
    }
  } else {
    locator = selectorOrLocator
  }

  await locator.waitFor({ state: 'visible', timeout: waitVisibleTimeout })
  await locator.evaluate((el: Element) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

/**
 * Sets up test page with sidebar injection, viewport, and console logging
 * Centralizes beforeEach setup logic
 * @param page - Playwright page object
 * @param extensionUrl - Function to get extension URLs
 * @param testPageUrl - URL to navigate to (defaults to /visual-editor-test.html)
 * @returns Object containing sidebar and console messages
 */
export async function setupTestPage(
  page: Page,
  extensionUrl: (path: string) => string,
  testPageUrl: string = '/visual-editor-test.html'
): Promise<{ sidebar: FrameLocator; allMessages: Array<{ type: string; text: string }> }> {
  const allMessages: Array<{ type: string; text: string }> = []

  page.on('console', (msg) => {
    allMessages.push({ type: msg.type(), text: msg.text() })
  })

  await page.goto(`${testPageUrl}?use_shadow_dom_for_visual_editor_context_menu=0`, {
    waitUntil: 'domcontentloaded',
    timeout: 10000
  })

  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.waitForSelector('body', { timeout: 5000 })

  await page.evaluate(() => {
    (window as any).__absmartlyTestMode = true
  })

  const sidebar = await injectSidebar(page, extensionUrl)

  return { sidebar, allMessages }
}

/**
 * Generic logging function with elapsed time and log level filtering
 * @param message - Message to log
 * @param level - Log level: 'debug', 'info', or 'error' (default: 'info')
 */
let testStartTime = Date.now()

export function initializeTestLogging(): void {
  testStartTime = Date.now()
}

export function log(message: string, level: 'debug' | 'info' | 'error' = 'info'): void {
  const LOG_LEVELS = { debug: 0, info: 1, error: 2 }
  const CURRENT_LOG_LEVEL = process.env.DEBUG === '1' || process.env.PWDEBUG === '1' ? LOG_LEVELS.debug : LOG_LEVELS.info

  if (LOG_LEVELS[level] >= CURRENT_LOG_LEVEL) {
    const elapsed = ((Date.now() - testStartTime) / 1000).toFixed(3)
    console.log(`[+${elapsed}s] ${message}`)
  }
}

/**
 * Right-click helper for triggering context menus
 * @param page - Playwright page or frame
 * @param selector - CSS selector for element to right-click
 */
export async function rightClickElement(
  target: Page | FrameLocator,
  selector: string
): Promise<void> {
  let locator: Locator
  if ('locator' in target && typeof (target as any).locator === 'function') {
    locator = (target as any).locator(selector)
  } else {
    throw new Error('Invalid target passed to rightClickElement helper')
  }

  await locator.waitFor({ state: 'visible', timeout: 5000 })
  await locator.click({ button: 'right' })
  // Wait for context menu to appear
  await ('url' in target
    ? target.locator('#absmartly-menu-container')
    : (target as FrameLocator).locator('#absmartly-menu-container')
  ).waitFor({ state: 'attached', timeout: 2000 }).catch(() => {})
}

