import { debugLog, debugError } from './debug'

export async function capturePageHTML(): Promise<string> {
  console.log('[HTML Capture] Function called')

  try {
    console.log('[HTML Capture] Starting capture...')

    if (!chrome?.tabs) {
      console.error('[HTML Capture] chrome.tabs API not available!')
      throw new Error('chrome.tabs API not available')
    }

    // Get the active tab in the current window
    console.log('[HTML Capture] Querying active tab...')
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    console.log('[HTML Capture] Active tab:', activeTab?.id, 'URL:', activeTab?.url)

    if (!activeTab?.id) {
      console.error('[HTML Capture] No active tab found!')
      throw new Error('No active tab found')
    }

    console.log('[HTML Capture] Sending CAPTURE_HTML message to tab:', activeTab.id)

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
