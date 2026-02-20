import { renderHook, act } from '@testing-library/react'
import { useViewNavigation } from '../useViewNavigation'
import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'

jest.mock('~src/utils/debug', () => ({
  debugLog: jest.fn(),
  debugWarn: jest.fn()
}))

jest.mock('~src/utils/storage', () => ({
  localAreaStorage: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined)
  }
}))

describe('useViewNavigation', () => {
  const mockOnGenerate = jest.fn<Promise<AIDOMGenerationResult>, any[]>().mockResolvedValue({
    response: 'test',
    domChanges: [],
    action: 'replace_all'
  })
  const mockCurrentChanges: DOMChange[] = [
    { selector: '.test', type: 'text', value: 'Hello' }
  ]
  const mockOnRestoreChanges = jest.fn()
  const mockOnPreviewToggle = jest.fn()
  const mockOnPreviewRefresh = jest.fn()
  const mockOnPreviewWithChanges = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('handleNavigateToAI', () => {
    it('should navigate to ai-dom-changes view', () => {
      const { result } = renderHook(() => useViewNavigation())

      act(() => {
        result.current.handleNavigateToAI(
          'Variant A',
          mockOnGenerate,
          mockCurrentChanges,
          mockOnRestoreChanges,
          mockOnPreviewToggle,
          mockOnPreviewRefresh,
          mockOnPreviewWithChanges
        )
      })

      expect(result.current.view).toBe('ai-dom-changes')
      expect(result.current.aiDomContext).not.toBeNull()
      expect(result.current.aiDomContext!.variantName).toBe('Variant A')
      expect(result.current.aiDomContext!.onPreviewWithChanges).toBe(mockOnPreviewWithChanges)
    })

    it('should preserve the correct onPreviewWithChanges callback from the first call', () => {
      const { result } = renderHook(() => useViewNavigation())

      const correctPreviewWithChanges = jest.fn()
      const wrongPreviewWithChanges = jest.fn()

      act(() => {
        result.current.handleNavigateToAI(
          'Variant A',
          mockOnGenerate,
          mockCurrentChanges,
          mockOnRestoreChanges,
          mockOnPreviewToggle,
          mockOnPreviewRefresh,
          correctPreviewWithChanges
        )

        result.current.handleNavigateToAI(
          'Variant A',
          mockOnGenerate,
          mockCurrentChanges,
          mockOnRestoreChanges,
          mockOnPreviewToggle,
          mockOnPreviewRefresh,
          wrongPreviewWithChanges
        )
      })

      expect(result.current.aiDomContext!.onPreviewWithChanges).toBe(correctPreviewWithChanges)
      expect(result.current.aiDomContext!.onPreviewWithChanges).not.toBe(wrongPreviewWithChanges)
    })

    it('should ignore duplicate calls in the same synchronous frame', () => {
      const { result } = renderHook(() => useViewNavigation())

      const firstCallback = jest.fn()
      const secondCallback = jest.fn()
      const thirdCallback = jest.fn()

      act(() => {
        result.current.handleNavigateToAI(
          'Variant A', mockOnGenerate, mockCurrentChanges,
          mockOnRestoreChanges, mockOnPreviewToggle, mockOnPreviewRefresh, firstCallback
        )
        result.current.handleNavigateToAI(
          'Variant A', mockOnGenerate, mockCurrentChanges,
          mockOnRestoreChanges, mockOnPreviewToggle, mockOnPreviewRefresh, secondCallback
        )
        result.current.handleNavigateToAI(
          'Variant A', mockOnGenerate, mockCurrentChanges,
          mockOnRestoreChanges, mockOnPreviewToggle, mockOnPreviewRefresh, thirdCallback
        )
      })

      expect(result.current.aiDomContext!.onPreviewWithChanges).toBe(firstCallback)
    })

    it('should skip if already in ai-dom-changes view', () => {
      const { result } = renderHook(() => useViewNavigation())

      act(() => {
        result.current.handleNavigateToAI(
          'Variant A', mockOnGenerate, mockCurrentChanges,
          mockOnRestoreChanges, mockOnPreviewToggle, mockOnPreviewRefresh, mockOnPreviewWithChanges
        )
      })

      expect(result.current.view).toBe('ai-dom-changes')

      const newCallback = jest.fn()
      act(() => {
        result.current.handleNavigateToAI(
          'Variant B', mockOnGenerate, [],
          mockOnRestoreChanges, mockOnPreviewToggle, mockOnPreviewRefresh, newCallback
        )
      })

      expect(result.current.aiDomContext!.variantName).toBe('Variant A')
      expect(result.current.aiDomContext!.onPreviewWithChanges).toBe(mockOnPreviewWithChanges)
    })

    it('should store all callbacks in aiDomContext', () => {
      const { result } = renderHook(() => useViewNavigation())

      act(() => {
        result.current.handleNavigateToAI(
          'Variant A', mockOnGenerate, mockCurrentChanges,
          mockOnRestoreChanges, mockOnPreviewToggle, mockOnPreviewRefresh, mockOnPreviewWithChanges
        )
      })

      const ctx = result.current.aiDomContext!
      expect(ctx.variantName).toBe('Variant A')
      expect(ctx.onGenerate).toBe(mockOnGenerate)
      expect(ctx.currentChanges).toBe(mockCurrentChanges)
      expect(ctx.onRestoreChanges).toBe(mockOnRestoreChanges)
      expect(ctx.onPreviewToggle).toBe(mockOnPreviewToggle)
      expect(ctx.onPreviewRefresh).toBe(mockOnPreviewRefresh)
      expect(ctx.onPreviewWithChanges).toBe(mockOnPreviewWithChanges)
      expect(ctx.previousView).toBe('list')
    })

    it('should clear autoNavigateToAI on navigation', () => {
      const { result } = renderHook(() => useViewNavigation())

      act(() => {
        result.current.setAutoNavigateToAI('Variant A')
      })

      expect(result.current.autoNavigateToAI).toBe('Variant A')

      act(() => {
        result.current.handleNavigateToAI(
          'Variant A', mockOnGenerate, mockCurrentChanges,
          mockOnRestoreChanges, mockOnPreviewToggle, mockOnPreviewRefresh, mockOnPreviewWithChanges
        )
      })

      expect(result.current.autoNavigateToAI).toBeNull()
    })
  })

  describe('handleBackFromAI', () => {
    it('should return to previous view', () => {
      const { result } = renderHook(() => useViewNavigation())

      act(() => {
        result.current.handleNavigateToAI(
          'Variant A', mockOnGenerate, mockCurrentChanges,
          mockOnRestoreChanges, mockOnPreviewToggle, mockOnPreviewRefresh, mockOnPreviewWithChanges
        )
      })

      expect(result.current.view).toBe('ai-dom-changes')

      act(() => {
        result.current.handleBackFromAI()
      })

      expect(result.current.view).toBe('list')
    })

    it('should allow re-navigation after going back', () => {
      const { result } = renderHook(() => useViewNavigation())

      act(() => {
        result.current.handleNavigateToAI(
          'Variant A', mockOnGenerate, mockCurrentChanges,
          mockOnRestoreChanges, mockOnPreviewToggle, mockOnPreviewRefresh, mockOnPreviewWithChanges
        )
      })

      expect(result.current.view).toBe('ai-dom-changes')

      act(() => {
        result.current.handleBackFromAI()
      })

      expect(result.current.view).toBe('list')

      const newCallback = jest.fn()
      act(() => {
        result.current.handleNavigateToAI(
          'Variant B', mockOnGenerate, [],
          mockOnRestoreChanges, mockOnPreviewToggle, mockOnPreviewRefresh, newCallback
        )
      })

      expect(result.current.view).toBe('ai-dom-changes')
      expect(result.current.aiDomContext!.variantName).toBe('Variant B')
      expect(result.current.aiDomContext!.onPreviewWithChanges).toBe(newCallback)
    })

    it('should fall back to list view if no context', () => {
      const { result } = renderHook(() => useViewNavigation())

      act(() => {
        result.current.handleBackFromAI()
      })

      expect(result.current.view).toBe('list')
    })
  })

  describe('navigation guard reset', () => {
    it('should reset guard when view changes away from ai-dom-changes externally', () => {
      const { result } = renderHook(() => useViewNavigation())

      act(() => {
        result.current.handleNavigateToAI(
          'Variant A', mockOnGenerate, mockCurrentChanges,
          mockOnRestoreChanges, mockOnPreviewToggle, mockOnPreviewRefresh, mockOnPreviewWithChanges
        )
      })

      expect(result.current.view).toBe('ai-dom-changes')

      act(() => {
        result.current.setView('list')
      })

      expect(result.current.view).toBe('list')

      const newCallback = jest.fn()
      act(() => {
        result.current.handleNavigateToAI(
          'Variant B', mockOnGenerate, [],
          mockOnRestoreChanges, mockOnPreviewToggle, mockOnPreviewRefresh, newCallback
        )
      })

      expect(result.current.view).toBe('ai-dom-changes')
      expect(result.current.aiDomContext!.variantName).toBe('Variant B')
    })

    it('should preserve previousView correctly', () => {
      const { result } = renderHook(() => useViewNavigation())

      act(() => {
        result.current.setView('detail')
      })

      act(() => {
        result.current.handleNavigateToAI(
          'Variant A', mockOnGenerate, mockCurrentChanges,
          mockOnRestoreChanges, mockOnPreviewToggle, mockOnPreviewRefresh, mockOnPreviewWithChanges
        )
      })

      expect(result.current.aiDomContext!.previousView).toBe('detail')

      act(() => {
        result.current.handleBackFromAI()
      })

      expect(result.current.view).toBe('detail')
    })
  })
})
