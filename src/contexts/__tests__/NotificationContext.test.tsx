import React from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import { NotificationProvider, useNotifications } from '../NotificationContext'

const mockChrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  }
}

global.chrome = mockChrome as any

function TestComponent() {
  const { showError, showWarning, showSuccess, showInfo } = useNotifications()

  return (
    <div>
      <button id="show-error" onClick={() => showError('Error message')}>Show Error</button>
      <button id="show-warning" onClick={() => showWarning('Warning message')}>Show Warning</button>
      <button id="show-success" onClick={() => showSuccess('Success message')}>Show Success</button>
      <button id="show-info" onClick={() => showInfo('Info message')}>Show Info</button>
      <button id="show-error-with-action" onClick={() => showError('Error with action', {
        label: 'Retry',
        onClick: () => console.log('Retry clicked')
      })}>Show Error with Action</button>
    </div>
  )
}

describe('NotificationContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('should throw error when useNotifications is used outside provider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

    expect(() => {
      render(<TestComponent />)
    }).toThrow('useNotifications must be used within NotificationProvider')

    consoleSpy.mockRestore()
  })

  it('should provide notification functions via context', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    )

    expect(screen.getByText('Show Error')).toBeInTheDocument()
    expect(screen.getByText('Show Warning')).toBeInTheDocument()
    expect(screen.getByText('Show Success')).toBeInTheDocument()
    expect(screen.getByText('Show Info')).toBeInTheDocument()
  })

  it('should show error toast when showError is called', () => {
    const { container } = render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    )

    act(() => {
      document.querySelector<HTMLButtonElement>('#show-error')!.click()
    })

    expect(screen.getByText('Error message')).toBeInTheDocument()
    const toast = container.querySelector('.bg-red-500')
    expect(toast).toBeInTheDocument()
  })

  it('should show warning toast when showWarning is called', () => {
    const { container } = render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    )

    act(() => {
      document.querySelector<HTMLButtonElement>('#show-warning')!.click()
    })

    expect(screen.getByText('Warning message')).toBeInTheDocument()
    const toast = container.querySelector('.bg-yellow-500')
    expect(toast).toBeInTheDocument()
  })

  it('should show success toast when showSuccess is called', () => {
    const { container } = render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    )

    act(() => {
      document.querySelector<HTMLButtonElement>('#show-success')!.click()
    })

    expect(screen.getByText('Success message')).toBeInTheDocument()
    const toast = container.querySelector('.bg-green-500')
    expect(toast).toBeInTheDocument()
  })

  it('should show info toast when showInfo is called', () => {
    const { container } = render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    )

    act(() => {
      document.querySelector<HTMLButtonElement>('#show-info')!.click()
    })

    expect(screen.getByText('Info message')).toBeInTheDocument()
    const toast = container.querySelector('.bg-blue-500')
    expect(toast).toBeInTheDocument()
  })

  it('should show error toast with action button', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    )

    act(() => {
      document.querySelector<HTMLButtonElement>('#show-error-with-action')!.click()
    })

    expect(screen.getByText('Error with action')).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('should dismiss toast when close button is clicked', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    )

    act(() => {
      document.querySelector<HTMLButtonElement>('#show-info')!.click()
    })

    expect(screen.getByText('Info message')).toBeInTheDocument()

    const closeButton = screen.getByLabelText('Close notification')
    act(() => {
      closeButton.click()
    })

    expect(screen.queryByText('Info message')).not.toBeInTheDocument()
  })

  it('should auto-dismiss non-error toasts after 5 seconds', async () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    )

    act(() => {
      document.querySelector<HTMLButtonElement>('#show-success')!.click()
    })

    expect(screen.getByText('Success message')).toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(5000)
    })

    await waitFor(() => {
      expect(screen.queryByText('Success message')).not.toBeInTheDocument()
    })
  })

  it('should NOT auto-dismiss error toasts', async () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    )

    act(() => {
      document.querySelector<HTMLButtonElement>('#show-error')!.click()
    })

    expect(screen.getByText('Error message')).toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(10000)
    })

    expect(screen.getByText('Error message')).toBeInTheDocument()
  })

  it('should stack multiple toasts', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    )

    act(() => {
      document.querySelector<HTMLButtonElement>('#show-error')!.click()
      document.querySelector<HTMLButtonElement>('#show-warning')!.click()
      document.querySelector<HTMLButtonElement>('#show-success')!.click()
    })

    expect(screen.getByText('Error message')).toBeInTheDocument()
    expect(screen.getByText('Warning message')).toBeInTheDocument()
    expect(screen.getByText('Success message')).toBeInTheDocument()
  })

  it('should limit stack to 5 toasts', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    )

    act(() => {
      document.querySelector<HTMLButtonElement>('#show-info')!.click()
      document.querySelector<HTMLButtonElement>('#show-info')!.click()
      document.querySelector<HTMLButtonElement>('#show-info')!.click()
      document.querySelector<HTMLButtonElement>('#show-info')!.click()
      document.querySelector<HTMLButtonElement>('#show-info')!.click()
      document.querySelector<HTMLButtonElement>('#show-info')!.click()
    })

    const toasts = screen.getAllByText('Info message')
    expect(toasts).toHaveLength(5)
  })

  it('should register chrome.runtime.onMessage listener', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    )

    expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled()
  })

  it('should handle SHOW_NOTIFICATION message from background', () => {
    let messageHandler: any

    mockChrome.runtime.onMessage.addListener.mockImplementation((handler) => {
      messageHandler = handler
    })

    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    )

    expect(messageHandler).toBeDefined()

    act(() => {
      messageHandler({
        type: 'SHOW_NOTIFICATION',
        payload: {
          message: 'Background notification',
          type: 'warning'
        }
      })
    })

    expect(screen.getByText('Background notification')).toBeInTheDocument()
  })

  it('should cleanup listener on unmount', () => {
    const { unmount } = render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    )

    unmount()

    expect(mockChrome.runtime.onMessage.removeListener).toHaveBeenCalled()
  })

  it('should generate unique IDs for each toast', () => {
    const { container } = render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    )

    act(() => {
      document.querySelector<HTMLButtonElement>('#show-info')!.click()
      document.querySelector<HTMLButtonElement>('#show-info')!.click()
      document.querySelector<HTMLButtonElement>('#show-info')!.click()
    })

    const toastContainer = container.querySelector('#toast-container')
    const toasts = toastContainer?.querySelectorAll('[id^="toast-"]')
    const ids = Array.from(toasts || []).map(toast => toast.id)

    expect(ids.length).toBeGreaterThanOrEqual(3)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
