import { renderHook, waitFor, act } from '@testing-library/react'
import { useCustomFields } from '../useCustomFields'
import { BackgroundAPIClient } from '~src/lib/background-api-client'

jest.mock('~src/lib/background-api-client')
jest.mock('~src/utils/debug', () => ({
  debugLog: jest.fn(),
  debugError: jest.fn()
}))

describe('useCustomFields', () => {
  let mockGetCustomSectionFields: jest.Mock

  beforeEach(() => {
    mockGetCustomSectionFields = jest.fn()
    ;(BackgroundAPIClient as jest.Mock).mockImplementation(() => ({
      getCustomSectionFields: mockGetCustomSectionFields
    }))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should fetch custom fields on mount', async () => {
    const mockFields = [
      {
        id: 1,
        section_id: 1,
        title: 'Hypothesis',
        help_text: 'What is your hypothesis?',
        placeholder: 'Enter hypothesis',
        default_value: '',
        type: 'text' as const,
        required: true,
        archived: false,
        order_index: 1
      }
    ]

    mockGetCustomSectionFields.mockResolvedValue(mockFields)

    const { result } = renderHook(() => useCustomFields())

    expect(result.current.loading).toBe(true)
    expect(result.current.customFields).toEqual([])
    expect(result.current.error).toBeNull()

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.customFields).toEqual(mockFields)
    expect(result.current.error).toBeNull()
    expect(mockGetCustomSectionFields).toHaveBeenCalledTimes(1)
  })

  it('should handle empty custom fields response', async () => {
    mockGetCustomSectionFields.mockResolvedValue([])

    const { result } = renderHook(() => useCustomFields())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.customFields).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('should handle fetch errors gracefully', async () => {
    const errorMessage = 'Failed to fetch custom fields'
    mockGetCustomSectionFields.mockRejectedValue(new Error(errorMessage))

    const { result } = renderHook(() => useCustomFields())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.customFields).toEqual([])
    expect(result.current.error).toBe(errorMessage)
  })

  it('should handle non-Error objects in catch block', async () => {
    mockGetCustomSectionFields.mockRejectedValue('String error')

    const { result } = renderHook(() => useCustomFields())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.customFields).toEqual([])
    expect(result.current.error).toBe('Failed to fetch custom fields')
  })

  it('should allow refetching custom fields', async () => {
    const mockFields1 = [
      { id: 1, title: 'Field 1', type: 'text' as const, required: true }
    ]
    const mockFields2 = [
      { id: 1, title: 'Field 1', type: 'text' as const, required: true },
      { id: 2, title: 'Field 2', type: 'string' as const, required: false }
    ]

    mockGetCustomSectionFields.mockResolvedValueOnce(mockFields1)

    const { result } = renderHook(() => useCustomFields())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.customFields).toEqual(mockFields1)

    mockGetCustomSectionFields.mockResolvedValueOnce(mockFields2)

    result.current.refetch()

    await waitFor(() => {
      expect(result.current.customFields).toEqual(mockFields2)
    })

    expect(mockGetCustomSectionFields).toHaveBeenCalledTimes(2)
  })

  it('should handle multiple field types', async () => {
    const mockFields = [
      { id: 1, title: 'Text', type: 'text' as const, required: true, default_value: '' },
      { id: 2, title: 'String', type: 'string' as const, required: false, default_value: 'default' },
      { id: 3, title: 'JSON', type: 'json' as const, required: false, default_value: '{}' },
      { id: 4, title: 'Boolean', type: 'boolean' as const, required: false, default_value: 'false' },
      { id: 5, title: 'Number', type: 'number' as const, required: false, default_value: '0' }
    ]

    mockGetCustomSectionFields.mockResolvedValue(mockFields)

    const { result } = renderHook(() => useCustomFields())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.customFields).toHaveLength(5)
    expect(result.current.customFields.map(f => f.type)).toEqual([
      'text', 'string', 'json', 'boolean', 'number'
    ])
  })

  it('should set loading state correctly during refetch', async () => {
    mockGetCustomSectionFields.mockResolvedValue([])

    const { result } = renderHook(() => useCustomFields())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    let resolveRefetch: (value: any) => void
    mockGetCustomSectionFields.mockImplementation(() =>
      new Promise(resolve => { resolveRefetch = resolve })
    )

    act(() => {
      result.current.refetch()
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(true)
    })

    await act(async () => {
      resolveRefetch([{ id: 1, title: 'Field', type: 'text' as const, required: true }])
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  })

  it('should clear error state on successful refetch', async () => {
    mockGetCustomSectionFields.mockRejectedValueOnce(new Error('Initial error'))

    const { result } = renderHook(() => useCustomFields())

    await waitFor(() => {
      expect(result.current.error).toBe('Initial error')
    })

    mockGetCustomSectionFields.mockResolvedValueOnce([
      { id: 1, title: 'Field', type: 'text' as const, required: true }
    ])

    result.current.refetch()

    await waitFor(() => {
      expect(result.current.error).toBeNull()
      expect(result.current.customFields).toHaveLength(1)
    })
  })
})
