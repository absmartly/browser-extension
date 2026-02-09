import type { ToastType, ToastAction } from '~src/types/notification'

import { debugWarn } from '~src/utils/debug'
export function notifyUser(
  message: string,
  type: ToastType,
  action?: ToastAction,
  duration?: number
): Promise<void> {
  if (!chrome?.runtime?.sendMessage) {
    debugWarn('[Notifications] chrome.runtime.sendMessage unavailable, skipping notification')
    return Promise.resolve()
  }

  return chrome.runtime.sendMessage({
    type: 'SHOW_NOTIFICATION',
    payload: { message, type, action, duration }
  }).catch((error) => {
    debugWarn('[Notifications] Failed to send notification (sidebar may not be open):', error)
  })
}

export function notifyError(message: string, action?: ToastAction): Promise<void> {
  return notifyUser(message, 'error', action)
}

export function notifyWarning(message: string): Promise<void> {
  return notifyUser(message, 'warning')
}

export function notifySuccess(message: string): Promise<void> {
  return notifyUser(message, 'success')
}

export function notifyInfo(message: string): Promise<void> {
  return notifyUser(message, 'info')
}
