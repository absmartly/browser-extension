import { renderHook, act } from '@testing-library/react'
import { useExperimentSave } from '../useExperimentSave'
import { BackgroundAPIClient } from '~src/lib/background-api-client'
import type { Experiment } from '~src/types/absmartly'

jest.mock('~src/lib/background-api-client')
jest.mock('~src/utils/storage', () => ({
  getConfig: jest.fn().mockResolvedValue({
    domChangesFieldName: '__dom_changes'
  })
}))
jest.mock('~src/utils/debug', () => ({
  debugLog: jest.fn(),
  debugError: jest.fn()
}))

describe('useExperimentSave - Custom Fields', () => {
  let mockGetCustomSectionFields: jest.Mock

  beforeEach(() => {
    mockGetCustomSectionFields = jest.fn()
    ;(BackgroundAPIClient as jest.Mock).mockImplementation(() => ({
      getCustomSectionFields: mockGetCustomSectionFields
    }))

    ;(global as any).chrome = {
      runtime: {
        sendMessage: jest.fn()
      }
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Creating new experiment with custom fields', () => {
    it('should fetch and include custom fields when creating experiment', async () => {
      const mockCustomFields = [
        {
          id: 1,
          section_id: 1,
          title: 'Hypothesis',
          help_text: 'What is your hypothesis?',
          placeholder: 'Enter hypothesis',
          default_value: 'Default hypothesis',
          type: 'text' as const,
          required: true,
          archived: false,
          order_index: 1
        },
        {
          id: 2,
          section_id: 1,
          title: 'Purpose',
          help_text: 'What is the purpose?',
          placeholder: 'Enter purpose',
          default_value: '',
          type: 'string' as const,
          required: false,
          archived: false,
          order_index: 2
        }
      ]

      mockGetCustomSectionFields.mockResolvedValue(mockCustomFields)

      const mockOnSave = jest.fn().mockResolvedValue(undefined)
      const formData = {
        name: 'test-experiment',
        display_name: 'Test Experiment',
        percentage_of_traffic: 100,
        unit_type_id: 1,
        application_ids: [1],
        owner_ids: [1],
        team_ids: [],
        tag_ids: []
      }
      const variants = [
        { name: 'Control', config: { __dom_changes: [] } },
        { name: 'Variant A', config: { __dom_changes: [] } }
      ]

      const { result } = renderHook(() =>
        useExperimentSave({ experiment: null, domFieldName: '__dom_changes' })
      )

      await act(async () => {
        await result.current.save(formData, variants, undefined, mockOnSave)
      })

      expect(mockGetCustomSectionFields).toHaveBeenCalled()
      expect(mockOnSave).toHaveBeenCalled()

      const experimentData = mockOnSave.mock.calls[0][0]
      expect(experimentData.custom_section_field_values).toBeDefined()
      expect(experimentData.custom_section_field_values['1']).toEqual({
        value: 'Default hypothesis',
        type: 'text',
        id: 1
      })
      expect(experimentData.custom_section_field_values['2']).toEqual({
        value: '',
        type: 'string',
        id: 2
      })
    })

    it('should handle empty custom fields array', async () => {
      mockGetCustomSectionFields.mockResolvedValue([])

      const mockOnSave = jest.fn().mockResolvedValue(undefined)
      const formData = {
        name: 'test-experiment',
        unit_type_id: 1,
        application_ids: [1],
        owner_ids: [1],
        team_ids: [],
        tag_ids: []
      }
      const variants = [
        { name: 'Control', config: {} }
      ]

      const { result } = renderHook(() =>
        useExperimentSave({ experiment: null, domFieldName: '__dom_changes' })
      )

      await act(async () => {
        await result.current.save(formData, variants, undefined, mockOnSave)
      })

      const experimentData = mockOnSave.mock.calls[0][0]
      expect(experimentData.custom_section_field_values).toEqual({})
    })

    it('should handle custom fields fetch error gracefully', async () => {
      mockGetCustomSectionFields.mockRejectedValue(new Error('API Error'))

      const mockOnSave = jest.fn().mockResolvedValue(undefined)
      const formData = {
        name: 'test-experiment',
        unit_type_id: 1,
        application_ids: [1],
        owner_ids: [1],
        team_ids: [],
        tag_ids: []
      }
      const variants = [{ name: 'Control', config: {} }]

      const { result } = renderHook(() =>
        useExperimentSave({ experiment: null, domFieldName: '__dom_changes' })
      )

      await act(async () => {
        await result.current.save(formData, variants, undefined, mockOnSave)
      })

      expect(mockOnSave).toHaveBeenCalled()
      const experimentData = mockOnSave.mock.calls[0][0]
      expect(experimentData.custom_section_field_values).toEqual({})
    })

    it('should use default_value from custom fields', async () => {
      const mockCustomFields = [
        {
          id: 1,
          title: 'Field With Default',
          type: 'text' as const,
          default_value: 'My default value',
          required: true
        },
        {
          id: 2,
          title: 'Field Without Default',
          type: 'string' as const,
          default_value: '',
          required: false
        }
      ]

      mockGetCustomSectionFields.mockResolvedValue(mockCustomFields)

      const mockOnSave = jest.fn().mockResolvedValue(undefined)
      const formData = {
        name: 'test-experiment',
        unit_type_id: 1,
        application_ids: [1],
        owner_ids: [1],
        team_ids: [],
        tag_ids: []
      }
      const variants = [{ name: 'Control', config: {} }]

      const { result } = renderHook(() =>
        useExperimentSave({ experiment: null, domFieldName: '__dom_changes' })
      )

      await act(async () => {
        await result.current.save(formData, variants, undefined, mockOnSave)
      })

      const experimentData = mockOnSave.mock.calls[0][0]
      expect(experimentData.custom_section_field_values['1'].value).toBe('My default value')
      expect(experimentData.custom_section_field_values['2'].value).toBe('')
    })

    it('should handle all custom field types', async () => {
      const mockCustomFields = [
        { id: 1, title: 'Text', type: 'text' as const, default_value: 'text value', required: true },
        { id: 2, title: 'String', type: 'string' as const, default_value: 'string value', required: false },
        { id: 3, title: 'JSON', type: 'json' as const, default_value: '{"key": "value"}', required: false },
        { id: 4, title: 'Boolean', type: 'boolean' as const, default_value: 'true', required: false },
        { id: 5, title: 'Number', type: 'number' as const, default_value: '42', required: false }
      ]

      mockGetCustomSectionFields.mockResolvedValue(mockCustomFields)

      const mockOnSave = jest.fn().mockResolvedValue(undefined)
      const formData = {
        name: 'test-experiment',
        unit_type_id: 1,
        application_ids: [1],
        owner_ids: [1],
        team_ids: [],
        tag_ids: []
      }
      const variants = [{ name: 'Control', config: {} }]

      const { result } = renderHook(() =>
        useExperimentSave({ experiment: null, domFieldName: '__dom_changes' })
      )

      await act(async () => {
        await result.current.save(formData, variants, undefined, mockOnSave)
      })

      const experimentData = mockOnSave.mock.calls[0][0]
      const customFields = experimentData.custom_section_field_values

      expect(customFields['1']).toEqual({ value: 'text value', type: 'text', id: 1 })
      expect(customFields['2']).toEqual({ value: 'string value', type: 'string', id: 2 })
      expect(customFields['3']).toEqual({ value: '{"key": "value"}', type: 'json', id: 3 })
      expect(customFields['4']).toEqual({ value: 'true', type: 'boolean', id: 4 })
      expect(customFields['5']).toEqual({ value: '42', type: 'number', id: 5 })
    })

    it('should include custom fields alongside other experiment data', async () => {
      const mockCustomFields = [
        { id: 1, title: 'Field', type: 'text' as const, default_value: 'value', required: true }
      ]

      mockGetCustomSectionFields.mockResolvedValue(mockCustomFields)

      const mockOnSave = jest.fn().mockResolvedValue(undefined)
      const formData = {
        name: 'test-experiment',
        display_name: 'Test Experiment',
        percentage_of_traffic: 50,
        unit_type_id: 2,
        application_ids: [1, 2],
        owner_ids: [1],
        team_ids: [1],
        tag_ids: [1, 2]
      }
      const variants = [
        { name: 'Control', config: { __dom_changes: [] } },
        { name: 'Variant A', config: { __dom_changes: [{ selector: '.test', action: 'text', value: 'Test' }] } }
      ]

      const { result } = renderHook(() =>
        useExperimentSave({ experiment: null, domFieldName: '__dom_changes' })
      )

      await act(async () => {
        await result.current.save(formData, variants, undefined, mockOnSave)
      })

      const experimentData = mockOnSave.mock.calls[0][0]

      expect(experimentData.name).toBe('test-experiment')
      expect(experimentData.display_name).toBe('Test Experiment')
      expect(experimentData.percentage_of_traffic).toBe(50)
      expect(experimentData.state).toBe('created')
      expect(experimentData.variants).toHaveLength(2)
      expect(experimentData.custom_section_field_values).toBeDefined()
      expect(experimentData.custom_section_field_values['1']).toEqual({
        value: 'value',
        type: 'text',
        id: 1
      })
    })
  })

  describe('Updating existing experiment with custom fields', () => {
    it('should preserve existing custom fields when updating', async () => {
      const existingExperiment: Partial<Experiment> = {
        id: 1,
        name: 'existing-experiment',
        state: 'created',
        custom_section_field_values: [
          {
            id: 1,
            experiment_id: 1,
            experiment_custom_section_field_id: 1,
            type: 'text',
            value: 'Existing hypothesis',
            updated_at: '2024-01-01T00:00:00Z'
          }
        ]
      }

      const mockOnUpdate = jest.fn()
      const formData = {
        display_name: 'Updated Experiment',
        percentage_of_traffic: 75,
        unit_type_id: 1,
        application_ids: [1],
        owner_ids: [1],
        team_ids: [],
        tag_ids: []
      }
      const variants = [{ name: 'Control', config: {} }]

      const mockFullExperiment = {
        ...existingExperiment,
        iteration: 1,
        variants: [],
        percentages: '50/50',
        audience: '{}',
        audience_strict: false,
        updated_at: '2024-01-01T00:00:00Z',
        custom_section_field_values: [
          {
            id: 1,
            experiment_id: 1,
            experiment_custom_section_field_id: 1,
            type: 'text',
            value: 'Existing hypothesis',
            updated_at: '2024-01-01T00:00:00Z',
            custom_section_field: { id: 1 }
          }
        ]
      }

      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        data: { experiment: mockFullExperiment }
      })

      const { result } = renderHook(() =>
        useExperimentSave({
          experiment: existingExperiment as Experiment,
          domFieldName: '__dom_changes'
        })
      )

      await act(async () => {
        await result.current.save(formData, variants, mockOnUpdate, undefined)
      })

      expect(mockOnUpdate).toHaveBeenCalled()
      const updatePayload = mockOnUpdate.mock.calls[0][1]

      expect(updatePayload.data.custom_section_field_values).toBeDefined()
      expect(updatePayload.data.custom_section_field_values['1']).toEqual({
        experiment_id: 1,
        experiment_custom_section_field_id: 1,
        type: 'text',
        value: 'Existing hypothesis',
        updated_at: '2024-01-01T00:00:00Z',
        updated_by_user_id: undefined,
        custom_section_field: { id: 1 },
        id: 1,
        default_value: 'Existing hypothesis'
      })
    })
  })
})
