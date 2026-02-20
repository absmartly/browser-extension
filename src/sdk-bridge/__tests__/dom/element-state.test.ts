/**
 * Element State Unit Tests
 */

import { ElementStateManager, type ElementState } from '../../dom/element-state'
import { Logger } from '../../utils/logger'

jest.mock('../../utils/logger')

describe('ElementStateManager', () => {
  describe('captureElementState', () => {
    it('should capture text content', () => {
      const element = document.createElement('div')
      element.textContent = 'Hello World'

      const state = ElementStateManager.captureElementState(element)

      expect(state.textContent).toBe('Hello World')
    })

    it('should capture innerHTML', () => {
      const element = document.createElement('div')
      element.innerHTML = '<span>Test</span>'

      const state = ElementStateManager.captureElementState(element)

      expect(state.innerHTML).toBe('<span>Test</span>')
    })

    it('should capture all attributes', () => {
      const element = document.createElement('div')
      element.setAttribute('id', 'test-id')
      element.setAttribute('data-value', '123')
      element.setAttribute('aria-label', 'Test')

      const state = ElementStateManager.captureElementState(element)

      expect(state.attributes).toEqual({
        id: 'test-id',
        'data-value': '123',
        'aria-label': 'Test'
      })
    })

    it('should capture inline styles', () => {
      const element = document.createElement('div')
      element.style.color = 'red'
      element.style.fontSize = '16px'
      element.style.display = 'block'

      const state = ElementStateManager.captureElementState(element)

      expect(state.styles.color).toBe('red')
      expect(state.styles['font-size']).toBe('16px')
      expect(state.styles.display).toBe('block')
    })

    it('should capture class list', () => {
      const element = document.createElement('div')
      element.classList.add('class-one', 'class-two', 'class-three')

      const state = ElementStateManager.captureElementState(element)

      expect(state.classList).toEqual(['class-one', 'class-two', 'class-three'])
    })

    it('should handle empty text content', () => {
      const element = document.createElement('div')

      const state = ElementStateManager.captureElementState(element)

      expect(state.textContent).toBe('')
    })

    it('should handle elements with no attributes', () => {
      const element = document.createElement('div')

      const state = ElementStateManager.captureElementState(element)

      expect(state.attributes).toEqual({})
    })

    it('should handle elements with no inline styles', () => {
      const element = document.createElement('div')

      const state = ElementStateManager.captureElementState(element)

      expect(state.styles).toEqual({})
    })

    it('should handle elements with no classes', () => {
      const element = document.createElement('div')

      const state = ElementStateManager.captureElementState(element)

      expect(state.classList).toEqual([])
    })

    it('should capture complete element state', () => {
      const element = document.createElement('div')
      element.textContent = 'Complete Test'
      element.innerHTML = '<span>Complete Test</span>'
      element.setAttribute('id', 'complete')
      element.setAttribute('data-test', 'true')
      element.style.color = 'blue'
      element.style.margin = '10px'
      element.classList.add('test-class', 'active')

      const state = ElementStateManager.captureElementState(element)

      expect(state).toMatchObject({
        textContent: 'Complete Test',
        innerHTML: '<span>Complete Test</span>',
        attributes: {
          id: 'complete',
          'data-test': 'true'
        },
        classList: ['test-class', 'active']
      })
      expect(state.styles.color).toBe('blue')
      expect(state.styles.margin).toBe('10px')
    })
  })

  describe('restoreElementState', () => {
    it('should restore text content via innerHTML', () => {
      const element = document.createElement('div')
      element.textContent = 'Current'

      const originalState: ElementState = {
        textContent: 'Original',
        innerHTML: 'Original',
        attributes: {},
        styles: {},
        classList: []
      }

      ElementStateManager.restoreElementState(element, originalState)

      expect(element.textContent).toBe('Original')
    })

    it('should restore innerHTML with sanitization', () => {
      const element = document.createElement('div')
      element.innerHTML = '<p>Current</p>'

      const originalState: ElementState = {
        textContent: '',
        innerHTML: '<span>Original</span>',
        attributes: {},
        styles: {},
        classList: []
      }

      ElementStateManager.restoreElementState(element, originalState)

      expect(element.innerHTML).toBe('<span>Original</span>')
    })

    it('should sanitize dangerous HTML during restoration', () => {
      const element = document.createElement('div')

      const originalState: ElementState = {
        textContent: '',
        innerHTML: '<script>alert("xss")</script><p>Safe</p>',
        attributes: {},
        styles: {},
        classList: []
      }

      ElementStateManager.restoreElementState(element, originalState)

      // Script should be removed by sanitizer
      expect(element.innerHTML).not.toContain('<script>')
      expect(element.innerHTML).toContain('<p>Safe</p>')
    })

    it('should restore attributes', () => {
      const element = document.createElement('div')
      element.setAttribute('id', 'current')
      element.setAttribute('data-value', 'old')

      const originalState: ElementState = {
        textContent: '',
        innerHTML: '',
        attributes: {
          id: 'original',
          'data-value': 'restored',
          'aria-label': 'New Attribute'
        },
        styles: {},
        classList: []
      }

      ElementStateManager.restoreElementState(element, originalState)

      expect(element.getAttribute('id')).toBe('original')
      expect(element.getAttribute('data-value')).toBe('restored')
      expect(element.getAttribute('aria-label')).toBe('New Attribute')
    })

    it('should remove attributes not in original state', () => {
      const element = document.createElement('div')
      element.setAttribute('id', 'test')
      element.setAttribute('data-extra', 'remove-me')
      element.setAttribute('class', 'remove-me')

      const originalState: ElementState = {
        textContent: '',
        innerHTML: '',
        attributes: {
          id: 'test'
        },
        styles: {},
        classList: []
      }

      ElementStateManager.restoreElementState(element, originalState)

      expect(element.getAttribute('id')).toBe('test')
      expect(element.hasAttribute('data-extra')).toBe(false)
    })

    it('should restore inline styles', () => {
      const element = document.createElement('div')
      element.style.color = 'blue'

      const originalState: ElementState = {
        textContent: '',
        innerHTML: '',
        attributes: {},
        styles: {
          color: 'red',
          'font-size': '20px',
          display: 'flex'
        },
        classList: []
      }

      ElementStateManager.restoreElementState(element, originalState)

      expect(element.style.color).toBe('red')
      expect(element.style.fontSize).toBe('20px')
      expect(element.style.display).toBe('flex')
    })

    it('should clear all inline styles before restoring', () => {
      const element = document.createElement('div')
      element.style.color = 'blue'
      element.style.margin = '10px'
      element.style.padding = '5px'

      const originalState: ElementState = {
        textContent: '',
        innerHTML: '',
        attributes: {},
        styles: {
          color: 'red'
        },
        classList: []
      }

      ElementStateManager.restoreElementState(element, originalState)

      expect(element.style.color).toBe('red')
      expect(element.style.margin).toBe('')
      expect(element.style.padding).toBe('')
    })

    it('should restore class list', () => {
      const element = document.createElement('div')
      element.classList.add('current-class')

      const originalState: ElementState = {
        textContent: '',
        innerHTML: '',
        attributes: {},
        styles: {},
        classList: ['original-class', 'another-class']
      }

      ElementStateManager.restoreElementState(element, originalState)

      expect(element.className).toBe('original-class another-class')
      expect(element.classList.contains('current-class')).toBe(false)
    })

    it('should remove tracking attributes', () => {
      const element = document.createElement('div')
      element.setAttribute('data-absmartly-experiment', 'exp-123')
      element.setAttribute('data-absmartly-modified', 'true')
      element.setAttribute('data-other', 'keep-me')

      const originalState: ElementState = {
        textContent: '',
        innerHTML: '',
        attributes: {
          'data-other': 'keep-me'
        },
        styles: {},
        classList: []
      }

      ElementStateManager.restoreElementState(element, originalState)

      expect(element.hasAttribute('data-absmartly-experiment')).toBe(false)
      expect(element.hasAttribute('data-absmartly-modified')).toBe(false)
      expect(element.getAttribute('data-other')).toBe('keep-me')
    })

    it('should log restoration', () => {
      const element = document.createElement('div')
      const originalState: ElementState = {
        textContent: 'Test',
        innerHTML: '',
        attributes: {},
        styles: {},
        classList: []
      }

      ElementStateManager.restoreElementState(element, originalState)

      expect(Logger.log).toHaveBeenCalledWith(
        'Restored element to original state:',
        element
      )
    })

    it('should handle restoration errors gracefully', () => {
      const element = document.createElement('div')
      const originalState: ElementState = {
        textContent: '',
        innerHTML: '',
        attributes: {
          'test-attr': 'value'
        },
        styles: {},
        classList: []
      }

      // Mock an error during attribute restoration
      const setAttributeSpy = jest.spyOn(element, 'setAttribute').mockImplementation(() => {
        throw new Error('Mock error')
      })

      ElementStateManager.restoreElementState(element, originalState)

      expect(Logger.error).toHaveBeenCalledWith('Error restoring element:', expect.any(Error))

      setAttributeSpy.mockRestore()
    })

    it('should restore complete element state', () => {
      const element = document.createElement('div')
      element.textContent = 'Current'
      element.setAttribute('id', 'current')
      element.style.color = 'blue'
      element.classList.add('current-class')
      element.setAttribute('data-absmartly-experiment', 'exp-1')

      const originalState: ElementState = {
        textContent: 'Original',
        innerHTML: '<span>Original</span>',
        attributes: {
          id: 'original',
          'data-value': '123'
        },
        styles: {
          color: 'red',
          'font-size': '16px'
        },
        classList: ['original-class', 'active']
      }

      ElementStateManager.restoreElementState(element, originalState)

      expect(element.textContent).toBe('Original')
      expect(element.getAttribute('id')).toBe('original')
      expect(element.getAttribute('data-value')).toBe('123')
      expect(element.style.color).toBe('red')
      expect(element.style.fontSize).toBe('16px')
      expect(element.className).toBe('original-class active')
      expect(element.hasAttribute('data-absmartly-experiment')).toBe(false)
    })

    it('should handle empty original state', () => {
      const element = document.createElement('div')
      element.textContent = 'Current'
      element.setAttribute('id', 'test')
      element.style.color = 'blue'
      element.classList.add('test-class')

      const originalState: ElementState = {
        textContent: '',
        innerHTML: '',
        attributes: {},
        styles: {},
        classList: []
      }

      ElementStateManager.restoreElementState(element, originalState)

      expect(element.textContent).toBe('')
      expect(element.hasAttribute('id')).toBe(false)
      expect(element.style.color).toBe('')
      expect(element.className).toBe('')
    })
  })

  describe('capture and restore cycle', () => {
    it('should fully restore element after capture', () => {
      const element = document.createElement('div')
      element.innerHTML = '<p>Original HTML</p>'
      element.setAttribute('id', 'original-id')
      element.setAttribute('data-test', 'original')
      element.style.color = 'red'
      element.style.fontSize = '18px'
      element.classList.add('original-class', 'test')

      // Capture original state
      const capturedState = ElementStateManager.captureElementState(element)
      const originalTextContent = element.textContent

      // Modify element
      element.innerHTML = '<span>Modified</span>'
      element.setAttribute('id', 'modified-id')
      element.setAttribute('data-test', 'modified')
      element.setAttribute('data-new', 'extra')
      element.style.color = 'blue'
      element.style.fontSize = '20px'
      element.style.margin = '10px'
      element.classList.remove('original-class')
      element.classList.add('modified-class')

      // Restore to captured state
      ElementStateManager.restoreElementState(element, capturedState)

      // Verify restoration
      expect(element.textContent).toBe(originalTextContent)
      expect(element.getAttribute('id')).toBe('original-id')
      expect(element.getAttribute('data-test')).toBe('original')
      expect(element.hasAttribute('data-new')).toBe(false)
      expect(element.style.color).toBe('red')
      expect(element.style.fontSize).toBe('18px')
      expect(element.style.margin).toBe('')
      expect(element.className).toBe('original-class test')
    })

    it('should handle multiple capture/restore cycles', () => {
      const element = document.createElement('div')
      element.textContent = 'State 1'

      const state1 = ElementStateManager.captureElementState(element)

      element.textContent = 'State 2'
      const state2 = ElementStateManager.captureElementState(element)

      element.textContent = 'State 3'
      const state3 = ElementStateManager.captureElementState(element)

      // Restore to state 2
      ElementStateManager.restoreElementState(element, state2)
      expect(element.textContent).toBe('State 2')

      // Restore to state 1
      ElementStateManager.restoreElementState(element, state1)
      expect(element.textContent).toBe('State 1')

      // Restore to state 3
      ElementStateManager.restoreElementState(element, state3)
      expect(element.textContent).toBe('State 3')
    })
  })
})
