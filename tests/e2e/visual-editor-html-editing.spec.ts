/**
 * E2E tests for Visual Editor HTML Editing with Monaco Editor
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

test.describe('Visual Editor HTML Editing with Monaco', () => {
  let context: BrowserContext
  let page: Page

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

    // Wait for visual editor to initialize
    await page.waitForTimeout(1000)
  })

  test.afterEach(async () => {
    await page.close()
  })

  test.afterAll(async () => {
    await context.close()
  })

  test('should open Monaco editor when Edit HTML is selected', async () => {
    // Click on an element to select it
    await page.click('#simple-element')

    // Right-click to open context menu
    await page.click('#simple-element', { button: 'right' })

    // Wait for context menu
    await page.waitForTimeout(500)

    // Look for Edit HTML option in shadow DOM
    const menuHost = await page.$('#absmartly-menu-host')
    expect(menuHost).toBeTruthy()

    // Click Edit HTML option
    await page.evaluate(() => {
      const menuHost = document.getElementById('absmartly-menu-host')
      if (menuHost && menuHost.shadowRoot) {
        const editHtmlOption = menuHost.shadowRoot.querySelector('[data-action="editHtml"]')
        if (editHtmlOption) {
          (editHtmlOption as HTMLElement).click()
        }
      }
    })

    // Wait for Monaco editor to appear
    await page.waitForSelector('#absmartly-monaco-temp', { timeout: 5000 })

    // Verify Monaco editor is visible
    const monacoEditor = await page.$('#absmartly-monaco-temp')
    expect(monacoEditor).toBeTruthy()

    // Verify editor host with shadow DOM exists
    const editorHost = await page.$('#absmartly-monaco-editor-host')
    expect(editorHost).toBeTruthy()
  })

  test('should display current HTML content in Monaco editor', async () => {
    const originalContent = await page.$eval('#simple-element', el => el.innerHTML)

    // Open Monaco editor
    await page.click('#simple-element')
    await page.click('#simple-element', { button: 'right' })

    await page.evaluate(() => {
      const menuHost = document.getElementById('absmartly-menu-host')
      if (menuHost && menuHost.shadowRoot) {
        const editHtmlOption = menuHost.shadowRoot.querySelector('[data-action="editHtml"]')
        if (editHtmlOption) {
          (editHtmlOption as HTMLElement).click()
        }
      }
    })

    await page.waitForSelector('#absmartly-monaco-temp', { timeout: 5000 })

    // Get Monaco editor content
    const editorContent = await page.evaluate(() => {
      const monaco = (window as any).monaco
      if (monaco && monaco.editor.getModels) {
        const models = monaco.editor.getModels()
        if (models.length > 0) {
          return models[0].getValue()
        }
      }
      return null
    })

    expect(editorContent).toContain('Simple paragraph')
  })

  test('should save changes when Apply Changes button is clicked', async () => {
    // Open Monaco editor for simple element
    await page.click('#simple-element')
    await page.click('#simple-element', { button: 'right' })

    await page.evaluate(() => {
      const menuHost = document.getElementById('absmartly-menu-host')
      if (menuHost && menuHost.shadowRoot) {
        const editHtmlOption = menuHost.shadowRoot.querySelector('[data-action="editHtml"]')
        if (editHtmlOption) {
          (editHtmlOption as HTMLElement).click()
        }
      }
    })

    await page.waitForSelector('#absmartly-monaco-temp', { timeout: 5000 })

    // Modify content in Monaco
    const newContent = '<p>Modified content from E2E test</p>'
    await page.evaluate((content) => {
      const monaco = (window as any).monaco
      if (monaco && monaco.editor.getModels) {
        const models = monaco.editor.getModels()
        if (models.length > 0) {
          models[0].setValue(content)
        }
      }
    }, newContent)

    // Click Apply Changes button
    await page.evaluate(() => {
      const editorHost = document.getElementById('absmartly-monaco-editor-host')
      if (editorHost && editorHost.shadowRoot) {
        const saveBtn = editorHost.shadowRoot.querySelector('.editor-button-save')
        if (saveBtn) {
          (saveBtn as HTMLElement).click()
        }
      }
    })

    // Wait for editor to close
    await page.waitForTimeout(500)

    // Verify the element content has been updated
    const updatedContent = await page.$eval('#simple-element', el => el.innerHTML.trim())
    expect(updatedContent).toBe(newContent)
  })

  test('should cancel changes when Cancel button is clicked', async () => {
    const originalContent = await page.$eval('#simple-element', el => el.innerHTML)

    // Open Monaco editor
    await page.click('#simple-element')
    await page.click('#simple-element', { button: 'right' })

    await page.evaluate(() => {
      const menuHost = document.getElementById('absmartly-menu-host')
      if (menuHost && menuHost.shadowRoot) {
        const editHtmlOption = menuHost.shadowRoot.querySelector('[data-action="editHtml"]')
        if (editHtmlOption) {
          (editHtmlOption as HTMLElement).click()
        }
      }
    })

    await page.waitForSelector('#absmartly-monaco-temp', { timeout: 5000 })

    // Modify content in Monaco
    await page.evaluate(() => {
      const monaco = (window as any).monaco
      if (monaco && monaco.editor.getModels) {
        const models = monaco.editor.getModels()
        if (models.length > 0) {
          models[0].setValue('<p>This should not be saved</p>')
        }
      }
    })

    // Click Cancel button
    await page.evaluate(() => {
      const editorHost = document.getElementById('absmartly-monaco-editor-host')
      if (editorHost && editorHost.shadowRoot) {
        const cancelBtn = editorHost.shadowRoot.querySelector('.editor-button-cancel')
        if (cancelBtn) {
          (cancelBtn as HTMLElement).click()
        }
      }
    })

    // Wait for editor to close
    await page.waitForTimeout(500)

    // Verify the element content hasn't changed
    const currentContent = await page.$eval('#simple-element', el => el.innerHTML)
    expect(currentContent).toBe(originalContent)
  })

  test('should close editor when ESC key is pressed', async () => {
    // Open Monaco editor
    await page.click('#simple-element')
    await page.click('#simple-element', { button: 'right' })

    await page.evaluate(() => {
      const menuHost = document.getElementById('absmartly-menu-host')
      if (menuHost && menuHost.shadowRoot) {
        const editHtmlOption = menuHost.shadowRoot.querySelector('[data-action="editHtml"]')
        if (editHtmlOption) {
          (editHtmlOption as HTMLElement).click()
        }
      }
    })

    await page.waitForSelector('#absmartly-monaco-temp', { timeout: 5000 })

    // Press ESC key
    await page.keyboard.press('Escape')

    // Wait for editor to close
    await page.waitForTimeout(500)

    // Verify editor is closed
    const monacoEditor = await page.$('#absmartly-monaco-temp')
    expect(monacoEditor).toBeFalsy()

    const editorHost = await page.$('#absmartly-monaco-editor-host')
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

    // Open Monaco editor
    await page.click('#simple-element')
    await page.click('#simple-element', { button: 'right' })

    await page.evaluate(() => {
      const menuHost = document.getElementById('absmartly-menu-host')
      if (menuHost && menuHost.shadowRoot) {
        const editHtmlOption = menuHost.shadowRoot.querySelector('[data-action="editHtml"]')
        if (editHtmlOption) {
          (editHtmlOption as HTMLElement).click()
        }
      }
    })

    await page.waitForSelector('#absmartly-monaco-temp', { timeout: 5000 })

    // Click Format button
    await page.evaluate(() => {
      const editorHost = document.getElementById('absmartly-monaco-editor-host')
      if (editorHost && editorHost.shadowRoot) {
        const formatBtn = editorHost.shadowRoot.querySelector('.toolbar-button')
        if (formatBtn) {
          (formatBtn as HTMLElement).click()
        }
      }
    })

    // Wait for formatting
    await page.waitForTimeout(500)

    // Get formatted content
    const formattedContent = await page.evaluate(() => {
      const monaco = (window as any).monaco
      if (monaco && monaco.editor.getModels) {
        const models = monaco.editor.getModels()
        if (models.length > 0) {
          return models[0].getValue()
        }
      }
      return null
    })

    // Verify content is formatted (has newlines and indentation)
    expect(formattedContent).toContain('\n')
    expect(formattedContent).toMatch(/^\s+</m) // Has indentation
  })

  test('should wrap selected text when Wrap Selection button is clicked', async () => {
    // Open Monaco editor
    await page.click('#simple-element')
    await page.click('#simple-element', { button: 'right' })

    await page.evaluate(() => {
      const menuHost = document.getElementById('absmartly-menu-host')
      if (menuHost && menuHost.shadowRoot) {
        const editHtmlOption = menuHost.shadowRoot.querySelector('[data-action="editHtml"]')
        if (editHtmlOption) {
          (editHtmlOption as HTMLElement).click()
        }
      }
    })

    await page.waitForSelector('#absmartly-monaco-temp', { timeout: 5000 })

    // Set content and select text
    await page.evaluate(() => {
      const monaco = (window as any).monaco
      if (monaco && monaco.editor.getModels) {
        const models = monaco.editor.getModels()
        if (models.length > 0) {
          models[0].setValue('Test content to wrap')
          // Select "content to wrap"
          const editor = monaco.editor.getEditors()[0]
          if (editor) {
            editor.setSelection({
              startLineNumber: 1,
              startColumn: 6,
              endLineNumber: 1,
              endColumn: 21
            })
          }
        }
      }
    })

    // Click Wrap Selection button
    await page.evaluate(() => {
      const editorHost = document.getElementById('absmartly-monaco-editor-host')
      if (editorHost && editorHost.shadowRoot) {
        const buttons = editorHost.shadowRoot.querySelectorAll('.toolbar-button')
        if (buttons[1]) {
          (buttons[1] as HTMLElement).click()
        }
      }
    })

    // Wait for wrapping
    await page.waitForTimeout(500)

    // Get wrapped content
    const wrappedContent = await page.evaluate(() => {
      const monaco = (window as any).monaco
      if (monaco && monaco.editor.getModels) {
        const models = monaco.editor.getModels()
        if (models.length > 0) {
          return models[0].getValue()
        }
      }
      return null
    })

    // Verify content is wrapped
    expect(wrappedContent).toContain('<div>')
    expect(wrappedContent).toContain('</div>')
  })

  test('should handle complex HTML structures', async () => {
    // Open Monaco editor for complex element
    await page.click('#complex-element')
    await page.click('#complex-element', { button: 'right' })

    await page.evaluate(() => {
      const menuHost = document.getElementById('absmartly-menu-host')
      if (menuHost && menuHost.shadowRoot) {
        const editHtmlOption = menuHost.shadowRoot.querySelector('[data-action="editHtml"]')
        if (editHtmlOption) {
          (editHtmlOption as HTMLElement).click()
        }
      }
    })

    await page.waitForSelector('#absmartly-monaco-temp', { timeout: 5000 })

    // Get editor content
    const editorContent = await page.evaluate(() => {
      const monaco = (window as any).monaco
      if (monaco && monaco.editor.getModels) {
        const models = monaco.editor.getModels()
        if (models.length > 0) {
          return models[0].getValue()
        }
      }
      return null
    })

    // Verify complex structure is preserved
    expect(editorContent).toContain('complex-element')
    expect(editorContent).toContain('<img')
    expect(editorContent).toContain('<h3>')
    expect(editorContent).toContain('<p>')

    // Modify and save
    const modifiedContent = editorContent?.replace('Title', 'Modified Title')

    await page.evaluate((content) => {
      const monaco = (window as any).monaco
      if (monaco && monaco.editor.getModels) {
        const models = monaco.editor.getModels()
        if (models.length > 0) {
          models[0].setValue(content)
        }
      }
    }, modifiedContent)

    // Save changes
    await page.evaluate(() => {
      const editorHost = document.getElementById('absmartly-monaco-editor-host')
      if (editorHost && editorHost.shadowRoot) {
        const saveBtn = editorHost.shadowRoot.querySelector('.editor-button-save')
        if (saveBtn) {
          (saveBtn as HTMLElement).click()
        }
      }
    })

    // Wait for editor to close
    await page.waitForTimeout(500)

    // Verify changes are applied
    const updatedContent = await page.$eval('#complex-element h3', el => el.textContent)
    expect(updatedContent).toBe('Modified Title')
  })

  test('should track HTML changes in visual editor state', async () => {
    // Open Monaco editor
    await page.click('#simple-element')
    await page.click('#simple-element', { button: 'right' })

    await page.evaluate(() => {
      const menuHost = document.getElementById('absmartly-menu-host')
      if (menuHost && menuHost.shadowRoot) {
        const editHtmlOption = menuHost.shadowRoot.querySelector('[data-action="editHtml"]')
        if (editHtmlOption) {
          (editHtmlOption as HTMLElement).click()
        }
      }
    })

    await page.waitForSelector('#absmartly-monaco-temp', { timeout: 5000 })

    // Modify and save
    await page.evaluate(() => {
      const monaco = (window as any).monaco
      if (monaco && monaco.editor.getModels) {
        const models = monaco.editor.getModels()
        if (models.length > 0) {
          models[0].setValue('<p>Tracked change</p>')
        }
      }
    })

    await page.evaluate(() => {
      const editorHost = document.getElementById('absmartly-monaco-editor-host')
      if (editorHost && editorHost.shadowRoot) {
        const saveBtn = editorHost.shadowRoot.querySelector('.editor-button-save')
        if (saveBtn) {
          (saveBtn as HTMLElement).click()
        }
      }
    })

    // Wait for change to be tracked
    await page.waitForTimeout(500)

    // Check if change is tracked
    const changes = await page.evaluate(() => {
      // Get changes from visual editor state
      return (window as any).absmartlyChanges || []
    })

    // Verify change is tracked with type 'html'
    const htmlChange = changes.find((c: any) => c.type === 'html')
    expect(htmlChange).toBeTruthy()
    expect(htmlChange?.value).toBe('<p>Tracked change</p>')
  })

  test('should display syntax highlighting in Monaco editor', async () => {
    // Open Monaco editor
    await page.click('#form-element')
    await page.click('#form-element', { button: 'right' })

    await page.evaluate(() => {
      const menuHost = document.getElementById('absmartly-menu-host')
      if (menuHost && menuHost.shadowRoot) {
        const editHtmlOption = menuHost.shadowRoot.querySelector('[data-action="editHtml"]')
        if (editHtmlOption) {
          (editHtmlOption as HTMLElement).click()
        }
      }
    })

    await page.waitForSelector('#absmartly-monaco-temp', { timeout: 5000 })

    // Check if Monaco is using HTML language mode
    const languageMode = await page.evaluate(() => {
      const monaco = (window as any).monaco
      if (monaco && monaco.editor.getModels) {
        const models = monaco.editor.getModels()
        if (models.length > 0) {
          return models[0].getLanguageId()
        }
      }
      return null
    })

    expect(languageMode).toBe('html')

    // Check if theme is applied
    const theme = await page.evaluate(() => {
      const monaco = (window as any).monaco
      if (monaco && monaco.editor.getEditors) {
        const editors = monaco.editor.getEditors()
        if (editors.length > 0) {
          return editors[0]._themeService._theme.themeName
        }
      }
      return null
    })

    expect(theme).toBe('vs-dark')
  })
})