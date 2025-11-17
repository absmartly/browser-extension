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

    console.log('[HTML Capture] Sending CAPTURE_HTML message to active tab:', activeTab.id)

    // Try to capture HTML with a timeout to prevent hanging
    const capturePromise = chrome.tabs.sendMessage(activeTab.id, {
      type: 'CAPTURE_HTML'
    })

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('HTML capture timed out after 5 seconds')), 5000)
    })

    const response = await Promise.race([capturePromise, timeoutPromise]) as any

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
