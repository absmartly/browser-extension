export type ToastType = 'error' | 'warning' | 'info' | 'success'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
  action?: ToastAction
}

export interface NotificationContextValue {
  showError: (message: string, action?: ToastAction) => void
  showWarning: (message: string) => void
  showSuccess: (message: string) => void
  showInfo: (message: string) => void
  dismissToast: (id: string) => void
}
