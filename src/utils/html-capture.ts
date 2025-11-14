import { debugLog, debugError } from './debug'

export async function capturePageHTML(): Promise<string> {
  console.log('[HTML Capture] Function called')

  try {
    console.log('[HTML Capture] Starting capture...')

    if (!chrome?.tabs) {
      console.error('[HTML Capture] chrome.tabs API not available!')
      throw new Error('chrome.tabs API not available')
    }

    // Get the active tab (the one the user is looking at)
    console.log('[HTML Capture] Querying active tab...')
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    console.log('[HTML Capture] Active tab:', activeTab?.id, 'URL:', activeTab?.url)

    if (!activeTab?.id) {
      console.error('[HTML Capture] No active tab found!')
      throw new Error('No active tab found')
    }

    // Verify it's a real webpage, not an extension page
    if (!activeTab.url ||
        activeTab.url.startsWith('chrome-extension://') ||
        activeTab.url.startsWith('chrome://') ||
        activeTab.url.startsWith('about:')) {
      console.error('[HTML Capture] Active tab is not a webpage:', activeTab.url)
      throw new Error('Please open the extension on a webpage, not an extension page')
    }

    // Verify content script is loaded by sending a PING first
    console.log('[HTML Capture] Checking if content script is loaded...')
    let contentScriptLoaded = false
    try {
      await chrome.tabs.sendMessage(activeTab.id, { type: 'PING' })
      contentScriptLoaded = true
      console.log('[HTML Capture] Content script is already loaded')
    } catch (error) {
      console.log('[HTML Capture] Content script not loaded, will inject it')
    }

    // If content script isn't loaded, inject it
    if (!contentScriptLoaded) {
      console.log('[HTML Capture] Injecting content script...')
      try {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['content.js']
        })
        console.log('[HTML Capture] Content script injected, waiting for initialization...')
        // Wait for content script to initialize
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (injectError) {
        console.error('[HTML Capture] Failed to inject content script:', injectError)
        throw new Error('Failed to inject content script. Please refresh the page and try again.')
      }
    }

    console.log('[HTML Capture] Sending CAPTURE_HTML message to active tab:', activeTab.id)

    const response = await chrome.tabs.sendMessage(activeTab.id, {
      type: 'CAPTURE_HTML'
    })

    console.log('[HTML Capture] Response received:', response)

    if (!response || !response.success) {
      console.error('[HTML Capture] Response failed:', response)
      throw new Error(response?.error || 'Failed to capture HTML')
    }

    debugLog('📸 Captured HTML from page, length:', response.html?.length)
    console.log('[HTML Capture] Success! HTML length:', response.html?.length)
    return response.html
  } catch (error) {
    console.error('[HTML Capture] Error:', error)
    debugError('❌ Failed to capture page HTML:', error)
    throw error
  }
}
