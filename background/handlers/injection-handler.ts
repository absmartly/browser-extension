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

      debugLog('[InjectionHandler] Test mode: Registered content script for file:// URLs')
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
        debugLog('[InjectionHandler] Test mode: Re-registered content script for file:// URLs')
      }
    } catch (retryError) {
      debugError('[InjectionHandler] Test mode: Failed to register file:// content script:', retryError)
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
    throw error
  }
}

/**
 * Function executed in the page context to toggle or create the sidebar
 * This function is injected into the page and runs in the page's context
 */
function toggleSidebarFunc(): void {
  const log = (...args: any[]) => {
    try {
      console.log(...args)
    } catch {
      // no-op
    }
  }

  const existingSidebar = document.getElementById('absmartly-sidebar-root') as HTMLElement
  if (existingSidebar) {
    log('🔵 ABSmartly Extension: Sidebar already exists, toggling visibility')
    const currentTransform = existingSidebar.style.transform
    log('Current transform:', currentTransform)

    const isCurrentlyVisible = !currentTransform
      || currentTransform === 'translateX(0px)'
      || currentTransform === 'translateX(0%)'
      || currentTransform === 'translateX(0)'

    if (isCurrentlyVisible) {
      log('Hiding sidebar')
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
      log('Showing sidebar')
      existingSidebar.style.transform = 'translateX(0)'

      if (!document.body.hasAttribute('data-absmartly-original-padding-right')) {
        const currentPadding = document.body.style.paddingRight || '0px'
        document.body.setAttribute('data-absmartly-original-padding-right', currentPadding)
        document.body.style.transition = 'padding-right 0.3s ease-in-out'
        const currentWidth = existingSidebar.style.width || '384px'
        document.body.style.paddingRight = currentWidth
      }
    }
    return
  }

  log('🔵 ABSmartly Extension: Injecting sidebar')

  const originalPadding = document.body.style.paddingRight || '0px'
  document.body.setAttribute('data-absmartly-original-padding-right', originalPadding)

  const originalTransition = document.body.style.transition
  document.body.style.transition = 'padding-right 0.3s ease-in-out'

  const savedWidth = localStorage.getItem('absmartly-sidebar-width') || '384px'
  document.body.style.paddingRight = savedWidth

  const container = document.createElement('div')
  container.id = 'absmartly-sidebar-root'
  container.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: ${savedWidth};
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

  const resizeHandle = document.createElement('div')
  resizeHandle.id = 'absmartly-sidebar-resize-handle'
  resizeHandle.style.cssText = `
    position: absolute;
    left: 0;
    top: 0;
    width: 8px;
    height: 100%;
    cursor: ew-resize;
    background: transparent;
    z-index: 10;
  `

  const handleGrip = document.createElement('div')
  handleGrip.style.cssText = `
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 4px;
    height: 60px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    pointer-events: none;
  `

  for (let i = 0; i < 5; i++) {
    const dot = document.createElement('div')
    dot.className = 'resize-grip-dot'
    dot.style.cssText = `
      width: 4px;
      height: 4px;
      background: #94a3b8;
      border-radius: 50%;
      transition: background 0.2s;
    `
    handleGrip.appendChild(dot)
  }

  resizeHandle.appendChild(handleGrip)

  let isResizing = false
  let startX = 0
  let startWidth = 0

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return

    const deltaX = startX - e.clientX
    const newWidth = Math.max(280, Math.min(800, startWidth + deltaX))

    container.style.width = `${newWidth}px`
    document.body.style.paddingRight = `${newWidth}px`

    e.preventDefault()
    e.stopPropagation()
  }

  const handleMouseUp = () => {
    if (!isResizing) return

    isResizing = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    container.style.transition = 'transform 0.3s ease-in-out'
    document.body.style.transition = 'padding-right 0.3s ease-in-out'
    iframe.style.pointerEvents = ''

    const finalWidth = container.style.width
    localStorage.setItem('absmartly-sidebar-width', finalWidth)
    log('🔵 ABSmartly Extension: Saved sidebar width:', finalWidth)

    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  resizeHandle.addEventListener('mouseenter', () => {
    if (!isResizing) {
      resizeHandle.style.background = 'rgba(59, 130, 246, 0.2)'
      const dots = handleGrip.querySelectorAll('.resize-grip-dot') as NodeListOf<HTMLElement>
      dots.forEach(dot => dot.style.background = '#3b82f6')
    }
  })

  resizeHandle.addEventListener('mouseleave', () => {
    if (!isResizing) {
      resizeHandle.style.background = 'transparent'
      const dots = handleGrip.querySelectorAll('.resize-grip-dot') as NodeListOf<HTMLElement>
      dots.forEach(dot => dot.style.background = '#94a3b8')
    }
  })

  resizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
    isResizing = true
    startX = e.clientX
    startWidth = container.offsetWidth
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
    container.style.transition = 'none'
    document.body.style.transition = 'none'
    resizeHandle.style.background = 'rgba(59, 130, 246, 0.4)'
    const dots = handleGrip.querySelectorAll('.resize-grip-dot') as NodeListOf<HTMLElement>
    dots.forEach(dot => dot.style.background = '#2563eb')
    iframe.style.pointerEvents = 'none'

    e.preventDefault()
    e.stopPropagation()

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  })

  container.appendChild(resizeHandle)
  container.appendChild(iframe)
  document.body.appendChild(container)

  log('🔵 ABSmartly Extension: Sidebar injected successfully')
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
