import { ElementPicker } from '../element-picker'

describe('ElementPicker', () => {
  let picker: ElementPicker
  let mockCallback: jest.Mock
  let elementFromPointMock: jest.Mock

  beforeEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild)
    }
    picker = new ElementPicker()
    mockCallback = jest.fn()

    elementFromPointMock = jest.fn()
    document.elementFromPoint = elementFromPointMock

    global.chrome = {
      ...global.chrome,
      runtime: {
        ...global.chrome?.runtime,
        sendMessage: jest.fn(),
        onMessage: {
          addListener: jest.fn(),
          removeListener: jest.fn(),
        },
      },
    } as any
  })

  afterEach(() => {
    if (picker) {
      picker.stop()
    }
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild)
    }
    jest.clearAllMocks()
  })

  describe('start', () => {
    it('should initialize and create overlay and notification', () => {
      picker.start(mockCallback)

      const overlay = document.querySelector('div[style*="z-index: 999999"]')
      const notification = document.querySelector('div[style*="z-index: 1000000"]')

      expect(overlay).toBeInTheDocument()
      expect(notification).toBeInTheDocument()
      expect(notification?.textContent).toContain('Click an element on the page')
    })

    it('should not reinitialize if already active', () => {
      picker.start(mockCallback)
      const firstOverlay = document.querySelector('div[style*="z-index: 999999"]')

      picker.start(mockCallback)
      const allOverlays = document.querySelectorAll('div[style*="z-index: 999999"]')

      expect(allOverlays.length).toBe(1)
      expect(allOverlays[0]).toBe(firstOverlay)
    })

    it('should add event listeners for mousemove, click, and keydown', () => {
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener')

      picker.start(mockCallback)

      expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function), true)
      expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function), true)
      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function), true)
      expect(addEventListenerSpy).toHaveBeenCalledWith('contextmenu', expect.any(Function), true)
    })

    it('should register chrome runtime message listener', () => {
      picker.start(mockCallback)

      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled()
    })
  })

  describe('stop', () => {
    it('should remove overlay and notification', () => {
      picker.start(mockCallback)
      const overlay = document.querySelector('div[style*="z-index: 999999"]')
      const notification = document.querySelector('div[style*="z-index: 1000000"]')

      expect(overlay).toBeInTheDocument()
      expect(notification).toBeInTheDocument()

      picker.stop()

      expect(document.querySelector('div[style*="z-index: 999999"]')).not.toBeInTheDocument()
      expect(document.querySelector('div[style*="z-index: 1000000"]')).not.toBeInTheDocument()
    })

    it('should remove all event listeners', () => {
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener')

      picker.start(mockCallback)
      picker.stop()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function), true)
      expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function), true)
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function), true)
      expect(removeEventListenerSpy).toHaveBeenCalledWith('contextmenu', expect.any(Function), true)
    })

    it('should remove chrome runtime message listener', () => {
      picker.start(mockCallback)
      picker.stop()

      expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalled()
    })

    it('should clean up highlight overlays', () => {
      picker.start(mockCallback)

      const testButton = document.createElement('button')
      testButton.id = 'test-button'
      document.body.appendChild(testButton)

      elementFromPointMock.mockReturnValue(testButton)

      const rect = testButton.getBoundingClientRect()
      document.dispatchEvent(new MouseEvent('mousemove', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true,
      }))

      picker.stop()

      expect(document.querySelector('.absmartly-element-highlight')).not.toBeInTheDocument()
    })
  })

  describe('element highlighting', () => {
    it('should highlight element on hover', () => {
      picker.start(mockCallback)

      const testButton = document.createElement('button')
      testButton.id = 'test-button'
      testButton.textContent = 'Click Me'
      document.body.appendChild(testButton)

      elementFromPointMock.mockReturnValue(testButton)

      const rect = testButton.getBoundingClientRect()
      document.dispatchEvent(new MouseEvent('mousemove', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true,
      }))

      const highlight = document.querySelector('.absmartly-element-highlight')
      expect(highlight).toBeInTheDocument()
      expect(highlight).toHaveStyle({
        position: 'fixed',
        border: '2px solid #4299e1',
      })
    })

    it('should show selector in tooltip', () => {
      picker.start(mockCallback)

      const testButton = document.createElement('button')
      testButton.id = 'test-button'
      document.body.appendChild(testButton)

      elementFromPointMock.mockReturnValue(testButton)

      const rect = testButton.getBoundingClientRect()
      document.dispatchEvent(new MouseEvent('mousemove', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true,
      }))

      const highlight = document.querySelector('.absmartly-element-highlight')
      expect(highlight?.textContent).toBeTruthy()
      expect(highlight?.textContent).toContain('button')
    })

    it('should update highlight when moving to different element', () => {
      picker.start(mockCallback)

      const button1 = document.createElement('button')
      button1.id = 'button-1'
      document.body.appendChild(button1)

      const button2 = document.createElement('button')
      button2.id = 'button-2'
      document.body.appendChild(button2)

      elementFromPointMock.mockReturnValueOnce(button1)

      const rect1 = button1.getBoundingClientRect()
      document.dispatchEvent(new MouseEvent('mousemove', {
        clientX: rect1.left + rect1.width / 2,
        clientY: rect1.top + rect1.height / 2,
        bubbles: true,
      }))

      const firstHighlight = document.querySelector('.absmartly-element-highlight')
      expect(firstHighlight).toBeInTheDocument()

      elementFromPointMock.mockReturnValueOnce(button2)

      const rect2 = button2.getBoundingClientRect()
      document.dispatchEvent(new MouseEvent('mousemove', {
        clientX: rect2.left + rect2.width / 2,
        clientY: rect2.top + rect2.height / 2,
        bubbles: true,
      }))

      const highlights = document.querySelectorAll('.absmartly-element-highlight')
      expect(highlights.length).toBe(1)
    })

    it('should remove previous highlight when element changes', () => {
      picker.start(mockCallback)

      const button1 = document.createElement('button')
      button1.id = 'button-1'
      document.body.appendChild(button1)

      const button2 = document.createElement('button')
      button2.id = 'button-2'
      document.body.appendChild(button2)

      elementFromPointMock.mockReturnValueOnce(button1)

      const rect1 = button1.getBoundingClientRect()
      document.dispatchEvent(new MouseEvent('mousemove', {
        clientX: rect1.left + rect1.width / 2,
        clientY: rect1.top + rect1.height / 2,
        bubbles: true,
      }))

      elementFromPointMock.mockReturnValueOnce(button2)

      const rect2 = button2.getBoundingClientRect()
      document.dispatchEvent(new MouseEvent('mousemove', {
        clientX: rect2.left + rect2.width / 2,
        clientY: rect2.top + rect2.height / 2,
        bubbles: true,
      }))

      const allHighlights = document.querySelectorAll('.absmartly-element-highlight')
      expect(allHighlights.length).toBe(1)
    })
  })

  describe('element selection', () => {
    it('should select element on click and call callback', () => {
      picker.start(mockCallback)

      const testButton = document.createElement('button')
      testButton.id = 'test-button'
      document.body.appendChild(testButton)

      elementFromPointMock.mockReturnValue(testButton)

      const rect = testButton.getBoundingClientRect()
      document.dispatchEvent(new MouseEvent('click', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true,
      }))

      expect(mockCallback).toHaveBeenCalledWith(expect.stringContaining('button'))
    })

    it('should send ELEMENT_SELECTED message to runtime', () => {
      picker.start(mockCallback)

      const testButton = document.createElement('button')
      testButton.id = 'test-button'
      document.body.appendChild(testButton)

      elementFromPointMock.mockReturnValue(testButton)

      const rect = testButton.getBoundingClientRect()
      document.dispatchEvent(new MouseEvent('click', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true,
      }))

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'ELEMENT_SELECTED',
        selector: expect.any(String),
      })
    })

    it('should stop picker after element selection', () => {
      picker.start(mockCallback)

      const testButton = document.createElement('button')
      testButton.id = 'test-button'
      document.body.appendChild(testButton)

      elementFromPointMock.mockReturnValue(testButton)

      const rect = testButton.getBoundingClientRect()
      document.dispatchEvent(new MouseEvent('click', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true,
      }))

      expect(document.querySelector('div[style*="z-index: 999999"]')).not.toBeInTheDocument()
      expect(document.querySelector('div[style*="z-index: 1000000"]')).not.toBeInTheDocument()
    })

    it('should prevent default click behavior', () => {
      picker.start(mockCallback)

      const testLink = document.createElement('a')
      testLink.id = 'test-link'
      testLink.href = 'https://example.com'
      document.body.appendChild(testLink)

      elementFromPointMock.mockReturnValue(testLink)

      const rect = testLink.getBoundingClientRect()
      const clickEvent = new MouseEvent('click', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true,
        cancelable: true,
      })

      const preventDefaultSpy = jest.spyOn(clickEvent, 'preventDefault')
      document.dispatchEvent(clickEvent)

      expect(preventDefaultSpy).toHaveBeenCalled()
    })
  })

  describe('keyboard controls', () => {
    it('should cancel on Escape key', () => {
      picker.start(mockCallback)

      const overlay = document.querySelector('div[style*="z-index: 999999"]')
      expect(overlay).toBeInTheDocument()

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

      expect(document.querySelector('div[style*="z-index: 999999"]')).not.toBeInTheDocument()
    })

    it('should not call callback when cancelled via Escape', () => {
      picker.start(mockCallback)

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

      expect(mockCallback).not.toHaveBeenCalled()
    })

    it('should ignore other key presses', () => {
      picker.start(mockCallback)

      const overlay = document.querySelector('div[style*="z-index: 999999"]')
      expect(overlay).toBeInTheDocument()

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Space', bubbles: true }))
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))

      expect(document.querySelector('div[style*="z-index: 999999"]')).toBeInTheDocument()
    })
  })

  describe('message handling', () => {
    it('should handle CANCEL_ELEMENT_PICKER message', () => {
      picker.start(mockCallback)

      const overlay = document.querySelector('div[style*="z-index: 999999"]')
      expect(overlay).toBeInTheDocument()

      const messageListener = (chrome.runtime.onMessage.addListener as jest.Mock).mock.calls[0][0]
      messageListener({ type: 'CANCEL_ELEMENT_PICKER' })

      expect(document.querySelector('div[style*="z-index: 999999"]')).not.toBeInTheDocument()
    })

    it('should ignore other message types', () => {
      picker.start(mockCallback)

      const overlay = document.querySelector('div[style*="z-index: 999999"]')
      expect(overlay).toBeInTheDocument()

      const messageListener = (chrome.runtime.onMessage.addListener as jest.Mock).mock.calls[0][0]
      messageListener({ type: 'SOME_OTHER_MESSAGE' })

      expect(document.querySelector('div[style*="z-index: 999999"]')).toBeInTheDocument()
    })
  })

  describe('selector generation', () => {
    it('should generate unique selector for element with ID', () => {
      picker.start(mockCallback)

      const testButton = document.createElement('button')
      testButton.id = 'unique-button'
      document.body.appendChild(testButton)

      elementFromPointMock.mockReturnValue(testButton)

      const rect = testButton.getBoundingClientRect()
      document.dispatchEvent(new MouseEvent('click', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true,
      }))

      expect(mockCallback).toHaveBeenCalledWith(expect.stringMatching(/unique-button/))
    })

    it('should generate selector for nested elements', () => {
      picker.start(mockCallback)

      const container = document.createElement('div')
      container.id = 'container'
      const section = document.createElement('section')
      section.id = 'section'
      const button = document.createElement('button')
      button.id = 'nested-button'

      container.appendChild(section)
      section.appendChild(button)
      document.body.appendChild(container)

      elementFromPointMock.mockReturnValue(button)

      const rect = button.getBoundingClientRect()
      document.dispatchEvent(new MouseEvent('click', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true,
      }))

      const selector = mockCallback.mock.calls[0][0]
      expect(selector).toBeTruthy()

      const matchedElements = document.querySelectorAll(selector)
      expect(matchedElements.length).toBe(1)
      expect(matchedElements[0]).toBe(button)
    })

    it('should generate unique selector for elements without ID', () => {
      picker.start(mockCallback)

      const button1 = document.createElement('button')
      button1.className = 'btn'
      button1.textContent = 'First'
      document.body.appendChild(button1)

      const button2 = document.createElement('button')
      button2.className = 'btn'
      button2.textContent = 'Second'
      document.body.appendChild(button2)

      elementFromPointMock.mockReturnValue(button2)

      const rect2 = button2.getBoundingClientRect()
      document.dispatchEvent(new MouseEvent('click', {
        clientX: rect2.left + rect2.width / 2,
        clientY: rect2.top + rect2.height / 2,
        bubbles: true,
      }))

      const selector = mockCallback.mock.calls[0][0]
      const matchedElements = document.querySelectorAll(selector)
      expect(matchedElements.length).toBe(1)
      expect(matchedElements[0]).toBe(button2)
    })

    it('should handle elements with nth-of-type', () => {
      picker.start(mockCallback)

      const div1 = document.createElement('div')
      div1.className = 'box'
      document.body.appendChild(div1)

      const div2 = document.createElement('div')
      div2.className = 'box'
      document.body.appendChild(div2)

      const div3 = document.createElement('div')
      div3.className = 'box'
      document.body.appendChild(div3)

      elementFromPointMock.mockReturnValue(div2)

      const rect2 = div2.getBoundingClientRect()
      document.dispatchEvent(new MouseEvent('click', {
        clientX: rect2.left + rect2.width / 2,
        clientY: rect2.top + rect2.height / 2,
        bubbles: true,
      }))

      const selector = mockCallback.mock.calls[0][0]
      expect(selector).toBeTruthy()
      expect(typeof selector).toBe('string')
      expect(selector).toMatch(/div/)
      expect(mockCallback).toHaveBeenCalled()
    })

    it('should handle elements with data attributes', () => {
      picker.start(mockCallback)

      const button = document.createElement('button')
      button.setAttribute('data-testid', 'submit-button')
      button.setAttribute('data-action', 'submit')
      document.body.appendChild(button)

      elementFromPointMock.mockReturnValue(button)

      const rect = button.getBoundingClientRect()
      document.dispatchEvent(new MouseEvent('click', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true,
      }))

      const selector = mockCallback.mock.calls[0][0]
      expect(selector).toBeTruthy()

      const matchedElements = document.querySelectorAll(selector)
      expect(matchedElements.length).toBe(1)
      expect(matchedElements[0]).toBe(button)
    })
  })

  describe('context menu prevention', () => {
    it('should prevent context menu when active', () => {
      picker.start(mockCallback)

      const contextMenuEvent = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
      })

      const preventDefaultSpy = jest.spyOn(contextMenuEvent, 'preventDefault')
      document.dispatchEvent(contextMenuEvent)

      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('should not prevent context menu when inactive', () => {
      picker.start(mockCallback)
      picker.stop()

      const contextMenuEvent = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
      })

      const preventDefaultSpy = jest.spyOn(contextMenuEvent, 'preventDefault')
      document.dispatchEvent(contextMenuEvent)

      expect(preventDefaultSpy).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle clicking on body element', () => {
      picker.start(mockCallback)

      elementFromPointMock.mockReturnValue(document.body)

      document.dispatchEvent(new MouseEvent('click', {
        clientX: 10,
        clientY: 10,
        bubbles: true,
      }))

      expect(mockCallback).toHaveBeenCalled()
      expect(chrome.runtime.sendMessage).toHaveBeenCalled()
    })

    it('should handle multiple start/stop cycles', () => {
      picker.start(mockCallback)
      picker.stop()
      picker.start(mockCallback)
      picker.stop()
      picker.start(mockCallback)

      expect(document.querySelector('div[style*="z-index: 999999"]')).toBeInTheDocument()
    })

    it('should clean up animation styles on stop', () => {
      picker.start(mockCallback)

      const animationStyle = document.querySelector('style[data-absmartly-animation]')
      expect(animationStyle).toBeInTheDocument()

      picker.stop()

      expect(document.querySelector('style[data-absmartly-animation]')).not.toBeInTheDocument()
    })

    it('should not crash when clicking on removed elements', () => {
      picker.start(mockCallback)

      const button = document.createElement('button')
      button.id = 'temp-button'
      document.body.appendChild(button)

      button.remove()

      elementFromPointMock.mockReturnValue(null)

      expect(() => {
        document.dispatchEvent(new MouseEvent('click', {
          clientX: 10,
          clientY: 10,
          bubbles: true,
        }))
      }).not.toThrow()
    })

    it('should handle elements at viewport edges', () => {
      picker.start(mockCallback)

      const button = document.createElement('button')
      button.id = 'edge-button'
      button.style.position = 'fixed'
      button.style.top = '0'
      button.style.left = '0'
      document.body.appendChild(button)

      elementFromPointMock.mockReturnValue(button)

      document.dispatchEvent(new MouseEvent('click', {
        clientX: 5,
        clientY: 5,
        bubbles: true,
      }))

      expect(mockCallback).toHaveBeenCalled()
    })
  })

  describe('selector validation', () => {
    it('should generate selector that actually selects the target element', () => {
      picker.start(mockCallback)

      const targetDiv = document.createElement('div')
      targetDiv.className = 'target-element'
      targetDiv.setAttribute('data-component', 'test')
      document.body.appendChild(targetDiv)

      elementFromPointMock.mockReturnValue(targetDiv)

      const rect = targetDiv.getBoundingClientRect()
      document.dispatchEvent(new MouseEvent('click', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true,
      }))

      const generatedSelector = mockCallback.mock.calls[0][0]

      const matchedElement = document.querySelector(generatedSelector)
      expect(matchedElement).toBe(targetDiv)
    })

    it('should generate selector that matches only one element', () => {
      picker.start(mockCallback)

      const div1 = document.createElement('div')
      div1.className = 'item'
      div1.id = 'item-1'
      document.body.appendChild(div1)

      const div2 = document.createElement('div')
      div2.className = 'item'
      div2.id = 'item-2'
      document.body.appendChild(div2)

      elementFromPointMock.mockReturnValue(div1)

      const rect1 = div1.getBoundingClientRect()
      document.dispatchEvent(new MouseEvent('click', {
        clientX: rect1.left + rect1.width / 2,
        clientY: rect1.top + rect1.height / 2,
        bubbles: true,
      }))

      const generatedSelector = mockCallback.mock.calls[0][0]

      const matchedElements = document.querySelectorAll(generatedSelector)
      expect(matchedElements.length).toBe(1)
      expect(matchedElements[0]).toBe(div1)
    })
  })
})
