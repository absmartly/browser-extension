import React from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import { ToastContainer } from '../ToastContainer'
import type { Toast } from '~src/types/notification'

describe('ToastContainer', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('should render nothing when toasts array is empty', () => {
    const { container } = render(<ToastContainer toasts={[]} onDismiss={jest.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('should render success toast with icon', () => {
    const toasts: Toast[] = [{
      id: 'test-1',
      message: 'Success message',
      type: 'success',
      duration: 5000
    }]

    render(<ToastContainer toasts={toasts} onDismiss={jest.fn()} />)

    expect(screen.getByText('Success message')).toBeInTheDocument()
    const toast = document.querySelector('#toast-test-1')
    expect(toast).toBeInTheDocument()
    expect(toast).toHaveClass('bg-green-500')
  })

  it('should render error toast with icon', () => {
    const toasts: Toast[] = [{
      id: 'test-1',
      message: 'Error message',
      type: 'error'
    }]

    render(<ToastContainer toasts={toasts} onDismiss={jest.fn()} />)

    expect(screen.getByText('Error message')).toBeInTheDocument()
    const toast = document.querySelector('#toast-test-1')
    expect(toast).toHaveClass('bg-red-500')
  })

  it('should render warning toast with icon', () => {
    const toasts: Toast[] = [{
      id: 'test-1',
      message: 'Warning message',
      type: 'warning',
      duration: 5000
    }]

    render(<ToastContainer toasts={toasts} onDismiss={jest.fn()} />)

    expect(screen.getByText('Warning message')).toBeInTheDocument()
    const toast = document.querySelector('#toast-test-1')
    expect(toast).toHaveClass('bg-yellow-500')
  })

  it('should render info toast with icon', () => {
    const toasts: Toast[] = [{
      id: 'test-1',
      message: 'Info message',
      type: 'info',
      duration: 5000
    }]

    render(<ToastContainer toasts={toasts} onDismiss={jest.fn()} />)

    expect(screen.getByText('Info message')).toBeInTheDocument()
    const toast = document.querySelector('#toast-test-1')
    expect(toast).toHaveClass('bg-blue-500')
  })

  it('should render multiple toasts in stack', () => {
    const toasts: Toast[] = [
      { id: 'test-1', message: 'First message', type: 'info', duration: 5000 },
      { id: 'test-2', message: 'Second message', type: 'success', duration: 5000 },
      { id: 'test-3', message: 'Third message', type: 'error' }
    ]

    render(<ToastContainer toasts={toasts} onDismiss={jest.fn()} />)

    expect(screen.getByText('First message')).toBeInTheDocument()
    expect(screen.getByText('Second message')).toBeInTheDocument()
    expect(screen.getByText('Third message')).toBeInTheDocument()
  })

  it('should call onDismiss when close button is clicked', () => {
    const onDismiss = jest.fn()
    const toasts: Toast[] = [{
      id: 'test-1',
      message: 'Test message',
      type: 'info',
      duration: 5000
    }]

    render(<ToastContainer toasts={toasts} onDismiss={onDismiss} />)

    const closeButton = document.querySelector('#toast-close-test-1') as HTMLElement
    expect(closeButton).toBeInTheDocument()

    act(() => {
      closeButton.click()
    })

    expect(onDismiss).toHaveBeenCalledWith('test-1')
  })

  it('should auto-dismiss non-error toasts after duration', async () => {
    const onDismiss = jest.fn()
    const toasts: Toast[] = [{
      id: 'test-1',
      message: 'Auto dismiss message',
      type: 'success',
      duration: 3000
    }]

    render(<ToastContainer toasts={toasts} onDismiss={onDismiss} />)

    expect(onDismiss).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(3000)
    })

    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledWith('test-1')
    })
  })

  it('should NOT auto-dismiss error toasts', async () => {
    const onDismiss = jest.fn()
    const toasts: Toast[] = [{
      id: 'test-1',
      message: 'Error message stays',
      type: 'error'
    }]

    render(<ToastContainer toasts={toasts} onDismiss={onDismiss} />)

    act(() => {
      jest.advanceTimersByTime(10000)
    })

    expect(onDismiss).not.toHaveBeenCalled()
    expect(screen.getByText('Error message stays')).toBeInTheDocument()
  })

  it('should render toast with action button', () => {
    const actionFn = jest.fn()
    const toasts: Toast[] = [{
      id: 'test-1',
      message: 'Message with action',
      type: 'error',
      action: {
        label: 'Retry',
        onClick: actionFn
      }
    }]

    render(<ToastContainer toasts={toasts} onDismiss={jest.fn()} />)

    const actionButton = document.querySelector('#toast-action-test-1') as HTMLElement
    expect(actionButton).toBeInTheDocument()
    expect(actionButton).toHaveTextContent('Retry')

    act(() => {
      actionButton.click()
    })

    expect(actionFn).toHaveBeenCalled()
  })

  it('should render multiline messages with whitespace preserved', () => {
    const toasts: Toast[] = [{
      id: 'test-1',
      message: 'Line 1\nLine 2\nLine 3',
      type: 'info',
      duration: 5000
    }]

    const { container } = render(<ToastContainer toasts={toasts} onDismiss={jest.fn()} />)

    const message = container.querySelector('p.whitespace-pre-wrap')
    expect(message).toBeInTheDocument()
    expect(message?.textContent).toBe('Line 1\nLine 2\nLine 3')
  })

  it('should use default duration when not specified', async () => {
    const onDismiss = jest.fn()
    const toasts: Toast[] = [{
      id: 'test-1',
      message: 'Default duration',
      type: 'success'
    }]

    render(<ToastContainer toasts={toasts} onDismiss={onDismiss} />)

    act(() => {
      jest.advanceTimersByTime(5000)
    })

    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledWith('test-1')
    })
  })

  it('should have proper accessibility attributes', () => {
    const toasts: Toast[] = [{
      id: 'test-1',
      message: 'Accessible toast',
      type: 'info',
      duration: 5000
    }]

    render(<ToastContainer toasts={toasts} onDismiss={jest.fn()} />)

    const container = document.querySelector('#toast-container')
    expect(container).toHaveAttribute('aria-live', 'polite')
    expect(container).toHaveAttribute('aria-atomic', 'true')

    const closeButton = document.querySelector('#toast-close-test-1')
    expect(closeButton).toHaveAttribute('aria-label', 'Close notification')
  })
})
