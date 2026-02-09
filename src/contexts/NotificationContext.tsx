import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { ToastContainer } from '~src/components/ToastContainer'
import type { Toast, ToastAction, NotificationContextValue } from '~src/types/notification'

const NotificationContext = createContext<NotificationContextValue | null>(null)

let toastIdCounter = 0

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const addToast = useCallback((
    message: string,
    type: Toast['type'],
    action?: ToastAction,
    duration?: number
  ) => {
    const id = `toast-${++toastIdCounter}`
    const newToast: Toast = {
      id,
      message,
      type,
      action,
      duration
    }

    setToasts(prev => {
      const MAX_TOASTS = 5
      const newToasts = [...prev, newToast]
      if (newToasts.length > MAX_TOASTS) {
        return newToasts.slice(-MAX_TOASTS)
      }
      return newToasts
    })

    return id
  }, [])

  const showError = useCallback((message: string, action?: ToastAction) => {
    addToast(message, 'error', action, undefined)
  }, [addToast])

  const showWarning = useCallback((message: string) => {
    addToast(message, 'warning', undefined, 5000)
  }, [addToast])

  const showSuccess = useCallback((message: string) => {
    addToast(message, 'success', undefined, 5000)
  }, [addToast])

  const showInfo = useCallback((message: string) => {
    addToast(message, 'info', undefined, 5000)
  }, [addToast])

  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'SHOW_NOTIFICATION') {
        const { message: text, type, action, duration } = message.payload
        addToast(text, type, action, duration)
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [addToast])

  const value: NotificationContextValue = {
    showError,
    showWarning,
    showSuccess,
    showInfo,
    dismissToast
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </NotificationContext.Provider>
  )
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
}
