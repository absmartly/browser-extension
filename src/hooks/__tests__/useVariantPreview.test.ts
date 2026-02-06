import { renderHook, waitFor, act } from '@testing-library/react'
import { useVariantPreview } from '../useVariantPreview'
import * as messaging from '~src/lib/messaging'
import type { DOMChange } from '~src/types/dom-changes'

jest.mock('~src/lib/messaging')
jest.mock('~src/utils/debug', () => ({
  debugLog: jest.fn(),
  debugError: jest.fn()
}))

describe('useVariantPreview', () => {
  let mockSendToContent: jest.Mock

  const mockVariants = [
    {
      name: 'Control',
      config: {
        __dom_changes: [
          { selector: '.control', type: 'text', value: 'Control text' }
        ]
      }
    },
    {
      name: 'Variant A',
      config: {
        __dom_changes: [
          { selector: '.variant-a', type: 'text', value: 'Variant A text' }
        ]
      }
    }
  ]

  const defaultOptions = {
    variants: mockVariants,
    experimentName: 'test-experiment',
    domFieldName: '__dom_changes',
    activeVEVariant: null
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()

    mockSendToContent = jest.fn().mockResolvedValue(undefined)
    ;(messaging.sendToContent as jest.Mock) = mockSendToContent

    ;(global as any).chrome = {
      runtime: {
        onMessage: {
          addListener: jest.fn(),
          removeListener: jest.fn()
        }
      }
    }
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  describe('handlePreviewToggle', () => {
    it('should enable preview and send changes to content script', async () => {
      const { result } = renderHook(() => useVariantPreview(defaultOptions))

      await act(async () => {
        await result.current.handlePreviewToggle(true, 0)
        jest.advanceTimersByTime(300)
        await Promise.resolve()
      })

      await waitFor(() => {
        expect(result.current.previewEnabled).toBe(true)
      })

      expect(result.current.activePreviewVariant).toBe(0)
      expect(mockSendToContent).toHaveBeenCalledWith({
        type: 'ABSMARTLY_PREVIEW',
        action: 'apply',
        changes: [{ selector: '.control', type: 'text', value: 'Control text' }],
        experimentName: 'test-experiment',
        variantName: 'Control'
      })
    })

    it('should disable preview and send remove message', async () => {
      const { result } = renderHook(() => useVariantPreview(defaultOptions))

      await act(async () => {
        await result.current.handlePreviewToggle(true, 0)
        jest.advanceTimersByTime(300)
        await Promise.resolve()
      })

      await act(async () => {
        await result.current.handlePreviewToggle(false, 0)
        jest.advanceTimersByTime(300)
        await Promise.resolve()
      })

      await waitFor(() => {
        expect(result.current.previewEnabled).toBe(false)
      })

      expect(result.current.activePreviewVariant).toBeNull()
      expect(mockSendToContent).toHaveBeenLastCalledWith({
        type: 'ABSMARTLY_PREVIEW',
        action: 'remove',
        experimentName: 'test-experiment'
      })
    })

    it('should filter disabled changes when applying preview', async () => {
      const variantsWithDisabled = [
        {
          name: 'Test Variant',
          config: {
            __dom_changes: [
              { selector: '.enabled', type: 'text' as const, value: 'Enabled' },
              { selector: '.disabled', type: 'text' as const, value: 'Disabled', disabled: true }
            ]
          }
        }
      ]

      const { result } = renderHook(() =>
        useVariantPreview({ ...defaultOptions, variants: variantsWithDisabled })
      )

      await act(async () => {
        await result.current.handlePreviewToggle(true, 0)
        jest.advanceTimersByTime(300)
        await Promise.resolve()
      })

      await waitFor(() => {
        expect(mockSendToContent).toHaveBeenCalled()
      })

      expect(mockSendToContent).toHaveBeenCalledWith({
        type: 'ABSMARTLY_PREVIEW',
        action: 'apply',
        changes: [{ selector: '.enabled', type: 'text', value: 'Enabled' }],
        experimentName: 'test-experiment',
        variantName: 'Test Variant'
      })
    })

    it('should handle preview toggle race conditions', async () => {
      const { result } = renderHook(() => useVariantPreview(defaultOptions))

      await act(async () => {
        const toggle1 = result.current.handlePreviewToggle(true, 0)
        const toggle2 = result.current.handlePreviewToggle(false, 0)
        const toggle3 = result.current.handlePreviewToggle(true, 1)
        await Promise.all([toggle1, toggle2, toggle3])
        jest.advanceTimersByTime(300)
        await Promise.resolve()
      })

      await waitFor(() => {
        expect(result.current.previewEnabled).toBe(true)
      })

      expect(result.current.activePreviewVariant).toBe(1)
    })

    it('should handle sendToContent errors gracefully', async () => {
      mockSendToContent.mockRejectedValue(new Error('No active tab'))

      const { result } = renderHook(() => useVariantPreview(defaultOptions))

      await act(async () => {
        await result.current.handlePreviewToggle(true, 0)
      })

      expect(result.current.previewEnabled).toBe(true)
      expect(result.current.activePreviewVariant).toBe(0)
    })
  })

  describe('handlePreviewWithChanges', () => {
    it('should apply preview with provided changes', async () => {
      const customChanges: DOMChange[] = [
        { selector: '.custom', type: 'html' as const, value: '<span>Custom</span>' }
      ]

      const { result } = renderHook(() => useVariantPreview(defaultOptions))

      await act(async () => {
        await result.current.handlePreviewWithChanges(true, 0, customChanges)
      })

      expect(result.current.previewEnabled).toBe(true)
      expect(result.current.activePreviewVariant).toBe(0)
      expect(mockSendToContent).toHaveBeenCalledWith({
        type: 'ABSMARTLY_PREVIEW',
        action: 'apply',
        changes: customChanges,
        experimentName: 'test-experiment',
        variantName: 'Control'
      })
    })

    it('should filter disabled changes from provided changes', async () => {
      const changesWithDisabled: DOMChange[] = [
        { selector: '.enabled', type: 'text' as const, value: 'Enabled' },
        { selector: '.disabled', type: 'text' as const, value: 'Disabled', disabled: true }
      ]

      const { result } = renderHook(() => useVariantPreview(defaultOptions))

      await act(async () => {
        await result.current.handlePreviewWithChanges(true, 0, changesWithDisabled)
      })

      expect(mockSendToContent).toHaveBeenCalledWith({
        type: 'ABSMARTLY_PREVIEW',
        action: 'apply',
        changes: [{ selector: '.enabled', type: 'text', value: 'Enabled' }],
        experimentName: 'test-experiment',
        variantName: 'Control'
      })
    })

    it('should not send message when disabled', async () => {
      const { result } = renderHook(() => useVariantPreview(defaultOptions))

      await act(async () => {
        await result.current.handlePreviewWithChanges(false, 0, [])
      })

      expect(result.current.previewEnabled).toBe(false)
      expect(mockSendToContent).not.toHaveBeenCalled()
    })
  })

  describe('handlePreviewRefresh', () => {
    it('should refresh active preview with latest changes', async () => {
      const { result } = renderHook(() => useVariantPreview(defaultOptions))

      await act(async () => {
        await result.current.handlePreviewToggle(true, 0)
      })

      mockSendToContent.mockClear()

      await act(async () => {
        await result.current.handlePreviewRefresh(0)
      })

      expect(mockSendToContent).toHaveBeenCalledWith({
        type: 'ABSMARTLY_PREVIEW',
        action: 'update',
        changes: [{ selector: '.control', type: 'text', value: 'Control text' }],
        experimentName: 'test-experiment',
        variantName: 'Control'
      })
    })

    it('should not refresh when preview is disabled', async () => {
      const { result } = renderHook(() => useVariantPreview(defaultOptions))

      await act(async () => {
        await result.current.handlePreviewRefresh(0)
      })

      expect(mockSendToContent).not.toHaveBeenCalled()
    })

    it('should not refresh when different variant is active', async () => {
      const { result } = renderHook(() => useVariantPreview(defaultOptions))

      await act(async () => {
        await result.current.handlePreviewToggle(true, 0)
      })

      mockSendToContent.mockClear()

      await act(async () => {
        await result.current.handlePreviewRefresh(1)
      })

      expect(mockSendToContent).not.toHaveBeenCalled()
    })

    it('should handle refresh errors gracefully', async () => {
      mockSendToContent.mockRejectedValue(new Error('Tab closed'))

      const { result } = renderHook(() => useVariantPreview(defaultOptions))

      await act(async () => {
        await result.current.handlePreviewToggle(true, 0)
      })

      await act(async () => {
        await result.current.handlePreviewRefresh(0)
      })

      expect(result.current.previewEnabled).toBe(true)
    })
  })

  describe('Message listener', () => {
    it('should add and remove message listener', () => {
      const { unmount } = renderHook(() => useVariantPreview(defaultOptions))

      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled()

      unmount()

      expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalled()
    })

    it('should handle PREVIEW_STATE_CHANGED message', async () => {
      let messageHandler: (message: any) => void = () => {}

      ;(chrome.runtime.onMessage.addListener as jest.Mock).mockImplementation((handler) => {
        messageHandler = handler
      })

      const { result } = renderHook(() => useVariantPreview(defaultOptions))

      await act(async () => {
        await result.current.handlePreviewToggle(true, 0)
      })

      expect(result.current.previewEnabled).toBe(true)

      mockSendToContent.mockClear()

      act(() => {
        messageHandler({ type: 'PREVIEW_STATE_CHANGED', enabled: false })
      })

      await waitFor(() => {
        expect(mockSendToContent).toHaveBeenCalledWith({
          type: 'ABSMARTLY_PREVIEW',
          action: 'remove',
          experimentName: 'test-experiment'
        })
      })
    })

    it('should ignore message when preview already disabled', () => {
      let messageHandler: (message: any) => void = () => {}

      ;(chrome.runtime.onMessage.addListener as jest.Mock).mockImplementation((handler) => {
        messageHandler = handler
      })

      const { result } = renderHook(() => useVariantPreview(defaultOptions))

      expect(result.current.previewEnabled).toBe(false)

      act(() => {
        messageHandler({ type: 'PREVIEW_STATE_CHANGED', enabled: false })
      })

      expect(mockSendToContent).not.toHaveBeenCalled()
    })

    it('should handle malformed messages gracefully', () => {
      let messageHandler: (message: any) => void = () => {}

      ;(chrome.runtime.onMessage.addListener as jest.Mock).mockImplementation((handler) => {
        messageHandler = handler
      })

      renderHook(() => useVariantPreview(defaultOptions))

      expect(() => {
        messageHandler(null)
        messageHandler(undefined)
        messageHandler({ type: 'UNKNOWN' })
        messageHandler({ enabled: false })
      }).not.toThrow()
    })
  })

  describe('Cleanup on unmount', () => {
    it('should send remove message on unmount', async () => {
      const { unmount } = renderHook(() => useVariantPreview(defaultOptions))

      unmount()

      await waitFor(() => {
        expect(mockSendToContent).toHaveBeenCalledWith({
          type: 'ABSMARTLY_PREVIEW',
          action: 'remove',
          experimentName: 'test-experiment'
        })
      })
    })

    it('should handle cleanup errors silently', async () => {
      mockSendToContent.mockRejectedValue(new Error('Tab closed'))

      const { unmount } = renderHook(() => useVariantPreview(defaultOptions))

      expect(() => unmount()).not.toThrow()
    })

    it('should cleanup preview on unmount even if preview active', async () => {
      const { result, unmount } = renderHook(() => useVariantPreview(defaultOptions))

      await act(async () => {
        await result.current.handlePreviewToggle(true, 0)
      })

      mockSendToContent.mockClear()

      unmount()

      await waitFor(() => {
        expect(mockSendToContent).toHaveBeenCalled()
      })
    })
  })

  describe('DOM mutation during active preview', () => {
    it('should handle variant config changes while preview active', async () => {
      const { result, rerender } = renderHook(
        (props) => useVariantPreview(props),
        { initialProps: defaultOptions }
      )

      await act(async () => {
        await result.current.handlePreviewToggle(true, 0)
      })

      const updatedVariants = [
        {
          name: 'Control',
          config: {
            __dom_changes: [
              { selector: '.control-updated', type: 'text', value: 'Updated text' }
            ]
          }
        }
      ]

      rerender({ ...defaultOptions, variants: updatedVariants })

      await act(async () => {
        await result.current.handlePreviewRefresh(0)
      })

      expect(mockSendToContent).toHaveBeenLastCalledWith({
        type: 'ABSMARTLY_PREVIEW',
        action: 'update',
        changes: [{ selector: '.control-updated', type: 'text', value: 'Updated text' }],
        experimentName: 'test-experiment',
        variantName: 'Control'
      })
    })
  })

  describe('Multiple preview toggles rapidly', () => {
    it('should handle rapid enable/disable cycles', async () => {
      const { result } = renderHook(() => useVariantPreview(defaultOptions))

      await act(async () => {
        for (let i = 0; i < 10; i++) {
          await result.current.handlePreviewToggle(i % 2 === 0, 0)
        }
      })

      expect(result.current.previewEnabled).toBe(false)
      expect(result.current.activePreviewVariant).toBeNull()
    })

    it('should handle rapid variant switches', async () => {
      const { result } = renderHook(() => useVariantPreview(defaultOptions))

      await act(async () => {
        await result.current.handlePreviewToggle(true, 0)
        await result.current.handlePreviewToggle(true, 1)
        await result.current.handlePreviewToggle(true, 0)
        await result.current.handlePreviewToggle(true, 1)
        jest.advanceTimersByTime(300)
        await Promise.resolve()
      })

      await waitFor(() => {
        expect(result.current.activePreviewVariant).toBe(1)
      })

      await waitFor(() => {
        expect(mockSendToContent).toHaveBeenCalled()
      })

      expect(mockSendToContent).toHaveBeenLastCalledWith({
        type: 'ABSMARTLY_PREVIEW',
        action: 'apply',
        changes: [{ selector: '.variant-a', type: 'text', value: 'Variant A text' }],
        experimentName: 'test-experiment',
        variantName: 'Variant A'
      })
    })
  })

  describe('Preview state sync issues', () => {
    it('should maintain correct state when sendToContent fails', async () => {
      mockSendToContent.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useVariantPreview(defaultOptions))

      await act(async () => {
        await result.current.handlePreviewToggle(true, 0)
      })

      expect(result.current.previewEnabled).toBe(true)
      expect(result.current.activePreviewVariant).toBe(0)
    })

    it('should handle state updates when no variants available', async () => {
      const { result } = renderHook(() =>
        useVariantPreview({ ...defaultOptions, variants: [] })
      )

      await act(async () => {
        await result.current.handlePreviewToggle(true, 0)
      })

      expect(result.current.previewEnabled).toBe(true)
      expect(mockSendToContent).not.toHaveBeenCalled()
    })
  })
})
