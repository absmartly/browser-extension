/**
 * Integration tests for EditorCoordinator with HTML Editor
 */

import { EditorCoordinator } from '../editor-coordinator'
import StateManager from '../state-manager'
import EventHandlers from '../event-handlers'
import ContextMenu from '../context-menu'
import ChangeTracker from '../change-tracker'
import UIComponents from '../../ui/components'
import EditModes from '../edit-modes'
import Cleanup from '../cleanup'
import { Toolbar } from '../../ui/toolbar'
import { Notifications } from '../../ui/notifications'
import HtmlEditor from '../../ui/html-editor'

describe('EditorCoordinator HTML Editor Integration', () => {
  let coordinator: EditorCoordinator
  let stateManager: StateManager
  let mockCallbacks: any
  let mockHtmlEditor: any

  beforeEach(() => {
    // Setup DOM environment
    document.body.innerHTML = '<div id="test-element">Original HTML</div>'

    // Mock Monaco Editor
    ;(global.window as any).monaco = {
      editor: {
        create: jest.fn().mockReturnValue({
          getValue: jest.fn(),
          setValue: jest.fn(),
          dispose: jest.fn(),
          getAction: jest.fn().mockReturnValue({ run: jest.fn() })
        })
      },
      languages: {
        registerCompletionItemProvider: jest.fn(),
        CompletionItemKind: { Keyword: 1, Property: 2 },
        CompletionItemInsertTextRule: { InsertAsSnippet: 1 }
      }
    }

    // Create StateManager
    stateManager = new StateManager({
      experimentName: 'Test',
      variantName: 'Control',
      initialChanges: [],
      logoUrl: 'https://example.com/logo.png'
    })

    // Mock callbacks
    mockCallbacks = {
      onChangesUpdate: jest.fn(),
      removeStyles: jest.fn(),
      addChange: jest.fn(),
      getSelector: jest.fn().mockReturnValue('.test-element'),
      hideElement: jest.fn(),
      deleteElement: jest.fn(),
      copyElement: jest.fn(),
      copySelectorPath: jest.fn(),
      moveElement: jest.fn(),
      insertNewBlock: jest.fn(),
      showRelativeElementSelector: jest.fn(),
      undoLastChange: jest.fn(),
      redoLastChange: jest.fn(),
      clearAllChanges: jest.fn(),
      saveChanges: jest.fn(),
      stop: jest.fn()
    }

    // Create dependencies
    const eventHandlers = new EventHandlers(stateManager)
    const contextMenu = new ContextMenu(stateManager)
    const changeTracker = new ChangeTracker(stateManager)
    const uiComponents = new UIComponents(stateManager)
    const editModes = new EditModes(stateManager)
    const cleanup = new Cleanup(stateManager)
    const toolbar = new Toolbar(stateManager)
    const notifications = new Notifications()

    // Create coordinator
    coordinator = new EditorCoordinator(
      stateManager,
      eventHandlers,
      contextMenu,
      changeTracker,
      uiComponents,
      editModes,
      cleanup,
      toolbar,
      notifications,
      mockCallbacks
    )

    // Mock the HtmlEditor show method
    mockHtmlEditor = jest.spyOn(HtmlEditor.prototype, 'show')
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
    document.body.innerHTML = ''
  })

  describe('handleEditHtmlAction', () => {
    it('should initialize HTML editor when Edit HTML action is triggered', async () => {
      const element = document.getElementById('test-element')!
      const originalState = {
        innerHTML: element.innerHTML,
        textContent: element.textContent
      }

      mockHtmlEditor.mockResolvedValue('<div>Modified HTML</div>')

      await coordinator.handleEditHtmlAction(element, originalState)

      expect(mockHtmlEditor).toHaveBeenCalledWith(element, 'Original HTML')
    })

    it('should update element HTML when changes are saved', async () => {
      const element = document.getElementById('test-element')!
      const originalState = {
        innerHTML: element.innerHTML,
        textContent: element.textContent
      }

      const newHtml = '<div>New HTML Content</div>'
      mockHtmlEditor.mockResolvedValue(newHtml)

      await coordinator.handleEditHtmlAction(element, originalState)

      expect(element.innerHTML).toBe(newHtml)
    })

    it('should not update element when editor is cancelled', async () => {
      const element = document.getElementById('test-element')!
      const originalHtml = element.innerHTML
      const originalState = {
        innerHTML: originalHtml,
        textContent: element.textContent
      }

      mockHtmlEditor.mockResolvedValue(null)

      await coordinator.handleEditHtmlAction(element, originalState)

      expect(element.innerHTML).toBe(originalHtml)
    })

    it('should track HTML changes in state', async () => {
      const element = document.getElementById('test-element')!
      const originalState = {
        innerHTML: element.innerHTML,
        textContent: element.textContent
      }

      const newHtml = '<p>Tracked HTML Change</p>'
      mockHtmlEditor.mockResolvedValue(newHtml)

      await coordinator.handleEditHtmlAction(element, originalState)

      expect(mockCallbacks.addChange).toHaveBeenCalledWith({
        selector: '.test-element',
        type: 'html',
        value: newHtml,
        originalHtml: originalState.innerHTML,
        enabled: true
      })
    })

    it('should show success notification after HTML update', async () => {
      const element = document.getElementById('test-element')!
      const originalState = {
        innerHTML: element.innerHTML,
        textContent: element.textContent
      }

      const notificationSpy = jest.spyOn(Notifications.prototype, 'show')
      mockHtmlEditor.mockResolvedValue('<div>Updated</div>')

      await coordinator.handleEditHtmlAction(element, originalState)

      expect(notificationSpy).toHaveBeenCalledWith('HTML updated successfully', '', 'success')
    })

    it('should remove context menu before opening editor', async () => {
      const element = document.getElementById('test-element')!
      const originalState = {
        innerHTML: element.innerHTML,
        textContent: element.textContent
      }

      // Create mock context menu elements that match what removeContextMenu removes
      const menuOverlay = document.createElement('div')
      menuOverlay.id = 'absmartly-menu-overlay'
      document.body.appendChild(menuOverlay)

      const menuContainer = document.createElement('div')
      menuContainer.id = 'absmartly-menu-container'
      document.body.appendChild(menuContainer)

      mockHtmlEditor.mockResolvedValue('<div>Test</div>')

      await coordinator.handleEditHtmlAction(element, originalState)

      // Verify context menu elements were removed
      expect(document.getElementById('absmartly-menu-overlay')).toBeFalsy()
      expect(document.getElementById('absmartly-menu-container')).toBeFalsy()
    })

    it('should handle complex HTML structures', async () => {
      const complexHtml = `
        <div class="container">
          <header>
            <h1>Title</h1>
            <nav>
              <ul>
                <li><a href="#">Link 1</a></li>
                <li><a href="#">Link 2</a></li>
              </ul>
            </nav>
          </header>
          <main>
            <article>
              <p>Content</p>
            </article>
          </main>
        </div>
      `

      const element = document.getElementById('test-element')!
      element.innerHTML = complexHtml

      const originalState = {
        innerHTML: element.innerHTML,
        textContent: element.textContent
      }

      const modifiedHtml = complexHtml.replace('Title', 'Modified Title')
      mockHtmlEditor.mockResolvedValue(modifiedHtml)

      await coordinator.handleEditHtmlAction(element, originalState)

      expect(element.innerHTML).toContain('Modified Title')
      expect(element.querySelector('h1')?.textContent).toBe('Modified Title')
    })

    it('should update element HTML content', async () => {
      const element = document.getElementById('test-element')!
      const originalHtml = element.innerHTML

      const originalState = {
        innerHTML: element.innerHTML,
        textContent: element.textContent
      }

      const newHtml = '<div>Updated content</div>'
      mockHtmlEditor.mockResolvedValue(newHtml)

      await coordinator.handleEditHtmlAction(element, originalState)

      // Verify that innerHTML was changed to the new HTML
      expect(element.innerHTML).toBe(newHtml)
      expect(element.innerHTML).not.toBe(originalHtml)
    })

    it('should not update if new HTML is same as current', async () => {
      const element = document.getElementById('test-element')!
      const currentHtml = element.innerHTML

      const originalState = {
        innerHTML: currentHtml,
        textContent: element.textContent
      }

      mockHtmlEditor.mockResolvedValue(currentHtml)

      await coordinator.handleEditHtmlAction(element, originalState)

      // Should not call addChange if HTML hasn't changed
      expect(mockCallbacks.addChange).not.toHaveBeenCalled()
    })

    it('should handle editor errors gracefully', async () => {
      const element = document.getElementById('test-element')!
      const originalHtml = element.innerHTML

      const originalState = {
        innerHTML: originalHtml,
        textContent: element.textContent
      }

      // Mock editor throwing an error
      mockHtmlEditor.mockRejectedValue(new Error('Editor failed to load'))

      // Should not throw
      await expect(
        coordinator.handleEditHtmlAction(element, originalState)
      ).rejects.toThrow('Editor failed to load')

      // Element should remain unchanged
      expect(element.innerHTML).toBe(originalHtml)
    })
  })

  describe('Context Menu Integration', () => {
    it('should handle Edit HTML menu action', () => {
      const element = document.getElementById('test-element')!
      const handleActionSpy = jest.spyOn(coordinator, 'handleMenuAction')

      coordinator.handleMenuAction('editHtml', element)

      expect(handleActionSpy).toHaveBeenCalledWith('editHtml', element)
    })

    it('should pass correct original state to HTML editor', async () => {
      const element = document.getElementById('test-element')!
      element.innerHTML = '<span>Test Content</span>'
      element.setAttribute('data-test', 'value')

      const originalState = {
        html: element.outerHTML,
        parent: element.parentElement,
        nextSibling: element.nextElementSibling,
        textContent: element.textContent,
        innerHTML: element.innerHTML
      }

      mockHtmlEditor.mockResolvedValue('<span>Modified</span>')

      await coordinator.handleEditHtmlAction(element, originalState)

      expect(mockCallbacks.addChange).toHaveBeenCalledWith(
        expect.objectContaining({
          originalHtml: '<span>Test Content</span>'
        })
      )
    })
  })

  describe('Multiple Edit Actions', () => {
    it('should handle sequential HTML edits', async () => {
      const element = document.getElementById('test-element')!

      // First edit
      mockHtmlEditor.mockResolvedValue('<div>First Edit</div>')
      await coordinator.handleEditHtmlAction(element, {
        innerHTML: 'Original',
        textContent: 'Original'
      })

      expect(element.innerHTML).toBe('<div>First Edit</div>')

      // Second edit
      mockHtmlEditor.mockResolvedValue('<div>Second Edit</div>')
      await coordinator.handleEditHtmlAction(element, {
        innerHTML: '<div>First Edit</div>',
        textContent: 'First Edit'
      })

      expect(element.innerHTML).toBe('<div>Second Edit</div>')
      expect(mockCallbacks.addChange).toHaveBeenCalledTimes(2)
    })

    it('should handle switching between text and HTML editing', async () => {
      const element = document.getElementById('test-element')!

      // Text edit
      coordinator.handleEditAction(element, {
        textContent: 'Original',
        innerHTML: 'Original'
      })

      // Simulate text change
      element.textContent = 'Text Edit'
      element.blur()

      // HTML edit
      mockHtmlEditor.mockResolvedValue('<strong>HTML Edit</strong>')
      await coordinator.handleEditHtmlAction(element, {
        innerHTML: 'Text Edit',
        textContent: 'Text Edit'
      })

      expect(element.innerHTML).toBe('<strong>HTML Edit</strong>')
    })
  })

  describe('State Management', () => {
    it('should track HTML changes in visual editor state', async () => {
      const element = document.getElementById('test-element')!
      const changes: any[] = []

      // Override addChange to track changes
      mockCallbacks.addChange = jest.fn((change) => {
        changes.push(change)
      })

      mockHtmlEditor.mockResolvedValue('<div>State Test</div>')

      await coordinator.handleEditHtmlAction(element, {
        innerHTML: 'Original',
        textContent: 'Original'
      })

      expect(changes).toHaveLength(1)
      expect(changes[0]).toMatchObject({
        type: 'html',
        value: '<div>State Test</div>',
        originalHtml: 'Original',
        enabled: true
      })
    })

    it('should use correct selector for HTML changes', async () => {
      const element = document.getElementById('test-element')!
      element.className = 'test-class another-class'

      mockCallbacks.getSelector.mockReturnValue('#test-element.test-class.another-class')
      mockHtmlEditor.mockResolvedValue('<div>Test</div>')

      await coordinator.handleEditHtmlAction(element, {
        innerHTML: 'Original',
        textContent: 'Original'
      })

      expect(mockCallbacks.getSelector).toHaveBeenCalledWith(element)
      expect(mockCallbacks.addChange).toHaveBeenCalledWith(
        expect.objectContaining({
          selector: '#test-element.test-class.another-class'
        })
      )
    })
  })
})