/**
 * E2E tests for Visual Editor HTML Editing with CodeMirror
 */

import { test, expect, type Page, type BrowserContext, chromium } from '@playwright/test'
import path from 'path'

// Test page content
const TEST_PAGE_CONTENT = `
<!DOCTYPE html>
<html>
<head>
  <title>HTML Editor E2E Test</title>
  <style>
    body { padding: 40px; font-family: system-ui; }
    .test-element {
      padding: 20px;
      background: #f5f5f5;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .complex-element {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 15px;
      background: white;
      border: 1px solid #ddd;
    }
  </style>
</head>
<body>
  <h1>HTML Editor E2E Test Page</h1>

  <div class="test-element" id="simple-element">
    <p>Simple paragraph for testing</p>
  </div>

  <div class="test-element" id="complex-element">
    <div class="complex-element">
      <img src="https://via.placeholder.com/50" alt="Test">
      <div>
        <h3>Title</h3>
        <p>Description text</p>
      </div>
    </div>
  </div>

  <div class="test-element" id="list-element">
    <ul>
      <li>Item 1</li>
      <li>Item 2</li>
      <li>Item 3</li>
    </ul>
  </div>

  <div class="test-element" id="form-element">
    <form>
      <input type="text" placeholder="Test input">
      <button type="submit">Submit</button>
    </form>
  </div>
</body>
</html>
`

test.describe('Visual Editor HTML Editing with CodeMirror', () => {
  let context: BrowserContext
  let page: Page

  // Helper function to open HTML editor
  async function openHtmlEditor(elementId: string) {
    await page.click(`#${elementId}`)
    await page.click(`#${elementId}`, { button: 'right' })

    await page.waitForFunction(() => {
      const menuHost = document.getElementById('absmartly-menu-host')
      return menuHost !== null
    }, { timeout: 5000 })

    await page.evaluate(() => {
      const menuHost = document.getElementById('absmartly-menu-host')
      if (menuHost && menuHost.shadowRoot) {
        const editHtmlOption = menuHost.shadowRoot.querySelector('[data-action="editHtml"]')
        if (editHtmlOption) {
          (editHtmlOption as HTMLElement).click()
        }
      }
    })

    await page.waitForFunction(() => {
      return document.getElementById('absmartly-html-editor-host') !== null
    }, { timeout: 5000 })
  }

  // Helper function to get CodeMirror content
  async function getEditorContent(): Promise<string | null> {
    return page.evaluate(() => {
      const container = document.getElementById('codemirror-container')
      if (container) {
        const cmEditor = container.querySelector('.cm-editor')
        if (cmEditor) {
          const lines = cmEditor.querySelectorAll('.cm-line')
          return Array.from(lines).map(line => line.textContent).join('\n')
        }
      }
      return null
    })
  }

  // Helper function to set CodeMirror content
  async function setEditorContent(content: string) {
    await page.evaluate((newContent) => {
      const container = document.getElementById('codemirror-container')
      if (container && (container as any).editorView) {
        const view = (container as any).editorView
        view.dispatch({
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: newContent
          }
        })
      }
    }, content)
  }

  test.beforeAll(async () => {
    // Load extension
    const extensionPath = path.join(__dirname, '../../build/chrome-mv3-dev')

    context = await chromium.launchPersistentContext('', {
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox'
      ]
    })
  })

  test.beforeEach(async () => {
    // Create a new page for each test
    page = await context.newPage()

    // Set up test page content
    await page.goto('data:text/html,' + encodeURIComponent(TEST_PAGE_CONTENT))

    // Inject visual editor initialization
    await page.evaluate(() => {
      window.postMessage({
        type: 'ABSMARTLY_INIT_VISUAL_EDITOR',
        config: {
          experimentName: 'E2E Test',
          variantName: 'Test Variant',
          changes: [],
          logoUrl: 'https://example.com/logo.png'
        }
      }, '*')
    })

    // Wait for visual editor to initialize by checking for banner
    await page.waitForFunction(() => {
      const banner = document.getElementById('absmartly-visual-editor-banner')
      return banner !== null
    }, { timeout: 5000 })
  })

  test.afterEach(async () => {
    await page.close()
  })

  test.afterAll(async () => {
    await context.close()
  })

  test('should open CodeMirror editor when Edit HTML is selected', async () => {
    await openHtmlEditor('simple-element')

    // Verify CodeMirror container is visible
    const editorHost = await page.$('#absmartly-html-editor-host')
    expect(editorHost).toBeTruthy()

    const codeMirrorContainer = await page.$('#codemirror-container')
    expect(codeMirrorContainer).toBeTruthy()
  })

  test('should display current HTML content in CodeMirror editor', async () => {
    await openHtmlEditor('simple-element')

    // Get CodeMirror editor content
    const editorContent = await getEditorContent()

    expect(editorContent).toContain('Simple paragraph')
  })

  test('should save changes when Apply Changes button is clicked', async () => {
    await openHtmlEditor('simple-element')

    // Modify content in CodeMirror
    const newContent = '<p>Modified content from E2E test</p>'
    await setEditorContent(newContent)

    // Click Apply Changes button
    const saveBtn = await page.$('.editor-button-save')
    await saveBtn?.click()

    // Wait for editor to close
    await page.waitForFunction(() => {
      return document.getElementById('absmartly-html-editor-host') === null
    }, { timeout: 5000 })

    // Verify the element content has been updated
    const updatedContent = await page.$eval('#simple-element', el => el.innerHTML.trim())
    expect(updatedContent).toBe(newContent)
  })

  test('should cancel changes when Cancel button is clicked', async () => {
    const originalContent = await page.$eval('#simple-element', el => el.innerHTML)

    await openHtmlEditor('simple-element')

    // Modify content in CodeMirror
    await setEditorContent('<p>This should not be saved</p>')

    // Click Cancel button
    const cancelBtn = await page.$('.editor-button-cancel')
    await cancelBtn?.click()

    // Wait for editor to close
    await page.waitForFunction(() => {
      return document.getElementById('absmartly-html-editor-host') === null
    }, { timeout: 5000 })

    // Verify the element content hasn't changed
    const currentContent = await page.$eval('#simple-element', el => el.innerHTML)
    expect(currentContent).toBe(originalContent)
  })

  test('should close editor when ESC key is pressed', async () => {
    await openHtmlEditor('simple-element')

    // Press ESC key
    await page.keyboard.press('Escape')

    // Wait for editor to close
    await page.waitForFunction(() => {
      return document.getElementById('absmartly-html-editor-host') === null
    }, { timeout: 5000 })

    // Verify editor is closed
    const editorHost = await page.$('#absmartly-html-editor-host')
    expect(editorHost).toBeFalsy()
  })

  test('should format HTML when Format button is clicked', async () => {
    // Create an element with unformatted HTML
    await page.evaluate(() => {
      const element = document.getElementById('simple-element')
      if (element) {
        element.innerHTML = '<div><p>Unformatted</p><span>HTML</span></div>'
      }
    })

    await openHtmlEditor('simple-element')

    // Get initial content
    const initialContent = await getEditorContent()
    expect(initialContent).toBeTruthy()

    // Click Format button
    const formatBtn = await page.$('.toolbar-button')
    await formatBtn?.click()

    // Wait for formatting to complete
    await page.waitForFunction(() => {
      const container = document.getElementById('codemirror-container')
      if (container) {
        const cmEditor = container.querySelector('.cm-editor')
        if (cmEditor) {
          const lines = cmEditor.querySelectorAll('.cm-line')
          return lines.length > 1
        }
      }
      return false
    }, { timeout: 5000 })

    // Get formatted content
    const formattedContent = await getEditorContent()

    // Verify content is formatted (has newlines and indentation)
    expect(formattedContent).toContain('\n')
    expect(formattedContent).toMatch(/^\s+</m) // Has indentation
  })

  test('should handle complex HTML structures', async () => {
    await openHtmlEditor('complex-element')

    // Get editor content
    const editorContent = await getEditorContent()

    // Verify complex structure is preserved
    expect(editorContent).toContain('complex-element')
    expect(editorContent).toContain('<img')
    expect(editorContent).toContain('<h3>')
    expect(editorContent).toContain('<p>')

    // Modify and save
    const modifiedContent = editorContent?.replace('Title', 'Modified Title')
    if (modifiedContent) {
      await setEditorContent(modifiedContent)
    }

    // Save changes
    const saveBtn = await page.$('.editor-button-save')
    await saveBtn?.click()

    // Wait for editor to close
    await page.waitForFunction(() => {
      return document.getElementById('absmartly-html-editor-host') === null
    }, { timeout: 5000 })

    // Verify changes are applied
    const updatedContent = await page.$eval('#complex-element h3', el => el.textContent)
    expect(updatedContent).toBe('Modified Title')
  })

  test('should track HTML changes in visual editor state', async () => {
    await openHtmlEditor('simple-element')

    // Modify and save
    await setEditorContent('<p>Tracked change</p>')

    const saveBtn = await page.$('.editor-button-save')
    await saveBtn?.click()

    // Wait for editor to close
    await page.waitForFunction(() => {
      return document.getElementById('absmartly-html-editor-host') === null
    }, { timeout: 5000 })

    // Wait for change to be tracked
    await page.waitForFunction(() => {
      const changes = (window as any).absmartlyChanges || []
      return changes.some((c: any) => c.action === 'html')
    }, { timeout: 5000 })

    // Check if change is tracked
    const changes = await page.evaluate(() => {
      // Get changes from visual editor state
      return (window as any).absmartlyChanges || []
    })

    // Verify change is tracked with action 'html'
    const htmlChange = changes.find((c: any) => c.action === 'html')
    expect(htmlChange).toBeTruthy()
    expect(htmlChange?.value).toBe('<p>Tracked change</p>')
  })

  test('should display syntax highlighting in CodeMirror editor', async () => {
    await openHtmlEditor('form-element')

    // Wait for editor to be fully rendered
    await page.waitForFunction(() => {
      const container = document.getElementById('codemirror-container')
      if (container) {
        const cmEditor = container.querySelector('.cm-editor')
        if (cmEditor) {
          // Check for syntax highlighting by looking for CodeMirror syntax classes
          const hasHighlighting = cmEditor.querySelector('.cm-tag') !== null ||
                                   cmEditor.querySelector('.ͼ1') !== null // CodeMirror uses generated class names
          return hasHighlighting
        }
      }
      return false
    }, { timeout: 5000 })

    // Verify the editor container exists and has content
    const editorHost = await page.$('#absmartly-html-editor-host')
    expect(editorHost).toBeTruthy()

    const codeMirrorContainer = await page.$('#codemirror-container')
    expect(codeMirrorContainer).toBeTruthy()

    // Verify editor has HTML content
    const editorContent = await getEditorContent()
    expect(editorContent).toContain('form')
    expect(editorContent).toContain('input')
  })
})
