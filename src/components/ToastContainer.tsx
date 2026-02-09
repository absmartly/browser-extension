import React from 'react'
import type { Toast as ToastType } from '~src/types/notification'

interface ToastItemProps {
  toast: ToastType
  onClose: (id: string) => void
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  React.useEffect(() => {
    if (toast.type === 'error') {
      return
    }

    const duration = toast.duration ?? 5000
    const timer = setTimeout(() => {
      onClose(toast.id)
    }, duration)

    return () => clearTimeout(timer)
  }, [toast.id, toast.type, toast.duration, onClose])

  const typeClasses = {
    success: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
    info: 'bg-blue-500 text-white',
    warning: 'bg-yellow-500 text-white'
  }

  const Icon = () => {
    switch (toast.type) {
      case 'success':
        return (
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'error':
        return (
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
      case 'warning':
        return (
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )
      case 'info':
        return (
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  return (
    <div
      id={`toast-${toast.id}`}
      className={`rounded-lg px-4 py-3 shadow-lg flex items-start gap-3 min-w-[300px] max-w-md animate-slide-in-right ${typeClasses[toast.type]}`}
    >
      <Icon />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium whitespace-pre-wrap break-words">{toast.message}</p>
        {toast.action && (
          <button
            id={`toast-action-${toast.id}`}
            onClick={toast.action.onClick}
            className="mt-2 text-sm font-semibold underline hover:no-underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        id={`toast-close-${toast.id}`}
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 hover:opacity-80 transition-opacity"
        aria-label="Close notification"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

interface ToastContainerProps {
  toasts: ToastType[]
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) {
    return null
  }

  return (
    <div
      id="toast-container"
      className="fixed top-4 right-4 z-50 flex flex-col gap-3"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onClose={onDismiss} />
      ))}
    </div>
  )
}
