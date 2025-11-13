import { applyDOMChangeAction } from '../dom-change-operations'
import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'

describe('DOM Change Operations', () => {
  const createMockTextChange = (selector: string, value: string = 'test'): DOMChange => ({
    selector,
    type: 'text',
    value,
    enabled: true
  })

  const createMockHtmlChange = (selector: string, value: string = '<div>test</div>'): DOMChange => ({
    selector,
    type: 'html',
    value,
    enabled: true
  })

  const createMockStyleChange = (selector: string, value: Record<string, string> = { color: 'red' }): DOMChange => ({
    selector,
    type: 'style',
    value,
    enabled: true
  })

  const createMockRemoveChange = (selector: string): DOMChange => ({
    selector,
    type: 'remove',
    enabled: true
  })

  const createMockChange = createMockTextChange

  describe('append action', () => {
    it('should append new changes to empty array', () => {
      const currentChanges: DOMChange[] = []
      const newChanges = [
        createMockChange('.button', 'text'),
        createMockChange('.title', 'text')
      ]
      const result: AIDOMGenerationResult = {
        domChanges: newChanges,
        response: 'Added changes',
        action: 'append'
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(updated).toHaveLength(2)
      expect(updated).toEqual(newChanges)
    })

    it('should append new changes to existing array', () => {
      const currentChanges = [
        createMockTextChange('.existing')
      ]
      const newChanges = [
        createMockHtmlChange('.new1'),
        createMockStyleChange('.new2')
      ]
      const result: AIDOMGenerationResult = {
        domChanges: newChanges,
        response: 'Added more changes',
        action: 'append'
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(updated).toHaveLength(3)
      expect(updated[0]).toEqual(currentChanges[0])
      expect(updated[1]).toEqual(newChanges[0])
      expect(updated[2]).toEqual(newChanges[1])
    })

    it('should append empty array without error', () => {
      const currentChanges = [createMockChange('.existing', 'text')]
      const result: AIDOMGenerationResult = {
        domChanges: [],
        response: 'No changes',
        action: 'append'
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(updated).toHaveLength(1)
      expect(updated).toEqual(currentChanges)
    })

    it('should preserve original array immutability', () => {
      const currentChanges = [createMockChange('.original', 'text')]
      const originalLength = currentChanges.length
      const result: AIDOMGenerationResult = {
        domChanges: [createMockChange('.new', 'text')],
        response: 'Added',
        action: 'append'
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(currentChanges).toHaveLength(originalLength)
      expect(updated).toHaveLength(2)
      expect(updated).not.toBe(currentChanges)
    })
  })

  describe('replace_all action', () => {
    it('should replace all changes with new changes', () => {
      const currentChanges = [
        createMockTextChange('.old1'),
        createMockHtmlChange('.old2')
      ]
      const newChanges = [
        createMockStyleChange('.new')
      ]
      const result: AIDOMGenerationResult = {
        domChanges: newChanges,
        response: 'Replaced all',
        action: 'replace_all'
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(updated).toHaveLength(1)
      expect(updated).toEqual(newChanges)
      expect(updated).not.toContain(currentChanges[0])
      expect(updated).not.toContain(currentChanges[1])
    })

    it('should replace with empty array', () => {
      const currentChanges = [
        createMockChange('.old', 'text')
      ]
      const result: AIDOMGenerationResult = {
        domChanges: [],
        response: 'Cleared all',
        action: 'replace_all'
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(updated).toHaveLength(0)
      expect(updated).toEqual([])
    })

    it('should work when current changes is empty', () => {
      const currentChanges: DOMChange[] = []
      const newChanges = [createMockChange('.new', 'text')]
      const result: AIDOMGenerationResult = {
        domChanges: newChanges,
        response: 'New changes',
        action: 'replace_all'
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(updated).toHaveLength(1)
      expect(updated).toEqual(newChanges)
    })
  })

  describe('replace_specific action', () => {
    it('should replace changes matching target selectors', () => {
      const currentChanges = [
        createMockChange('.keep1', 'text'),
        createMockChange('.replace1', 'html'),
        createMockChange('.keep2', 'style'),
        createMockChange('.replace2', 'text')
      ]
      const newChanges = [
        createMockChange('.new1', 'text'),
        createMockChange('.new2', 'html')
      ]
      const result: AIDOMGenerationResult = {
        domChanges: newChanges,
        response: 'Replaced specific',
        action: 'replace_specific',
        targetSelectors: ['.replace1', '.replace2']
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(updated).toHaveLength(4)
      expect(updated.filter(c => c.selector === '.keep1')).toHaveLength(1)
      expect(updated.filter(c => c.selector === '.keep2')).toHaveLength(1)
      expect(updated.filter(c => c.selector === '.new1')).toHaveLength(1)
      expect(updated.filter(c => c.selector === '.new2')).toHaveLength(1)
      expect(updated.filter(c => c.selector === '.replace1')).toHaveLength(0)
      expect(updated.filter(c => c.selector === '.replace2')).toHaveLength(0)
    })

    it('should handle single target selector', () => {
      const currentChanges = [
        createMockChange('.keep', 'text'),
        createMockChange('.replace', 'html')
      ]
      const newChanges = [createMockChange('.new', 'style')]
      const result: AIDOMGenerationResult = {
        domChanges: newChanges,
        response: 'Replaced one',
        action: 'replace_specific',
        targetSelectors: ['.replace']
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(updated).toHaveLength(2)
      expect(updated.some(c => c.selector === '.keep')).toBe(true)
      expect(updated.some(c => c.selector === '.new')).toBe(true)
      expect(updated.some(c => c.selector === '.replace')).toBe(false)
    })

    it('should keep all changes when target selector not found', () => {
      const currentChanges = [
        createMockChange('.existing1', 'text'),
        createMockChange('.existing2', 'html')
      ]
      const newChanges = [createMockChange('.new', 'style')]
      const result: AIDOMGenerationResult = {
        domChanges: newChanges,
        response: 'Target not found',
        action: 'replace_specific',
        targetSelectors: ['.nonexistent']
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(updated).toHaveLength(3)
      expect(updated).toContainEqual(currentChanges[0])
      expect(updated).toContainEqual(currentChanges[1])
      expect(updated).toContainEqual(newChanges[0])
    })

    it('should throw error when targetSelectors is undefined', () => {
      const currentChanges = [createMockChange('.test', 'text')]
      const result: AIDOMGenerationResult = {
        domChanges: [createMockChange('.new', 'text')],
        response: 'Missing selectors',
        action: 'replace_specific'
      }

      expect(() => applyDOMChangeAction(currentChanges, result)).toThrow(
        'replace_specific action requires targetSelectors array'
      )
    })

    it('should throw error when targetSelectors is empty array', () => {
      const currentChanges = [createMockChange('.test', 'text')]
      const result: AIDOMGenerationResult = {
        domChanges: [createMockChange('.new', 'text')],
        response: 'Empty selectors',
        action: 'replace_specific',
        targetSelectors: []
      }

      expect(() => applyDOMChangeAction(currentChanges, result)).toThrow(
        'replace_specific action requires targetSelectors array'
      )
    })

    it('should handle multiple changes with same selector in new changes', () => {
      const currentChanges = [
        createMockChange('.old', 'text')
      ]
      const newChanges = [
        createMockChange('.new', 'text'),
        createMockChange('.new', 'style')
      ]
      const result: AIDOMGenerationResult = {
        domChanges: newChanges,
        response: 'Multiple with same selector',
        action: 'replace_specific',
        targetSelectors: ['.old']
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(updated).toHaveLength(2)
      expect(updated.filter(c => c.selector === '.new')).toHaveLength(2)
    })
  })

  describe('remove_specific action', () => {
    it('should remove changes matching target selectors', () => {
      const currentChanges = [
        createMockChange('.keep1', 'text'),
        createMockChange('.remove1', 'html'),
        createMockChange('.keep2', 'style'),
        createMockChange('.remove2', 'text')
      ]
      const result: AIDOMGenerationResult = {
        domChanges: [],
        response: 'Removed specific',
        action: 'remove_specific',
        targetSelectors: ['.remove1', '.remove2']
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(updated).toHaveLength(2)
      expect(updated.filter(c => c.selector === '.keep1')).toHaveLength(1)
      expect(updated.filter(c => c.selector === '.keep2')).toHaveLength(1)
      expect(updated.filter(c => c.selector === '.remove1')).toHaveLength(0)
      expect(updated.filter(c => c.selector === '.remove2')).toHaveLength(0)
    })

    it('should handle single target selector', () => {
      const currentChanges = [
        createMockChange('.keep', 'text'),
        createMockChange('.remove', 'html')
      ]
      const result: AIDOMGenerationResult = {
        domChanges: [],
        response: 'Removed one',
        action: 'remove_specific',
        targetSelectors: ['.remove']
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(updated).toHaveLength(1)
      expect(updated[0].selector).toBe('.keep')
    })

    it('should keep all changes when target selector not found', () => {
      const currentChanges = [
        createMockChange('.existing1', 'text'),
        createMockChange('.existing2', 'html')
      ]
      const result: AIDOMGenerationResult = {
        domChanges: [],
        response: 'Target not found',
        action: 'remove_specific',
        targetSelectors: ['.nonexistent']
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(updated).toHaveLength(2)
      expect(updated).toEqual(currentChanges)
    })

    it('should throw error when targetSelectors is undefined', () => {
      const currentChanges = [createMockChange('.test', 'text')]
      const result: AIDOMGenerationResult = {
        domChanges: [],
        response: 'Missing selectors',
        action: 'remove_specific'
      }

      expect(() => applyDOMChangeAction(currentChanges, result)).toThrow(
        'remove_specific action requires targetSelectors array'
      )
    })

    it('should throw error when targetSelectors is empty array', () => {
      const currentChanges = [createMockChange('.test', 'text')]
      const result: AIDOMGenerationResult = {
        domChanges: [],
        response: 'Empty selectors',
        action: 'remove_specific',
        targetSelectors: []
      }

      expect(() => applyDOMChangeAction(currentChanges, result)).toThrow(
        'remove_specific action requires targetSelectors array'
      )
    })

    it('should remove all matching when multiple have same selector', () => {
      const currentChanges = [
        createMockChange('.remove', 'text'),
        createMockChange('.keep', 'html'),
        createMockChange('.remove', 'style')
      ]
      const result: AIDOMGenerationResult = {
        domChanges: [],
        response: 'Remove duplicates',
        action: 'remove_specific',
        targetSelectors: ['.remove']
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(updated).toHaveLength(1)
      expect(updated[0].selector).toBe('.keep')
    })

    it('should return empty array when removing all changes', () => {
      const currentChanges = [
        createMockChange('.remove1', 'text'),
        createMockChange('.remove2', 'html')
      ]
      const result: AIDOMGenerationResult = {
        domChanges: [],
        response: 'Remove all',
        action: 'remove_specific',
        targetSelectors: ['.remove1', '.remove2']
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(updated).toHaveLength(0)
      expect(updated).toEqual([])
    })
  })

  describe('none action', () => {
    it('should return current changes unchanged', () => {
      const currentChanges = [
        createMockChange('.existing1', 'text'),
        createMockChange('.existing2', 'html')
      ]
      const result: AIDOMGenerationResult = {
        domChanges: [createMockChange('.ignored', 'style')],
        response: 'No changes',
        action: 'none'
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(updated).toEqual(currentChanges)
      expect(updated).toBe(currentChanges)
    })

    it('should return empty array unchanged', () => {
      const currentChanges: DOMChange[] = []
      const result: AIDOMGenerationResult = {
        domChanges: [createMockChange('.ignored', 'text')],
        response: 'No changes',
        action: 'none'
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(updated).toEqual([])
      expect(updated).toBe(currentChanges)
    })

    it('should ignore new domChanges in result', () => {
      const currentChanges = [createMockChange('.current', 'text')]
      const newChanges = [
        createMockChange('.new1', 'html'),
        createMockChange('.new2', 'style')
      ]
      const result: AIDOMGenerationResult = {
        domChanges: newChanges,
        response: 'These are ignored',
        action: 'none'
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(updated).toHaveLength(1)
      expect(updated).toEqual(currentChanges)
      expect(updated).not.toContainEqual(newChanges[0])
      expect(updated).not.toContainEqual(newChanges[1])
    })
  })

  describe('edge cases', () => {
    it('should handle complex DOM changes with all properties', () => {
      const complexChange: DOMChange = {
        selector: '.complex',
        type: 'style',
        enabled: true,
        value: { color: 'red', fontSize: '16px' }
      }
      const currentChanges = [complexChange]
      const result: AIDOMGenerationResult = {
        domChanges: [],
        response: 'Keep complex',
        action: 'none'
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(updated).toEqual([complexChange])
    })

    it('should preserve disabled changes', () => {
      const disabledChange: DOMChange = {
        selector: '.disabled',
        type: 'text',
        value: 'disabled text',
        enabled: false
      }
      const currentChanges = [disabledChange]
      const result: AIDOMGenerationResult = {
        domChanges: [createMockChange('.new')],
        response: 'Append',
        action: 'append'
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(updated[0]).toEqual(disabledChange)
      expect(updated[0].enabled).toBe(false)
    })

    it('should handle special characters in selectors', () => {
      const currentChanges = [
        createMockTextChange('[data-test="value"]'),
        createMockHtmlChange('#id\\:with\\:colons')
      ]
      const result: AIDOMGenerationResult = {
        domChanges: [],
        response: 'Special chars',
        action: 'remove_specific',
        targetSelectors: ['[data-test="value"]']
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(updated).toHaveLength(1)
      expect(updated[0].selector).toBe('#id\\:with\\:colons')
    })

    it('should handle very long selector strings', () => {
      const longSelector = '.a'.repeat(1000)
      const currentChanges = [createMockTextChange(longSelector)]
      const result: AIDOMGenerationResult = {
        domChanges: [],
        response: 'Long selector',
        action: 'none'
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(updated[0].selector).toBe(longSelector)
    })

    it('should handle empty strings in selectors', () => {
      const currentChanges = [createMockTextChange('')]
      const result: AIDOMGenerationResult = {
        domChanges: [createMockHtmlChange('')],
        response: 'Empty selector',
        action: 'append'
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(updated).toHaveLength(2)
      expect(updated.every(c => c.selector === '')).toBe(true)
    })
  })

  describe('type safety and exhaustiveness', () => {
    it('should throw for unknown action type', () => {
      const currentChanges = [createMockChange('.test', 'text')]
      const result = {
        domChanges: [],
        response: 'Unknown',
        action: 'invalid_action'
      } as any

      expect(() => applyDOMChangeAction(currentChanges, result)).toThrow(
        'Unknown action type: invalid_action'
      )
    })

    it('should handle action type with different casing', () => {
      const currentChanges = [createMockChange('.test', 'text')]
      const result = {
        domChanges: [],
        response: 'Uppercase',
        action: 'NONE'
      } as any

      expect(() => applyDOMChangeAction(currentChanges, result)).toThrow(
        'Unknown action type: NONE'
      )
    })
  })

  describe('immutability guarantees', () => {
    it('should not mutate currentChanges array for append', () => {
      const currentChanges = [createMockChange('.original', 'text')]
      const originalRef = currentChanges[0]
      const result: AIDOMGenerationResult = {
        domChanges: [createMockChange('.new', 'html')],
        response: 'Test',
        action: 'append'
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(currentChanges).toHaveLength(1)
      expect(currentChanges[0]).toBe(originalRef)
      expect(updated).not.toBe(currentChanges)
    })

    it('should not mutate currentChanges array for replace_specific', () => {
      const currentChanges = [
        createMockChange('.keep', 'text'),
        createMockChange('.remove', 'html')
      ]
      const originalLength = currentChanges.length
      const result: AIDOMGenerationResult = {
        domChanges: [createMockChange('.new', 'style')],
        response: 'Test',
        action: 'replace_specific',
        targetSelectors: ['.remove']
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(currentChanges).toHaveLength(originalLength)
      expect(updated).not.toBe(currentChanges)
    })

    it('should not mutate currentChanges array for remove_specific', () => {
      const currentChanges = [
        createMockChange('.keep', 'text'),
        createMockChange('.remove', 'html')
      ]
      const originalLength = currentChanges.length
      const result: AIDOMGenerationResult = {
        domChanges: [],
        response: 'Test',
        action: 'remove_specific',
        targetSelectors: ['.remove']
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(currentChanges).toHaveLength(originalLength)
      expect(updated).not.toBe(currentChanges)
    })

    it('should return same reference for none action', () => {
      const currentChanges = [createMockChange('.test', 'text')]
      const result: AIDOMGenerationResult = {
        domChanges: [createMockChange('.ignored', 'html')],
        response: 'Test',
        action: 'none'
      }

      const updated = applyDOMChangeAction(currentChanges, result)

      expect(updated).toBe(currentChanges)
    })
  })
})
