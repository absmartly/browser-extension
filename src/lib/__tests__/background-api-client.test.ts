import { BackgroundAPIClient } from '../background-api-client'

describe('BackgroundAPIClient - Custom Section Fields', () => {
  let client: BackgroundAPIClient

  beforeEach(() => {
    client = new BackgroundAPIClient()

    ;(global as any).chrome = {
      runtime: {
        sendMessage: jest.fn()
      }
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getCustomSectionFields', () => {
    it('should fetch custom section fields successfully', async () => {
      const mockFields = [
        {
          id: 1,
          section_id: 1,
          title: 'Hypothesis',
          help_text: 'What is your hypothesis?',
          placeholder: 'Enter hypothesis',
          default_value: '',
          type: 'text',
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
          default_value: 'Default purpose',
          type: 'string',
          required: false,
          archived: false,
          order_index: 2
        }
      ]

      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        data: mockFields
      })

      const result = await client.getCustomSectionFields()

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'API_OPERATION',
        operation: { op: 'listCustomSectionFields' }
      })

      expect(result).toEqual(mockFields)
      expect(result).toHaveLength(2)
      expect(result[0].title).toBe('Hypothesis')
      expect(result[1].title).toBe('Purpose')
    })

    it('should return empty array when no custom fields exist', async () => {
      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        data: []
      })

      const result = await client.getCustomSectionFields()

      expect(result).toEqual([])
    })

    it('should return empty array when response data is null', async () => {
      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        data: null
      })

      const result = await client.getCustomSectionFields()

      expect(result).toEqual([])
    })

    it('should throw error when API request fails', async () => {
      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Unauthorized'
      })

      await expect(client.getCustomSectionFields()).rejects.toThrow('Unauthorized')
    })

    it('should handle network errors', async () => {
      ;(chrome.runtime.sendMessage as jest.Mock).mockRejectedValue(new Error('Network error'))

      await expect(client.getCustomSectionFields()).rejects.toThrow('Network error')
    })

    it('should handle different field types', async () => {
      const mockFields = [
        { id: 1, type: 'text', title: 'Text Field', default_value: '' },
        { id: 2, type: 'string', title: 'String Field', default_value: '' },
        { id: 3, type: 'json', title: 'JSON Field', default_value: '{}' },
        { id: 4, type: 'boolean', title: 'Boolean Field', default_value: 'false' },
        { id: 5, type: 'number', title: 'Number Field', default_value: '0' }
      ]

      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        data: mockFields
      })

      const result = await client.getCustomSectionFields()

      expect(result).toHaveLength(5)
      expect(result.map(f => f.type)).toEqual(['text', 'string', 'json', 'boolean', 'number'])
    })

    it('should handle required and optional fields', async () => {
      const mockFields = [
        { id: 1, title: 'Required Field', required: true, default_value: '' },
        { id: 2, title: 'Optional Field', required: false, default_value: 'default' }
      ]

      ;(chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        data: mockFields
      })

      const result = await client.getCustomSectionFields()

      expect(result[0].required).toBe(true)
      expect(result[1].required).toBe(false)
    })
  })
})
