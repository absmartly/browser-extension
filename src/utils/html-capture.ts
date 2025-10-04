import { debugLog, debugError } from './debug'

export async function capturePageHTML(): Promise<string> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    if (!tab?.id) {
      throw new Error('No active tab found')
    }

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'CAPTURE_HTML'
    })

    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to capture HTML')
    }

    debugLog('📸 Captured HTML from page, length:', response.html?.length)
    return response.html
  } catch (error) {
    debugError('❌ Failed to capture page HTML:', error)
    throw error
  }
}
