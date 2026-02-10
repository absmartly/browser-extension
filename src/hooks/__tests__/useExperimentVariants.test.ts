import { renderHook, act } from '@testing-library/react'
import { useExperimentVariants } from '../useExperimentVariants'

jest.mock('~src/utils/debug', () => ({
  debugLog: jest.fn(),
  debugError: jest.fn(),
  debugWarn: jest.fn()
}))

jest.mock('~src/lib/validation-schemas', () => ({
  safeParseVariantConfig: jest.fn((configStr: string) => {
    try {
      return { success: true, data: JSON.parse(configStr) }
    } catch {
      return { success: false, error: 'parse error' }
    }
  })
}))

describe('useExperimentVariants', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return stable defaultVariants reference across re-renders', () => {
    const { result, rerender } = renderHook(() => useExperimentVariants())

    const firstVariants = result.current.initialVariants
    rerender()
    const secondVariants = result.current.initialVariants

    expect(firstVariants).toBe(secondVariants)
  })

  it('should return stable handleVariantsChange reference across re-renders', () => {
    const { result, rerender } = renderHook(() => useExperimentVariants())

    const firstHandler = result.current.handleVariantsChange
    rerender()
    const secondHandler = result.current.handleVariantsChange

    expect(firstHandler).toBe(secondHandler)
  })

  it('should not trigger infinite re-renders when handleVariantsChange is called', () => {
    let renderCount = 0
    const { result } = renderHook(() => {
      renderCount++
      return useExperimentVariants()
    })

    const renderCountBefore = renderCount

    act(() => {
      result.current.handleVariantsChange([
        { name: 'Control', config: {} },
        { name: 'Variant 1', config: { key: 'value' } }
      ], true)
    })

    expect(renderCount - renderCountBefore).toBeLessThanOrEqual(2)
  })

  it('should return stable initialVariants when experiment prop is unchanged', () => {
    const experiment = {
      id: 1,
      name: 'test',
      variants: [
        { name: 'Control', variant: 0, config: '{}' },
        { name: 'Variant 1', variant: 1, config: '{"key":"val"}' }
      ]
    }

    const { result, rerender } = renderHook(
      ({ exp }) => useExperimentVariants({ experiment: exp as any }),
      { initialProps: { exp: experiment } }
    )

    const firstVariants = result.current.initialVariants
    rerender({ exp: experiment })
    const secondVariants = result.current.initialVariants

    expect(firstVariants).toBe(secondVariants)
  })

  it('should not cause excessive re-renders in a realistic usage cycle', () => {
    let renderCount = 0

    const { result, rerender } = renderHook(() => {
      renderCount++
      return useExperimentVariants()
    })

    renderCount = 0

    rerender()
    rerender()
    rerender()

    expect(renderCount).toBeLessThanOrEqual(3)

    const prevRenderCount = renderCount
    act(() => {
      result.current.handleVariantsChange([
        { name: 'Control', config: {} },
        { name: 'Updated', config: {} }
      ], true)
    })

    rerender()
    rerender()

    expect(renderCount - prevRenderCount).toBeLessThanOrEqual(4)
  })
})
