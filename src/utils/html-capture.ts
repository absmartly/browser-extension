import { debugLog, debugError } from './debug'

export async function capturePageHTML(): Promise<string> {
  console.log('[HTML Capture] Function called')

  try {
    console.log('[HTML Capture] Starting capture...')

    if (!chrome?.tabs) {
      console.error('[HTML Capture] chrome.tabs API not available!')
      throw new Error('chrome.tabs API not available')
    }

    // Get all tabs and find the first non-extension page
    // We can't use active:true because the sidebar might be active
    console.log('[HTML Capture] Querying all tabs...')
    const allTabs = await chrome.tabs.query({ currentWindow: true })
    console.log('[HTML Capture] Total tabs in current window:', allTabs.length)

    // Find first tab that's not an extension page
    const contentTab = allTabs.find(t =>
      t.url &&
      !t.url.startsWith('chrome-extension://') &&
      !t.url.startsWith('chrome://') &&
      !t.url.startsWith('about:')
    )

    console.log('[HTML Capture] Found content tab:', contentTab?.id, 'URL:', contentTab?.url)

    if (!contentTab?.id) {
      console.error('[HTML Capture] No content tab found! All tabs:', allTabs.map(t => ({ id: t.id, url: t.url })))
      throw new Error('No content tab found. Please open a webpage first.')
    }

    console.log('[HTML Capture] Sending CAPTURE_HTML message to tab:', contentTab.id)

    const response = await chrome.tabs.sendMessage(contentTab.id, {
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
