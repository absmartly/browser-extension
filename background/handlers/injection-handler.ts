import { debugLog, debugError } from '~src/utils/debug'

/**
 * Injection Handler Module
 *
 * Handles dynamic injection of content scripts and sidebar UI into web pages.
 * Supports file:// URLs through dynamic content script registration.
 */

/**
 * Check if we're running in test mode (Playwright tests)
 * Detection: Chrome extensions in test mode will have tabs with file:// URLs
 * In production, users don't typically have file:// URLs open
 */
async function isTestMode(): Promise<boolean> {
  try {
    // Check if any tabs are using file:// URLs
    // This is a reliable indicator that we're running Playwright tests
    const tabs = await chrome.tabs.query({})
    const hasFileUrls = tabs.some(tab => tab.url?.startsWith('file://'))
    return hasFileUrls
  } catch {
    return false
  }
}

/**
 * Register content script for file:// URLs dynamically
 * This is ONLY needed for Playwright E2E tests that use file:// URLs
 * Production extension does NOT need file:// support
 */
export async function registerFileUrlContentScript(): Promise<void> {
  // Only register file:// URLs when running tests
  if (!(await isTestMode())) {
    return
  }

  try {
    const manifest = chrome.runtime.getManifest()
    const contentScripts = manifest.content_scripts
    if (contentScripts && contentScripts.length > 0) {
      const contentScriptFile = contentScripts[0].js[0]

      await chrome.scripting.registerContentScripts([{
        id: 'file-url-content-script',
        matches: ['file://*/*'],
        js: [contentScriptFile],
        runAt: 'document_idle',
        allFrames: false
      }])

      console.log('[InjectionHandler] Test mode: Registered content script for file:// URLs')
    }
  } catch (error) {
    try {
      await chrome.scripting.unregisterContentScripts({ ids: ['file-url-content-script'] })
      const manifest = chrome.runtime.getManifest()
      const contentScripts = manifest.content_scripts
      if (contentScripts && contentScripts.length > 0) {
        const contentScriptFile = contentScripts[0].js[0]
        await chrome.scripting.registerContentScripts([{
          id: 'file-url-content-script',
          matches: ['file://*/*'],
          js: [contentScriptFile],
          runAt: 'document_idle',
          allFrames: false
        }])
        console.log('[InjectionHandler] Test mode: Re-registered content script for file:// URLs')
      }
    } catch (retryError) {
      console.error('[InjectionHandler] Test mode: Failed to register file:// content script:', retryError)
    }
  }
}

/**
 * Check if a URL is restricted (chrome://, edge://, etc.)
 */
export function isRestrictedUrl(url: string): boolean {
  return url.startsWith('chrome://') ||
         url.startsWith('edge://') ||
         url.startsWith('about:') ||
         url.startsWith('chrome-extension://')
}

/**
 * Inject or toggle the extension sidebar in the active tab
 * @param tabId - The ID of the tab to inject the sidebar into
 * @param tabUrl - The URL of the tab (for validation)
 */
export async function injectOrToggleSidebar(tabId: number, tabUrl: string): Promise<void> {
  debugLog('[InjectionHandler] Extension icon clicked for tab:', tabId)

  if (isRestrictedUrl(tabUrl)) {
    debugLog('[InjectionHandler] Cannot inject sidebar on restricted URL:', tabUrl)
    return
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: toggleSidebarFunc
    })
  } catch (error) {
    debugError('[InjectionHandler] Failed to inject sidebar:', error)
  }
}

/**
 * Function executed in the page context to toggle or create the sidebar
 * This function is injected into the page and runs in the page's context
 */
function toggleSidebarFunc(): void {
  const existingSidebar = document.getElementById('absmartly-sidebar-root') as HTMLElement
  if (existingSidebar) {
    console.log('🔵 ABSmartly Extension: Sidebar already exists, toggling visibility')
    const currentTransform = existingSidebar.style.transform
    console.log('Current transform:', currentTransform)

    const isCurrentlyVisible = !currentTransform
      || currentTransform === 'translateX(0px)'
      || currentTransform === 'translateX(0%)'
      || currentTransform === 'translateX(0)'

    if (isCurrentlyVisible) {
      console.log('Hiding sidebar')
      existingSidebar.style.transform = 'translateX(100%)'

      const originalPadding = document.body.getAttribute('data-absmartly-original-padding-right')
      if (originalPadding !== null) {
        document.body.style.transition = 'padding-right 0.3s ease-in-out'
        document.body.style.paddingRight = originalPadding
        document.body.removeAttribute('data-absmartly-original-padding-right')
        setTimeout(() => {
          document.body.style.transition = ''
        }, 350)
      }
    } else {
      console.log('Showing sidebar')
      existingSidebar.style.transform = 'translateX(0)'

      if (!document.body.hasAttribute('data-absmartly-original-padding-right')) {
        const currentPadding = document.body.style.paddingRight || '0px'
        document.body.setAttribute('data-absmartly-original-padding-right', currentPadding)
        document.body.style.transition = 'padding-right 0.3s ease-in-out'
        document.body.style.paddingRight = '384px'
      }
    }
    return
  }

  console.log('🔵 ABSmartly Extension: Injecting sidebar')

  const originalPadding = document.body.style.paddingRight || '0px'
  document.body.setAttribute('data-absmartly-original-padding-right', originalPadding)

  const originalTransition = document.body.style.transition
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
  iframe.src = chrome.runtime.getURL('tabs/sidebar.html')

  container.appendChild(iframe)
  document.body.appendChild(container)

  console.log('🔵 ABSmartly Extension: Sidebar injected successfully')
}

/**
 * Initialize injection handler
 * Sets up event listeners for extension lifecycle events
 */
export function initializeInjectionHandler(): void {
  chrome.runtime.onInstalled.addListener(registerFileUrlContentScript)
  chrome.runtime.onStartup.addListener(registerFileUrlContentScript)
  registerFileUrlContentScript()

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url) {
      // Dynamic content script should now auto-inject on file:// URLs
    }
  })

  chrome.action.onClicked.addListener(async (tab) => {
    if (tab.id && tab.url) {
      await injectOrToggleSidebar(tab.id, tab.url)
    }
  })
}
