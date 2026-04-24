import { renderHook, act } from '@testing-library/react'
import { useDOMChangesEditor } from '../useDOMChangesEditor'
import type { DOMChange } from '~src/types/dom-changes'

jest.mock('~src/utils/debug', () => ({
  debugLog: jest.fn(),
  debugError: jest.fn(),
  debugWarn: jest.fn()
}))

jest.mock('~src/lib/messaging', () => ({
  sendToContent: jest.fn(),
  sendToBackground: jest.fn()
}))

jest.mock('~src/utils/html-capture', () => ({
  capturePageHTML: jest.fn()
}))

describe('useDOMChangesEditor', () => {
  const defaultProps = {
    changes: [] as DOMChange[],
    onChange: jest.fn(),
    variantName: 'test-variant',
    experimentName: 'test-experiment',
    previewEnabled: false
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).chrome = {
      runtime: {
        onMessage: { addListener: jest.fn(), removeListener: jest.fn() }
      },
      tabs: { query: jest.fn() },
      storage: {
        session: { onChanged: { addListener: jest.fn(), removeListener: jest.fn() } },
        local: { get: jest.fn(), set: jest.fn() }
      }
    }
  })

  describe('handleEditChange', () => {
    it('should open editor for a style change with value property', () => {
      const styleChange: DOMChange = {
        selector: '.button',
        type: 'style',
        value: { backgroundColor: '#16a34a', borderColor: '#16a34a' }
      }

      const { result } = renderHook(() =>
        useDOMChangesEditor({ ...defaultProps, changes: [styleChange] })
      )

      act(() => {
        result.current.handleEditChange(0)
      })

      expect(result.current.editingChange).not.toBeNull()
      expect(result.current.editingChange!.type).toBe('style')
      expect(result.current.editingChange!.selector).toBe('.button')
      expect(result.current.editingChange!.styleProperties).toEqual([
        { key: 'backgroundColor', value: '#16a34a' },
        { key: 'borderColor', value: '#16a34a' }
      ])
    })

    it('should not crash when style change has undefined value', () => {
      const brokenChange = {
        selector: '.button',
        type: 'style'
      } as unknown as DOMChange

      const { result } = renderHook(() =>
        useDOMChangesEditor({ ...defaultProps, changes: [brokenChange] })
      )

      act(() => {
        result.current.handleEditChange(0)
      })

      expect(result.current.editingChange).not.toBeNull()
      expect(result.current.editingChange!.type).toBe('style')
      expect(result.current.editingChange!.styleProperties).toEqual([])
    })

    it('should treat style important flag as important even when values are clean', () => {
      const importantStyleChange: DOMChange = {
        selector: '.button',
        type: 'style',
        value: { color: 'red', fontSize: '14px' },
        important: true
      }

      const { result } = renderHook(() =>
        useDOMChangesEditor({ ...defaultProps, changes: [importantStyleChange] })
      )

      act(() => {
        result.current.handleEditChange(0)
      })

      expect(result.current.editingChange).not.toBeNull()
      expect(result.current.editingChange!.styleImportant).toBe(true)
      expect(result.current.editingChange!.styleProperties).toEqual([
        { key: 'color', value: 'red' },
        { key: 'fontSize', value: '14px' }
      ])
    })

    it('should open editor for a styleRules change', () => {
      const styleRulesChange: DOMChange = {
        selector: '.button',
        type: 'styleRules',
        states: {
          normal: { backgroundColor: '#007bff' },
          hover: { backgroundColor: '#0056b3' }
        },
        important: true
      }

      const { result } = renderHook(() =>
        useDOMChangesEditor({ ...defaultProps, changes: [styleRulesChange] })
      )

      act(() => {
        result.current.handleEditChange(0)
      })

      expect(result.current.editingChange).not.toBeNull()
      expect(result.current.editingChange!.type).toBe('styleRules')
      expect(result.current.editingChange!.styleRulesStates).toEqual({
        normal: { backgroundColor: '#007bff' },
        hover: { backgroundColor: '#0056b3' }
      })
      expect(result.current.editingChange!.styleRulesImportant).toBe(true)
    })

    it('should open editor for text change', () => {
      const textChange: DOMChange = {
        selector: 'h1',
        type: 'text',
        value: 'Hello World'
      }

      const { result } = renderHook(() =>
        useDOMChangesEditor({ ...defaultProps, changes: [textChange] })
      )

      act(() => {
        result.current.handleEditChange(0)
      })

      expect(result.current.editingChange).not.toBeNull()
      expect(result.current.editingChange!.type).toBe('text')
      expect(result.current.editingChange!.textValue).toBe('Hello World')
    })

    it('should preserve type when editing different changes at different indices', () => {
      const changes: DOMChange[] = [
        { selector: '.a', type: 'style', value: { color: 'red' } },
        { selector: '.b', type: 'styleRules', states: { hover: { color: 'blue' } } } as DOMChange
      ]

      const { result } = renderHook(() =>
        useDOMChangesEditor({ ...defaultProps, changes })
      )

      act(() => {
        result.current.handleEditChange(0)
      })
      expect(result.current.editingChange!.type).toBe('style')

      act(() => {
        result.current.handleCancelEdit()
      })

      act(() => {
        result.current.handleEditChange(1)
      })
      expect(result.current.editingChange!.type).toBe('styleRules')
    })
  })

  describe('handleSaveChange', () => {
    it('should save style change with value property', () => {
      const onChange = jest.fn()
      const styleChange: DOMChange = {
        selector: '.button',
        type: 'style',
        value: { backgroundColor: '#16a34a' }
      }

      const { result } = renderHook(() =>
        useDOMChangesEditor({ ...defaultProps, changes: [styleChange], onChange })
      )

      act(() => {
        result.current.handleEditChange(0)
      })

      act(() => {
        result.current.handleSaveChange(result.current.editingChange!)
      })

      expect(onChange).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'style',
          value: { backgroundColor: '#16a34a' }
        })
      ])
      const savedChange = onChange.mock.calls[0][0][0]
      expect(savedChange).not.toHaveProperty('css')
    })

    it('should preserve persistStyle when saving style change', () => {
      const onChange = jest.fn()
      const styleChange: DOMChange = {
        selector: '.button',
        type: 'style',
        value: { backgroundColor: '#16a34a' },
        persistStyle: true
      } as DOMChange

      const { result } = renderHook(() =>
        useDOMChangesEditor({ ...defaultProps, changes: [styleChange], onChange })
      )

      act(() => {
        result.current.handleEditChange(0)
      })

      expect(result.current.editingChange!.persistStyle).toBe(true)

      act(() => {
        result.current.handleSaveChange(result.current.editingChange!)
      })

      const savedChange = onChange.mock.calls[0][0][0]
      expect(savedChange.persistStyle).toBe(true)
    })

    it('should save inline style important flag separately from the style values', () => {
      const onChange = jest.fn()
      const styleChange: DOMChange = {
        selector: '.button',
        type: 'style',
        value: { color: 'red' },
        important: true
      }

      const { result } = renderHook(() =>
        useDOMChangesEditor({ ...defaultProps, changes: [styleChange], onChange })
      )

      act(() => {
        result.current.handleEditChange(0)
      })

      act(() => {
        result.current.handleSaveChange(result.current.editingChange!)
      })

      expect(onChange).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'style',
          value: { color: 'red' },
          important: true
        })
      ])
    })

    it('should preserve persistAttribute when saving attribute change', () => {
      const onChange = jest.fn()
      const attrChange: DOMChange = {
        selector: '.link',
        type: 'attribute',
        value: { href: '/new-page' },
        persistAttribute: true
      } as DOMChange

      const { result } = renderHook(() =>
        useDOMChangesEditor({ ...defaultProps, changes: [attrChange], onChange })
      )

      act(() => {
        result.current.handleEditChange(0)
      })

      expect(result.current.editingChange!.persistAttribute).toBe(true)

      act(() => {
        result.current.handleSaveChange(result.current.editingChange!)
      })

      const savedChange = onChange.mock.calls[0][0][0]
      expect(savedChange.persistAttribute).toBe(true)
    })

    it('should not include persistStyle when it is undefined', () => {
      const onChange = jest.fn()
      const styleChange: DOMChange = {
        selector: '.button',
        type: 'style',
        value: { color: 'red' }
      }

      const { result } = renderHook(() =>
        useDOMChangesEditor({ ...defaultProps, changes: [styleChange], onChange })
      )

      act(() => {
        result.current.handleEditChange(0)
      })

      act(() => {
        result.current.handleSaveChange(result.current.editingChange!)
      })

      const savedChange = onChange.mock.calls[0][0][0]
      expect(savedChange.persistStyle).toBeUndefined()
    })

    it('should not include persistAttribute when it is undefined', () => {
      const onChange = jest.fn()
      const attrChange: DOMChange = {
        selector: '.link',
        type: 'attribute',
        value: { href: '/page' }
      }

      const { result } = renderHook(() =>
        useDOMChangesEditor({ ...defaultProps, changes: [attrChange], onChange })
      )

      act(() => {
        result.current.handleEditChange(0)
      })

      act(() => {
        result.current.handleSaveChange(result.current.editingChange!)
      })

      const savedChange = onChange.mock.calls[0][0][0]
      expect(savedChange.persistAttribute).toBeUndefined()
    })
  })

  describe('handleCancelEdit', () => {
    it('should clear editingChange', () => {
      const changes: DOMChange[] = [
        { selector: '.a', type: 'text', value: 'test' }
      ]

      const { result } = renderHook(() =>
        useDOMChangesEditor({ ...defaultProps, changes })
      )

      act(() => {
        result.current.handleEditChange(0)
      })
      expect(result.current.editingChange).not.toBeNull()

      act(() => {
        result.current.handleCancelEdit()
      })
      expect(result.current.editingChange).toBeNull()
    })
  })
})
