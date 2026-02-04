import { debugLog, debugError, debugWarn } from '~src/utils/debug'
import { validateMessage, validateSender as validateSenderSecurity } from '~src/lib/message-security'
import type { ExtensionMessage } from '~src/lib/messaging'

export function validateSender(sender: chrome.runtime.MessageSender): boolean {
  const validation = validateSenderSecurity(sender, true)

  if (!validation.valid) {
    if (validation.securityViolation) {
      debugError('[MessageRouter] Security violation:', validation.error)
    } else {
      debugWarn('[MessageRouter] Sender validation failed:', validation.error)
    }
    return false
  }

  return true
}

export function routeMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
): boolean {
  const validation = validateMessage(message, sender, {
    requireExtensionOrigin: true,
    requireMainFrame: false
  })

  if (!validation.valid) {
    if (validation.securityViolation) {
      debugError('[MessageRouter] Message validation failed:', validation.error)
    }
    sendResponse({
      success: false,
      error: validation.error || 'Invalid message'
    })
    return true
  }

  debugLog('[MessageRouter] Routing message:', message.type, 'from:', message.from || sender.tab?.id)

  return false
}
