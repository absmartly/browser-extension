import {
  parseExperiment,
  parseExperiments,
  parseVariantConfig,
  safeParseVariantConfig,
  safeParseExperiments,
  parseExperimentsCache,
  safeParseJSON,
  ExperimentSchema,
  DOMChangeSchema
} from '../validation-schemas'

describe('Validation Schemas', () => {
  describe('ExperimentSchema', () => {
    const validExperiment = {
      id: 123,
      name: 'Test Experiment',
      state: 'running',
      created_at: '2024-01-01T00:00:00Z',
      variants: [
        {
          name: 'Control',
          config: '{}'
        },
        {
          name: 'Variant 1',
          config: '{"test": true}'
        }
      ]
    }

    it('should validate a valid experiment', () => {
      expect(() => parseExperiment(validExperiment)).not.toThrow()
      const result = parseExperiment(validExperiment)
      expect(result.id).toBe(123)
      expect(result.name).toBe('Test Experiment')
    })

    it('should reject experiment with missing required field (id)', () => {
      const invalid = { ...validExperiment }
      delete (invalid as any).id

      expect(() => parseExperiment(invalid)).toThrow('Invalid experiment data')
    })

    it('should reject experiment with missing required field (name)', () => {
      const invalid = { ...validExperiment }
      delete (invalid as any).name

      expect(() => parseExperiment(invalid)).toThrow('Invalid experiment data')
    })

    it('should reject experiment with invalid enum value (state)', () => {
      const invalid = { ...validExperiment, state: 'invalid_state' }

      expect(() => parseExperiment(invalid)).toThrow('Invalid experiment data')
    })

    it('should reject experiment with negative ID', () => {
      const invalid = { ...validExperiment, id: -1 }

      expect(() => parseExperiment(invalid)).toThrow('Invalid experiment data')
    })

    it('should reject experiment with zero ID', () => {
      const invalid = { ...validExperiment, id: 0 }

      expect(() => parseExperiment(invalid)).toThrow('Invalid experiment data')
    })

    it('should reject experiment with empty name', () => {
      const invalid = { ...validExperiment, name: '' }

      expect(() => parseExperiment(invalid)).toThrow('Invalid experiment data')
    })

    it('should reject experiment with name > 255 characters', () => {
      const invalid = { ...validExperiment, name: 'a'.repeat(256) }

      expect(() => parseExperiment(invalid)).toThrow('Invalid experiment data')
    })

    it('should reject experiment with empty variants array', () => {
      const invalid = { ...validExperiment, variants: [] }

      expect(() => parseExperiment(invalid)).toThrow('Invalid experiment data')
    })

    it('should reject experiment with invalid percentage (> 100)', () => {
      const invalid = { ...validExperiment, percentage_of_traffic: 101 }

      expect(() => parseExperiment(invalid)).toThrow('Invalid experiment data')
    })

    it('should reject experiment with negative percentage', () => {
      const invalid = { ...validExperiment, percentage_of_traffic: -1 }

      expect(() => parseExperiment(invalid)).toThrow('Invalid experiment data')
    })

    it('should accept experiment with all valid states', () => {
      const validStates = [
        'created',
        'ready',
        'running',
        'development',
        'full_on',
        'stopped',
        'archived',
        'scheduled'
      ]

      for (const state of validStates) {
        const exp = { ...validExperiment, state }
        expect(() => parseExperiment(exp)).not.toThrow()
      }
    })

    it('should accept experiment with optional fields', () => {
      const withOptional = {
        ...validExperiment,
        display_name: 'Test Display Name',
        status: 'running' as const,
        percentage_of_traffic: 50,
        traffic_split: 50,
        favorite: true
      }

      expect(() => parseExperiment(withOptional)).not.toThrow()
      const result = parseExperiment(withOptional)
      expect(result.display_name).toBe('Test Display Name')
      expect(result.percentage_of_traffic).toBe(50)
    })

    it('should validate nested objects (owner, applications)', () => {
      const withNested = {
        ...validExperiment,
        owner: {
          user_id: 1,
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe'
        },
        applications: [
          {
            name: 'Test App',
            application_id: 1
          }
        ]
      }

      expect(() => parseExperiment(withNested)).not.toThrow()
      const result = parseExperiment(withNested)
      expect(result.owner?.email).toBe('test@example.com')
      expect(result.applications?.[0].name).toBe('Test App')
    })

    it('should reject invalid email in owner', () => {
      const invalid = {
        ...validExperiment,
        owner: {
          user_id: 1,
          email: 'not-an-email'
        }
      }

      expect(() => parseExperiment(invalid)).toThrow('Invalid experiment data')
    })
  })

  describe('parseExperiments', () => {
    const validExperiments = [
      {
        id: 1,
        name: 'Experiment 1',
        state: 'running',
        created_at: '2024-01-01T00:00:00Z',
        variants: [{ name: 'Control', config: '{}' }]
      },
      {
        id: 2,
        name: 'Experiment 2',
        state: 'stopped',
        created_at: '2024-01-02T00:00:00Z',
        variants: [{ name: 'Control', config: '{}' }]
      }
    ]

    it('should validate array of valid experiments', () => {
      expect(() => parseExperiments(validExperiments)).not.toThrow()
      const result = parseExperiments(validExperiments)
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe(1)
      expect(result[1].id).toBe(2)
    })

    it('should reject if any experiment is invalid', () => {
      const invalid = [
        ...validExperiments,
        { id: -1, name: 'Invalid', state: 'running', variants: [] }
      ]

      expect(() => parseExperiments(invalid)).toThrow('Invalid experiments array')
    })

    it('should accept empty array', () => {
      expect(() => parseExperiments([])).not.toThrow()
      const result = parseExperiments([])
      expect(result).toHaveLength(0)
    })
  })

  describe('safeParseExperiments', () => {
    it('should return success for valid experiments', () => {
      const valid = [
        {
          id: 1,
          name: 'Test',
          state: 'running',
          created_at: '2024-01-01T00:00:00Z',
          variants: [{ name: 'Control', config: '{}' }]
        }
      ]

      const result = safeParseExperiments(valid)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
      }
    })

    it('should return error for invalid experiments', () => {
      const invalid = [{ id: -1, name: '', variants: [] }]

      const result = safeParseExperiments(invalid)
      expect(result.success).toBe(false)
      expect((result as any).error).toBeTruthy()
    })
  })

  describe('DOMChangeSchema', () => {
    it('should validate style DOM change', () => {
      const validStyle = {
        selector: '.test-class',
        type: 'style',
        value: {
          color: 'red',
          'font-size': '16px'
        }
      }

      const result = DOMChangeSchema.safeParse(validStyle)
      expect(result.success).toBe(true)
    })

    it('should validate text DOM change', () => {
      const validText = {
        selector: '#test-id',
        type: 'text',
        value: 'New text content'
      }

      const result = DOMChangeSchema.safeParse(validText)
      expect(result.success).toBe(true)
    })

    it('should validate class DOM change', () => {
      const validClass = {
        selector: 'button',
        type: 'class',
        add: ['active', 'highlight'],
        remove: ['disabled']
      }

      const result = DOMChangeSchema.safeParse(validClass)
      expect(result.success).toBe(true)
    })

    it('should validate move DOM change', () => {
      const validMove = {
        selector: '.element',
        type: 'move',
        targetSelector: '.container',
        position: 'firstChild'
      }

      const result = DOMChangeSchema.safeParse(validMove)
      expect(result.success).toBe(true)
    })

    it('should reject DOM change with empty selector', () => {
      const invalid = {
        selector: '',
        type: 'style',
        value: { color: 'red' }
      }

      const result = DOMChangeSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should reject DOM change with invalid type', () => {
      const invalid = {
        selector: '.test',
        type: 'invalid_type',
        value: {}
      }

      const result = DOMChangeSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should reject move without targetSelector', () => {
      const invalid = {
        selector: '.element',
        type: 'move',
        position: 'firstChild'
      }

      const result = DOMChangeSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should validate styleRules with states', () => {
      const validStyleRules = {
        selector: 'button',
        type: 'styleRules',
        states: {
          normal: { color: 'blue' },
          hover: { color: 'darkblue' }
        }
      }

      const result = DOMChangeSchema.safeParse(validStyleRules)
      expect(result.success).toBe(true)
    })
  })

  describe('parseVariantConfig', () => {
    it('should parse valid JSON config', () => {
      const configStr = '{"test": true, "value": 123}'
      expect(() => parseVariantConfig(configStr)).not.toThrow()
      const result = parseVariantConfig(configStr)
      expect(result).toEqual({ test: true, value: 123 })
    })

    it('should validate DOM changes in config', () => {
      const configStr = JSON.stringify({
        __dom_changes: [
          {
            selector: '.test',
            type: 'style',
            value: { color: 'red' }
          }
        ]
      })

      expect(() => parseVariantConfig(configStr)).not.toThrow()
    })

    it('should reject invalid JSON', () => {
      const invalid = '{"test": invalid}'
      expect(() => parseVariantConfig(invalid)).toThrow('Invalid JSON')
    })

    it('should reject invalid DOM changes', () => {
      const configStr = JSON.stringify({
        __dom_changes: [
          {
            selector: '',
            type: 'style',
            value: {}
          }
        ]
      })

      expect(() => parseVariantConfig(configStr)).toThrow('Invalid variant config')
    })
  })

  describe('safeParseVariantConfig', () => {
    it('should return success for valid config', () => {
      const configStr = '{"test": true}'
      const result = safeParseVariantConfig(configStr)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({ test: true })
      }
    })

    it('should return error for invalid JSON', () => {
      const invalid = '{invalid json}'
      const result = safeParseVariantConfig(invalid)

      expect(result.success).toBe(false)
      expect((result as any).error).toContain('Invalid JSON')
    })

    it('should return error for invalid DOM changes', () => {
      const configStr = JSON.stringify({
        __dom_changes: [
          {
            selector: '',
            type: 'invalid'
          }
        ]
      })

      const result = safeParseVariantConfig(configStr)
      expect(result.success).toBe(false)
    })
  })

  describe('parseExperimentsCache', () => {
    it('should validate valid cache', () => {
      const validCache = {
        version: 1,
        experiments: [
          {
            id: 1,
            name: 'Test',
            state: 'running',
            variants: [{ name: 'Control' }]
          }
        ],
        timestamp: 1234567890
      }

      expect(() => parseExperimentsCache(validCache)).not.toThrow()
      const result = parseExperimentsCache(validCache)
      expect(result.experiments).toHaveLength(1)
      expect(result.timestamp).toBe(1234567890)
    })

    it('should reject cache with invalid timestamp', () => {
      const invalid = {
        version: 1,
        experiments: [],
        timestamp: -1
      }

      expect(() => parseExperimentsCache(invalid)).toThrow('Invalid experiments cache')
    })

    it('should reject cache without timestamp', () => {
      const invalid = {
        version: 1,
        experiments: []
      }

      expect(() => parseExperimentsCache(invalid)).toThrow('Invalid experiments cache')
    })
  })

  describe('safeParseJSON', () => {
    it('should parse valid JSON without schema', () => {
      const result = safeParseJSON('{"test": true}')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({ test: true })
      }
    })

    it('should return error for invalid JSON', () => {
      const result = safeParseJSON('{invalid}')

      expect(result.success).toBe(false)
      expect((result as any).error).toContain('Invalid JSON')
    })

    it('should validate with provided schema', () => {
      const schema = ExperimentSchema
      const validExp = {
        id: 1,
        name: 'Test',
        state: 'running',
        created_at: '2024-01-01T00:00:00Z',
        variants: [{ name: 'Control', config: '{}' }]
      }

      const result = safeParseJSON(JSON.stringify(validExp), schema)

      expect(result.success).toBe(true)
    })

    it('should return validation error with schema', () => {
      const schema = ExperimentSchema
      const invalid = { id: -1 }

      const result = safeParseJSON(JSON.stringify(invalid), schema)

      expect(result.success).toBe(false)
      expect((result as any).error).toContain('Validation failed')
    })
  })

  describe('Edge Cases', () => {
    it('should handle non-positive variant numbers', () => {
      const exp = {
        id: 1,
        name: 'Test',
        state: 'running',
        created_at: '2024-01-01T00:00:00Z',
        variants: [
          { variant: 0, name: 'Control', config: '{}' },
          { variant: 1, name: 'Variant 1', config: '{}' }
        ]
      }

      expect(() => parseExperiment(exp)).not.toThrow()
    })

    it('should reject non-integer IDs', () => {
      const invalid = {
        id: 1.5,
        name: 'Test',
        state: 'running',
        created_at: '2024-01-01T00:00:00Z',
        variants: [{ name: 'Control', config: '{}' }]
      }

      expect(() => parseExperiment(invalid)).toThrow('Invalid experiment data')
    })

    it('should handle complex nested structures', () => {
      const complex = {
        id: 1,
        name: 'Complex Test',
        state: 'running',
        created_at: '2024-01-01T00:00:00Z',
        variants: [{ name: 'Control', config: '{}' }],
        custom_section_field_values: [
          {
            id: 1,
            value: { nested: { deep: { value: 'test' } } }
          }
        ]
      }

      expect(() => parseExperiment(complex)).not.toThrow()
    })

    it('should handle empty optional arrays', () => {
      const exp = {
        id: 1,
        name: 'Test',
        state: 'running',
        created_at: '2024-01-01T00:00:00Z',
        variants: [{ name: 'Control', config: '{}' }],
        applications: [],
        owners: [],
        teams: []
      }

      expect(() => parseExperiment(exp)).not.toThrow()
    })
  })
})
