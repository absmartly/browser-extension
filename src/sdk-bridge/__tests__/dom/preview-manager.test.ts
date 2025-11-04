/**
 * Preview Manager Unit Tests
 */

import { PreviewManager } from '../../dom/preview-manager'
import type { DOMChange } from '../../types/dom-changes'
import { Logger } from '../../utils/logger'

jest.mock('../../utils/logger')

describe('PreviewManager', () => {
  let previewManager: PreviewManager
  let testElement: HTMLElement

  beforeEach(() => {
    previewManager = new PreviewManager()
    testElement = document.createElement('div')
    testElement.id = 'test-element'
    testElement.textContent = 'Original Content'
    document.body.appendChild(testElement)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('applyPreviewChange', () => {
    it('should return false for invalid change without selector', () => {
      const change: any = {
        type: 'text',
        value: 'Test'
      }

      const result = previewManager.applyPreviewChange(change, 'exp-1')

      expect(result).toBe(false)
      expect(Logger.warn).toHaveBeenCalled()
    })

    it('should return false for invalid change without type', () => {
      const change: any = {
        selector: '#test-element'
      }

      const result = previewManager.applyPreviewChange(change, 'exp-1')

      expect(result).toBe(false)
      expect(Logger.warn).toHaveBeenCalled()
    })

    it('should skip disabled changes', () => {
      const change: DOMChange = {
        selector: '#test-element',
        type: 'text',
        value: 'New Text',
        enabled: false
      }

      const result = previewManager.applyPreviewChange(change, 'exp-1')

      expect(result).toBe(false)
      expect(testElement.textContent).toBe('Original Content')
    })

    it('should return false when no elements match selector', () => {
      const change: DOMChange = {
        selector: '#non-existent',
        type: 'text',
        value: 'Test'
      }

      const result = previewManager.applyPreviewChange(change, 'exp-1')

      expect(result).toBe(false)
      expect(Logger.warn).toHaveBeenCalledWith('No elements found for selector:', '#non-existent')
    })

    it('should apply text change', () => {
      const change: DOMChange = {
        selector: '#test-element',
        type: 'text',
        value: 'Modified Text'
      }

      const result = previewManager.applyPreviewChange(change, 'exp-1')

      expect(result).toBe(true)
      expect(testElement.textContent).toBe('Modified Text')
      expect(testElement.getAttribute('data-absmartly-experiment')).toBe('exp-1')
      expect(testElement.getAttribute('data-absmartly-modified')).toBe('true')
    })

    it('should apply HTML change', () => {
      const change: DOMChange = {
        selector: '#test-element',
        type: 'html',
        value: '<span>New HTML</span>'
      }

      const result = previewManager.applyPreviewChange(change, 'exp-1')

      expect(result).toBe(true)
      expect(testElement.innerHTML).toBe('<span>New HTML</span>')
    })

    it('should sanitize HTML during change', () => {
      const change: DOMChange = {
        selector: '#test-element',
        type: 'html',
        value: '<script>alert("xss")</script><p>Safe</p>'
      }

      previewManager.applyPreviewChange(change, 'exp-1')

      expect(testElement.innerHTML).not.toContain('<script>')
      expect(testElement.innerHTML).toContain('<p>Safe</p>')
    })

    it('should apply style change with object', () => {
      const change: DOMChange = {
        selector: '#test-element',
        type: 'style',
        styles: {
          color: 'red',
          fontSize: '20px'
        }
      }

      const result = previewManager.applyPreviewChange(change, 'exp-1')

      expect(result).toBe(true)
      expect(testElement.style.color).toBe('red')
      expect(testElement.style.fontSize).toBe('20px')
    })

    it('should apply style change with string', () => {
      const change: DOMChange = {
        selector: '#test-element',
        type: 'style',
        value: 'background: blue; padding: 10px;'
      }

      const result = previewManager.applyPreviewChange(change, 'exp-1')

      expect(result).toBe(true)
      expect(testElement.getAttribute('style')).toContain('background')
      expect(testElement.getAttribute('style')).toContain('padding')
    })

    it('should apply class change', () => {
      const change: DOMChange = {
        selector: '#test-element',
        type: 'class',
        className: 'new-class'
      }

      const result = previewManager.applyPreviewChange(change, 'exp-1')

      expect(result).toBe(true)
      expect(testElement.classList.contains('new-class')).toBe(true)
    })

    it('should apply attribute changes with object format', () => {
      const change: DOMChange = {
        selector: '#test-element',
        type: 'attribute',
        value: {
          'data-value': '123',
          'data-test': 'foo',
          'aria-label': 'Test Element'
        }
      }

      const result = previewManager.applyPreviewChange(change, 'exp-1')

      expect(result).toBe(true)
      expect(testElement.getAttribute('data-value')).toBe('123')
      expect(testElement.getAttribute('data-test')).toBe('foo')
      expect(testElement.getAttribute('aria-label')).toBe('Test Element')
    })

    it('should remove attributes when value is null', () => {
      testElement.setAttribute('data-remove-me', 'value')
      testElement.setAttribute('data-keep-me', 'value')

      const change: DOMChange = {
        selector: '#test-element',
        type: 'attribute',
        value: {
          'data-remove-me': null,
          'data-keep-me': 'updated'
        }
      }

      const result = previewManager.applyPreviewChange(change, 'exp-1')

      expect(result).toBe(true)
      expect(testElement.hasAttribute('data-remove-me')).toBe(false)
      expect(testElement.getAttribute('data-keep-me')).toBe('updated')
    })

    it('should handle multiple attribute changes on same element', () => {
      const linkElement = document.createElement('a')
      linkElement.id = 'test-link'
      linkElement.href = 'https://old.com'
      document.body.appendChild(linkElement)

      const change: DOMChange = {
        selector: '#test-link',
        type: 'attribute',
        value: {
          'href': 'https://new.com',
          'target': '_blank',
          'rel': 'noopener noreferrer'
        }
      }

      const result = previewManager.applyPreviewChange(change, 'exp-1')

      expect(result).toBe(true)
      expect(linkElement.getAttribute('href')).toBe('https://new.com')
      expect(linkElement.getAttribute('target')).toBe('_blank')
      expect(linkElement.getAttribute('rel')).toBe('noopener noreferrer')
    })

    it('should apply delete change by hiding', () => {
      const change: DOMChange = {
        selector: '#test-element',
        type: 'delete'
      }

      const result = previewManager.applyPreviewChange(change, 'exp-1')

      expect(result).toBe(true)
      expect(testElement.style.display).toBe('none')
    })

    it('should execute javascript code', () => {
      const change: DOMChange = {
        selector: '#test-element',
        type: 'javascript',
        value: "element.textContent = 'Modified by JS'"
      }

      const result = previewManager.applyPreviewChange(change, 'exp-1')

      expect(result).toBe(true)
      expect(testElement.textContent).toBe('Modified by JS')
    })

    it('should have access to element in javascript execution', () => {
      const change: DOMChange = {
        selector: '#test-element',
        type: 'javascript',
        value: "element.setAttribute('data-js-executed', 'true')"
      }

      const result = previewManager.applyPreviewChange(change, 'exp-1')

      expect(result).toBe(true)
      expect(testElement.getAttribute('data-js-executed')).toBe('true')
    })

    it('should have access to document in javascript execution', () => {
      const change: DOMChange = {
        selector: '#test-element',
        type: 'javascript',
        value: `
          const newDiv = document.createElement('div');
          newDiv.id = 'js-created-element';
          document.body.appendChild(newDiv);
        `
      }

      const result = previewManager.applyPreviewChange(change, 'exp-1')

      expect(result).toBe(true)
      expect(document.getElementById('js-created-element')).toBeDefined()
    })

    it('should pass experimentName to javascript execution', () => {
      const change: DOMChange = {
        selector: '#test-element',
        type: 'javascript',
        value: `
          if (experimentName === 'my-test-exp') {
            element.setAttribute('data-correct-exp', 'true');
          }
        `
      }

      const result = previewManager.applyPreviewChange(change, 'my-test-exp')

      expect(result).toBe(true)
      expect(testElement.getAttribute('data-correct-exp')).toBe('true')
    })

    it('should return false for javascript with missing value', () => {
      const change: any = {
        selector: '#test-element',
        type: 'javascript'
      }

      const result = previewManager.applyPreviewChange(change, 'exp-1')

      expect(result).toBe(false)
      expect(Logger.warn).toHaveBeenCalledWith('Invalid javascript change, missing or invalid value')
    })

    it('should return false for javascript with non-string value', () => {
      const change: any = {
        selector: '#test-element',
        type: 'javascript',
        value: 12345
      }

      const result = previewManager.applyPreviewChange(change, 'exp-1')

      expect(result).toBe(false)
      expect(Logger.warn).toHaveBeenCalledWith('Invalid javascript change, missing or invalid value')
    })

    it('should handle javascript execution errors gracefully', () => {
      const change: DOMChange = {
        selector: '#test-element',
        type: 'javascript',
        value: 'throw new Error("intentional error")'
      }

      const result = previewManager.applyPreviewChange(change, 'exp-1')

      expect(result).toBe(true)
      expect(Logger.warn).toHaveBeenCalledWith('Failed to execute JavaScript for:', '#test-element')
    })

    it('should store original state before applying change', () => {
      testElement.style.color = 'blue'
      testElement.classList.add('original-class')

      const change: DOMChange = {
        selector: '#test-element',
        type: 'text',
        value: 'New Text'
      }

      previewManager.applyPreviewChange(change, 'exp-1')

      // Original state should be captured
      expect(Logger.log).toHaveBeenCalledWith('Stored original state for element:', testElement)
    })

    it('should apply changes to multiple elements', () => {
      const element2 = document.createElement('div')
      element2.className = 'test-class'
      element2.textContent = 'Element 2'
      document.body.appendChild(element2)

      const element3 = document.createElement('div')
      element3.className = 'test-class'
      element3.textContent = 'Element 3'
      document.body.appendChild(element3)

      const change: DOMChange = {
        selector: '.test-class',
        type: 'text',
        value: 'Modified'
      }

      const result = previewManager.applyPreviewChange(change, 'exp-1')

      expect(result).toBe(true)
      expect(element2.textContent).toBe('Modified')
      expect(element3.textContent).toBe('Modified')
    })

    it('should not reapply changes to already tracked elements', () => {
      const change1: DOMChange = {
        selector: '#test-element',
        type: 'text',
        value: 'First Change'
      }

      const change2: DOMChange = {
        selector: '#test-element',
        type: 'text',
        value: 'Second Change'
      }

      ;(Logger.log as jest.Mock).mockClear()

      previewManager.applyPreviewChange(change1, 'exp-1')

      // Count "Stored original state" calls after first change
      const storedStateCalls1 = (Logger.log as jest.Mock).mock.calls
        .filter(call => call[0] === 'Stored original state for element:')

      expect(storedStateCalls1.length).toBe(1)

      previewManager.applyPreviewChange(change2, 'exp-1')

      // Should not have additional "Stored original state" calls
      const storedStateCalls2 = (Logger.log as jest.Mock).mock.calls
        .filter(call => call[0] === 'Stored original state for element:')

      expect(storedStateCalls2.length).toBe(1) // Still only one
    })
  })

  describe('removePreviewChanges', () => {
    beforeEach(() => {
      // Reset testElement to ensure clean state
      testElement.innerHTML = 'Original Content'

      // Apply some preview changes first
      const change: DOMChange = {
        selector: '#test-element',
        type: 'text',
        value: 'Modified'
      }
      previewManager.applyPreviewChange(change, 'exp-1')
    })

    it('should restore element to original state', () => {
      const originalText = 'Original Content'

      expect(testElement.textContent).toBe('Modified')

      const result = previewManager.removePreviewChanges('exp-1')

      expect(result).toBe(true)
      expect(testElement.textContent).toBe(originalText)
    })

    it('should remove tracking attributes', () => {
      expect(testElement.hasAttribute('data-absmartly-experiment')).toBe(true)
      expect(testElement.hasAttribute('data-absmartly-modified')).toBe(true)

      previewManager.removePreviewChanges('exp-1')

      expect(testElement.hasAttribute('data-absmartly-experiment')).toBe(false)
      expect(testElement.hasAttribute('data-absmartly-modified')).toBe(false)
    })

    it('should not affect elements from other experiments', () => {
      const element2 = document.createElement('div')
      element2.id = 'element-2'
      element2.textContent = 'Element 2'
      document.body.appendChild(element2)

      const change2: DOMChange = {
        selector: '#element-2',
        type: 'text',
        value: 'Modified 2'
      }
      previewManager.applyPreviewChange(change2, 'exp-2')

      previewManager.removePreviewChanges('exp-1')

      expect(element2.textContent).toBe('Modified 2')
      expect(element2.hasAttribute('data-absmartly-experiment')).toBe(true)
    })

    it('should return false when no elements were restored', () => {
      const result = previewManager.removePreviewChanges('non-existent-experiment')

      expect(result).toBe(false)
    })

    it('should restore elements with __preview__ marker', () => {
      testElement.setAttribute('data-absmartly-experiment', '__preview__')

      const result = previewManager.removePreviewChanges('exp-1')

      expect(result).toBe(true)
      expect(testElement.hasAttribute('data-absmartly-experiment')).toBe(false)
    })

    it('should restore elements from data-absmartly-original attribute', () => {
      // Create a separate element not in the preview state map
      const veElement = document.createElement('div')
      veElement.id = 've-element'
      document.body.appendChild(veElement)

      const originalData = {
        innerHTML: '<span>Original HTML</span>',
        styles: {
          color: 'blue',
          'font-size': '16px'
        },
        attributes: {
          'data-test': 'value'
        }
      }

      veElement.setAttribute('data-absmartly-original', JSON.stringify(originalData))
      veElement.setAttribute('data-absmartly-experiment', 'exp-1')
      veElement.textContent = 'Modified'

      previewManager.removePreviewChanges('exp-1')

      expect(veElement.innerHTML).toBe('<span>Original HTML</span>')
      expect(veElement.style.color).toBe('blue')
      expect(veElement.style.fontSize).toBe('16px')
      expect(veElement.getAttribute('data-test')).toBe('value')
      expect(veElement.hasAttribute('data-absmartly-original')).toBe(false)
    })

    it('should handle invalid JSON in data-absmartly-original gracefully', () => {
      testElement.setAttribute('data-absmartly-original', 'invalid json')
      testElement.setAttribute('data-absmartly-experiment', 'exp-1')

      expect(() => {
        previewManager.removePreviewChanges('exp-1')
      }).not.toThrow()

      expect(Logger.warn).toHaveBeenCalled()
    })

    it('should restore complete element state', () => {
      // Create a fresh element for this test to avoid beforeEach interference
      const stateElement = document.createElement('div')
      stateElement.id = 'state-test-element'
      document.body.appendChild(stateElement)

      // Set initial state
      stateElement.innerHTML = '<span>Original</span>'
      stateElement.style.color = 'red'
      stateElement.style.fontSize = '20px'
      stateElement.classList.add('original-class')
      stateElement.setAttribute('data-original', 'value')

      // Apply change which should capture the original state
      const change: DOMChange = {
        selector: '#state-test-element',
        type: 'style',
        styles: {
          color: 'blue',
          fontSize: '30px'
        }
      }

      previewManager.applyPreviewChange(change, 'exp-1')

      expect(stateElement.style.color).toBe('blue')

      previewManager.removePreviewChanges('exp-1')

      // After restoration via ElementStateManager
      // innerHTML should be restored
      expect(stateElement.innerHTML).toBe('<span>Original</span>')
      // Styles captured and restored with their original values
      expect(stateElement.style.color).toBe('red')
      expect(stateElement.style.fontSize).toBe('20px')
      // Classes and attributes should also be restored
      expect(stateElement.classList.contains('original-class')).toBe(true)
      expect(stateElement.getAttribute('data-original')).toBe('value')
    })
  })

  describe('clearAll', () => {
    it('should remove all preview changes', () => {
      const element2 = document.createElement('div')
      element2.id = 'element-2'
      document.body.appendChild(element2)

      const change1: DOMChange = {
        selector: '#test-element',
        type: 'text',
        value: 'Modified 1'
      }
      const change2: DOMChange = {
        selector: '#element-2',
        type: 'text',
        value: 'Modified 2'
      }

      previewManager.applyPreviewChange(change1, 'exp-1')
      previewManager.applyPreviewChange(change2, 'exp-2')

      expect(testElement.hasAttribute('data-absmartly-modified')).toBe(true)
      expect(element2.hasAttribute('data-absmartly-modified')).toBe(true)

      previewManager.clearAll()

      expect(testElement.hasAttribute('data-absmartly-modified')).toBe(false)
      expect(element2.hasAttribute('data-absmartly-modified')).toBe(false)
    })
  })

  describe('getPreviewCount', () => {
    it('should return 0 initially', () => {
      expect(previewManager.getPreviewCount()).toBe(0)
    })

    it('should return correct count after applying changes', () => {
      const element2 = document.createElement('div')
      element2.id = 'element-2'
      document.body.appendChild(element2)

      const change1: DOMChange = {
        selector: '#test-element',
        type: 'text',
        value: 'Modified 1'
      }
      const change2: DOMChange = {
        selector: '#element-2',
        type: 'text',
        value: 'Modified 2'
      }

      previewManager.applyPreviewChange(change1, 'exp-1')
      expect(previewManager.getPreviewCount()).toBe(1)

      previewManager.applyPreviewChange(change2, 'exp-2')
      expect(previewManager.getPreviewCount()).toBe(2)
    })

    it('should return correct count after removing changes', () => {
      const change: DOMChange = {
        selector: '#test-element',
        type: 'text',
        value: 'Modified'
      }

      previewManager.applyPreviewChange(change, 'exp-1')
      expect(previewManager.getPreviewCount()).toBe(1)

      previewManager.removePreviewChanges('exp-1')
      expect(previewManager.getPreviewCount()).toBe(0)
    })
  })

  describe('integration scenarios', () => {
    it('should handle complete preview lifecycle', () => {
      // Set up original state
      testElement.textContent = 'Original'
      testElement.style.color = 'blue'
      testElement.classList.add('original-class')

      // Apply preview change
      const change: DOMChange = {
        selector: '#test-element',
        type: 'text',
        value: 'Preview'
      }
      previewManager.applyPreviewChange(change, 'exp-1')

      // Verify preview applied
      expect(testElement.textContent).toBe('Preview')
      expect(testElement.hasAttribute('data-absmartly-modified')).toBe(true)

      // Remove preview
      previewManager.removePreviewChanges('exp-1')

      // Verify restoration
      expect(testElement.textContent).toBe('Original')
      expect(testElement.style.color).toBe('blue')
      expect(testElement.classList.contains('original-class')).toBe(true)
      expect(testElement.hasAttribute('data-absmartly-modified')).toBe(false)
    })

    it('should handle multiple changes to same element', () => {
      const change1: DOMChange = {
        selector: '#test-element',
        type: 'text',
        value: 'First'
      }
      const change2: DOMChange = {
        selector: '#test-element',
        type: 'style',
        styles: { color: 'red' }
      }

      previewManager.applyPreviewChange(change1, 'exp-1')
      previewManager.applyPreviewChange(change2, 'exp-1')

      expect(testElement.textContent).toBe('First')
      expect(testElement.style.color).toBe('red')

      previewManager.removePreviewChanges('exp-1')

      expect(testElement.textContent).toBe('Original Content')
    })

    it('should handle overlapping experiments', () => {
      const change1: DOMChange = {
        selector: '#test-element',
        type: 'text',
        value: 'Exp 1'
      }
      const change2: DOMChange = {
        selector: '#test-element',
        type: 'text',
        value: 'Exp 2'
      }

      previewManager.applyPreviewChange(change1, 'exp-1')
      previewManager.applyPreviewChange(change2, 'exp-2')

      // Second experiment should override and replace the state
      expect(testElement.textContent).toBe('Exp 2')
      expect(testElement.getAttribute('data-absmartly-experiment')).toBe('exp-2')

      // Remove second experiment
      previewManager.removePreviewChanges('exp-2')

      // Should restore to the state when exp-2 captured it (which was after exp-1)
      // So it should be 'Exp 1' not 'Original Content'
      expect(testElement.textContent).toBe('Exp 1')
    })
  })
})
