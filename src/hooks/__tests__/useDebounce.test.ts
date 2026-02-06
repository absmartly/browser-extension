import { renderHook, act } from '@testing-library/react'
import { useDebounce } from '../useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  describe('Basic functionality', () => {
    it('should return initial value immediately', () => {
      const { result } = renderHook(() => useDebounce('initial', 500))

      expect(result.current).toBe('initial')
    })

    it('should debounce value changes', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      )

      expect(result.current).toBe('initial')

      rerender({ value: 'updated', delay: 500 })

      expect(result.current).toBe('initial')

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(result.current).toBe('updated')
    })

    it('should update value after delay', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 300 } }
      )

      rerender({ value: 'first change', delay: 300 })

      act(() => {
        jest.advanceTimersByTime(300)
      })

      expect(result.current).toBe('first change')

      rerender({ value: 'second change', delay: 300 })

      act(() => {
        jest.advanceTimersByTime(300)
      })

      expect(result.current).toBe('second change')
    })
  })

  describe('Rapid value changes', () => {
    it('should only trigger update for final value after rapid changes', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      )

      rerender({ value: 'change1', delay: 500 })
      act(() => { jest.advanceTimersByTime(100) })

      rerender({ value: 'change2', delay: 500 })
      act(() => { jest.advanceTimersByTime(100) })

      rerender({ value: 'change3', delay: 500 })
      act(() => { jest.advanceTimersByTime(100) })

      rerender({ value: 'final', delay: 500 })

      expect(result.current).toBe('initial')

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(result.current).toBe('final')
    })

    it('should reset timer on each value change', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      )

      rerender({ value: 'change1', delay: 500 })
      act(() => { jest.advanceTimersByTime(400) })

      rerender({ value: 'change2', delay: 500 })
      act(() => { jest.advanceTimersByTime(400) })

      rerender({ value: 'change3', delay: 500 })
      expect(result.current).toBe('initial')

      act(() => { jest.advanceTimersByTime(500) })

      expect(result.current).toBe('change3')
    })
  })

  describe('Cleanup of pending debounces on unmount', () => {
    it('should clear timeout when unmounted before delay completes', () => {
      const { rerender, unmount } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      )

      rerender({ value: 'changed', delay: 500 })

      unmount()

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(() => unmount()).not.toThrow()
    })

    it('should not cause memory leaks with multiple value changes', () => {
      const { result, rerender, unmount } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 100 } }
      )

      for (let i = 0; i < 100; i++) {
        rerender({ value: `value-${i}`, delay: 100 })
      }

      unmount()

      expect(() => {
        act(() => {
          jest.advanceTimersByTime(1000)
        })
      }).not.toThrow()
    })

    it('should clear previous timeout when value changes', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

      const { rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      )

      rerender({ value: 'change1', delay: 500 })
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)

      rerender({ value: 'change2', delay: 500 })
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(2)

      rerender({ value: 'change3', delay: 500 })
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(3)

      clearTimeoutSpy.mockRestore()
    })
  })

  describe('Zero delay edge case', () => {
    it('should handle zero delay', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 0 } }
      )

      rerender({ value: 'updated', delay: 0 })

      act(() => {
        jest.advanceTimersByTime(0)
      })

      expect(result.current).toBe('updated')
    })

    it('should still debounce with zero delay', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 0 } }
      )

      rerender({ value: 'change1', delay: 0 })
      rerender({ value: 'change2', delay: 0 })
      rerender({ value: 'change3', delay: 0 })

      expect(result.current).toBe('initial')

      act(() => {
        jest.advanceTimersByTime(0)
      })

      expect(result.current).toBe('change3')
    })
  })

  describe('Delay changes', () => {
    it('should handle changing delay value', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      )

      rerender({ value: 'updated', delay: 300 })

      act(() => {
        jest.advanceTimersByTime(300)
      })

      expect(result.current).toBe('updated')
    })

    it('should use new delay after delay prop changes', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      )

      rerender({ value: 'updated', delay: 500 })
      act(() => { jest.advanceTimersByTime(200) })

      rerender({ value: 'updated', delay: 100 })

      act(() => {
        jest.advanceTimersByTime(100)
      })

      expect(result.current).toBe('updated')
    })
  })

  describe('Type safety', () => {
    it('should work with string values', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'test', delay: 100 } }
      )

      rerender({ value: 'updated', delay: 100 })

      act(() => {
        jest.advanceTimersByTime(100)
      })

      expect(result.current).toBe('updated')
    })

    it('should work with number values', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 0, delay: 100 } }
      )

      rerender({ value: 42, delay: 100 })

      act(() => {
        jest.advanceTimersByTime(100)
      })

      expect(result.current).toBe(42)
    })

    it('should work with object values', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: { a: 1 }, delay: 100 } }
      )

      const newValue = { a: 2, b: 3 }
      rerender({ value: newValue, delay: 100 })

      act(() => {
        jest.advanceTimersByTime(100)
      })

      expect(result.current).toEqual(newValue)
    })

    it('should work with array values', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: [1, 2], delay: 100 } }
      )

      const newValue = [3, 4, 5]
      rerender({ value: newValue, delay: 100 })

      act(() => {
        jest.advanceTimersByTime(100)
      })

      expect(result.current).toEqual(newValue)
    })

    it('should work with null and undefined', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: null as string | null, delay: 100 } }
      )

      rerender({ value: 'not null', delay: 100 })

      act(() => {
        jest.advanceTimersByTime(100)
      })

      expect(result.current).toBe('not null')

      rerender({ value: undefined as string | undefined, delay: 100 })

      act(() => {
        jest.advanceTimersByTime(100)
      })

      expect(result.current).toBeUndefined()
    })
  })

  describe('Common use cases', () => {
    it('should debounce search input', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: '', delay: 300 } }
      )

      const searchTerms = ['h', 'he', 'hel', 'hell', 'hello']

      searchTerms.forEach((term, index) => {
        rerender({ value: term, delay: 300 })
        if (index < searchTerms.length - 1) {
          act(() => { jest.advanceTimersByTime(100) })
        }
      })

      expect(result.current).toBe('')

      act(() => {
        jest.advanceTimersByTime(300)
      })

      expect(result.current).toBe('hello')
    })

    it('should debounce form validation', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: { email: '', password: '' }, delay: 500 } }
      )

      rerender({ value: { email: 'user@', password: '' }, delay: 500 })
      act(() => { jest.advanceTimersByTime(200) })

      rerender({ value: { email: 'user@example', password: '' }, delay: 500 })
      act(() => { jest.advanceTimersByTime(200) })

      rerender({ value: { email: 'user@example.com', password: 'pass' }, delay: 500 })

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(result.current).toEqual({ email: 'user@example.com', password: 'pass' })
    })
  })
})
