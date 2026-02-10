import { renderHook, waitFor } from '@testing-library/react'
import { useEditorStateRestoration } from '../useEditorStateRestoration'
import type { DOMChange } from '~src/types/dom-changes'

const mockSessionGet = jest.fn()
const mockSessionSet = jest.fn()
const mockSessionRemove = jest.fn()
const mockLocalGet = jest.fn()
const mockLocalSet = jest.fn()
const mockLocalRemove = jest.fn()

jest.mock('~src/utils/storage', () => ({
  sessionStorage: {
    get: (...args: any[]) => mockSessionGet(...args),
    set: (...args: any[]) => mockSessionSet(...args),
    remove: (...args: any[]) => mockSessionRemove(...args)
  },
  localAreaStorage: {
    get: (...args: any[]) => mockLocalGet(...args),
    set: (...args: any[]) => mockLocalSet(...args),
    remove: (...args: any[]) => mockLocalRemove(...args)
  }
}))

jest.mock('~src/utils/debug', () => ({
  debugLog: jest.fn(),
  debugWarn: jest.fn()
}))

describe('useEditorStateRestoration', () => {
  const mockOnChange = jest.fn()
  const mockSetEditingChange = jest.fn()
  const mockSetPickingForField = jest.fn()

  const defaultProps = {
    variantName: 'test-variant',
    changes: [] as DOMChange[],
    onChange: mockOnChange,
    setEditingChange: mockSetEditingChange,
    setPickingForField: mockSetPickingForField,
    editingChange: null,
    pickingForField: null
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockSessionGet.mockResolvedValue(null)
    mockLocalGet.mockResolvedValue(null)
    mockSessionRemove.mockResolvedValue(undefined)
    mockLocalRemove.mockResolvedValue(undefined)

    ;(global as any).chrome = {
      runtime: {
        onMessage: { addListener: jest.fn(), removeListener: jest.fn() }
      },
      storage: {
        session: { onChanged: { addListener: jest.fn(), removeListener: jest.fn() } }
      }
    }
  })

  describe('AI state restoration guard', () => {
    it('should restore AI changes when current changes are empty', async () => {
      const aiChanges: DOMChange[] = [
        { selector: '.ai-button', type: 'styleRules', states: { hover: { color: 'blue' } } } as DOMChange
      ]

      mockSessionGet.mockImplementation((key: string) => {
        if (key === 'aiDomChangesState') {
          return Promise.resolve({ variantName: 'test-variant', changes: aiChanges })
        }
        return Promise.resolve(null)
      })

      renderHook(() => useEditorStateRestoration({ ...defaultProps, changes: [] }))

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(aiChanges)
      })
    })

    it('should NOT restore AI changes when current changes already exist', async () => {
      const existingChanges: DOMChange[] = [
        { selector: '.button', type: 'style', value: { color: 'red' } }
      ]
      const aiChanges: DOMChange[] = [
        { selector: '.button', type: 'styleRules', states: { hover: { color: 'blue' } } } as DOMChange
      ]

      mockSessionGet.mockImplementation((key: string) => {
        if (key === 'aiDomChangesState') {
          return Promise.resolve({ variantName: 'test-variant', changes: aiChanges })
        }
        return Promise.resolve(null)
      })

      renderHook(() =>
        useEditorStateRestoration({ ...defaultProps, changes: existingChanges })
      )

      await waitFor(() => {
        expect(mockSessionRemove).toHaveBeenCalledWith('aiDomChangesState')
      })

      expect(mockOnChange).not.toHaveBeenCalledWith(aiChanges)
    })

    it('should clean up AI state from both session and local storage even when not applying', async () => {
      const existingChanges: DOMChange[] = [
        { selector: '.button', type: 'style', value: { color: 'red' } }
      ]

      mockSessionGet.mockImplementation((key: string) => {
        if (key === 'aiDomChangesState') {
          return Promise.resolve({ variantName: 'test-variant', changes: [{ selector: '.x', type: 'text', value: 'y' }] })
        }
        return Promise.resolve(null)
      })

      renderHook(() =>
        useEditorStateRestoration({ ...defaultProps, changes: existingChanges })
      )

      await waitFor(() => {
        expect(mockSessionRemove).toHaveBeenCalledWith('aiDomChangesState')
        expect(mockLocalRemove).toHaveBeenCalledWith('aiDomChangesState')
      })
    })

    it('should restore from localAreaStorage when sessionStorage has no AI state', async () => {
      const aiChanges: DOMChange[] = [
        { selector: '.ai-button', type: 'text', value: 'AI text' }
      ]

      mockSessionGet.mockImplementation((key: string) => {
        if (key === 'aiDomChangesState') return Promise.resolve(null)
        return Promise.resolve(null)
      })
      mockLocalGet.mockImplementation((key: string) => {
        if (key === 'aiDomChangesState') {
          return Promise.resolve({ variantName: 'test-variant', changes: aiChanges })
        }
        return Promise.resolve(null)
      })

      renderHook(() => useEditorStateRestoration({ ...defaultProps, changes: [] }))

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(aiChanges)
      })
    })

    it('should NOT restore AI state for a different variant', async () => {
      const aiChanges: DOMChange[] = [
        { selector: '.x', type: 'text', value: 'test' }
      ]

      mockSessionGet.mockImplementation((key: string) => {
        if (key === 'aiDomChangesState') {
          return Promise.resolve({ variantName: 'other-variant', changes: aiChanges })
        }
        return Promise.resolve(null)
      })

      renderHook(() => useEditorStateRestoration({ ...defaultProps, changes: [] }))

      await waitFor(() => {
        expect(mockSessionGet).toHaveBeenCalled()
      })

      await new Promise(r => setTimeout(r, 50))
      expect(mockOnChange).not.toHaveBeenCalledWith(aiChanges)
    })

    it('should NOT restore AI state when changes array is empty', async () => {
      mockSessionGet.mockImplementation((key: string) => {
        if (key === 'aiDomChangesState') {
          return Promise.resolve({ variantName: 'test-variant', changes: [] })
        }
        return Promise.resolve(null)
      })

      renderHook(() => useEditorStateRestoration({ ...defaultProps, changes: [] }))

      await waitFor(() => {
        expect(mockSessionGet).toHaveBeenCalled()
      })

      await new Promise(r => setTimeout(r, 50))
      expect(mockOnChange).not.toHaveBeenCalled()
    })
  })
})
