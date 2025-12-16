import { debugLog, debugError } from './debug'

export async function capturePageHTML(): Promise<string> {
  console.log('[HTML Capture] Function called')

  try {
    console.log('[HTML Capture] Starting capture...')

    if (!chrome?.tabs || !chrome?.scripting) {
      console.error('[HTML Capture] chrome.tabs or chrome.scripting API not available!')
      throw new Error('chrome.tabs or chrome.scripting API not available')
    }

    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    console.log('[HTML Capture] Active tab:', activeTab?.id, 'URL:', activeTab?.url)

    if (!activeTab?.id) {
      console.error('[HTML Capture] No active tab found!')
      throw new Error('No active tab found')
    }

    if (!activeTab.url ||
        activeTab.url.startsWith('chrome-extension://') ||
        activeTab.url.startsWith('chrome://') ||
        activeTab.url.startsWith('about:')) {
      console.error('[HTML Capture] Active tab is not a webpage:', activeTab.url)
      throw new Error('Please open the extension on a webpage, not an extension page')
    }

    console.log('[HTML Capture] Injecting script to capture HTML...')

    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => document.documentElement.outerHTML
    })

    console.log('[HTML Capture] Script executed, results:', results?.length)

    if (!results || results.length === 0 || !results[0]?.result) {
      console.error('[HTML Capture] No results returned from script')
      throw new Error('Failed to capture HTML: No results returned')
    }

    const html = results[0].result
    debugLog('📸 Captured HTML from page, length:', html?.length)
    console.log('[HTML Capture] Success! HTML length:', html?.length)
    return html
  } catch (error) {
    console.error('[HTML Capture] Error:', error)
    debugError('❌ Failed to capture page HTML:', error)
    throw error
  }
}
