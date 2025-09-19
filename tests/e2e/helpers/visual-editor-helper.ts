/**
 * Helper functions for E2E testing of the Visual Editor
 */

import { Page, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

export class VisualEditorHelper {
  constructor(private page: Page) {}

  /**
   * Load a test page with proper setup
   */
  async loadTestPage(htmlContent?: string) {
    if (htmlContent) {
      await this.page.goto(`data:text/html,${encodeURIComponent(htmlContent)}`)
    } else {
      // Try localhost server first
      try {
        await this.page.goto('http://localhost:8000/tests/test-pages/monaco-editor-test.html', {
          waitUntil: 'domcontentloaded',
          timeout: 5000
        })
      } catch {
        // Fall back to data URL
        const testPagePath = path.join(__dirname, '../../../tests/test-pages/monaco-editor-test.html')
        if (fs.existsSync(testPagePath)) {
          const content = fs.readFileSync(testPagePath, 'utf-8')
          await this.page.goto(`data:text/html,${encodeURIComponent(content)}`)
        } else {
          // Use a simple default test page
          const defaultHTML = `
            <!DOCTYPE html>
            <html>
            <head><title>Test Page</title></head>
            <body>
              <div id="test-element">
                <p>Test content</p>
                <span>More content</span>
              </div>
            </body>
            </html>
          `
          await this.page.goto(`data:text/html,${encodeURIComponent(defaultHTML)}`)
        }
      }
    }
  }

  /**
   * Initialize the Visual Editor via extension messaging
   */
  async initializeVisualEditor(config?: {
    experimentName?: string
    variantName?: string
    changes?: any[]
  }) {
    const defaultConfig = {
      experimentName: 'E2E Test Experiment',
      variantName: 'Test Variant',
      changes: [],
      logoUrl: 'data:image/svg+xml,<svg></svg>'
    }

    const finalConfig = { ...defaultConfig, ...config }

    // Send initialization message
    await this.page.evaluate((cfg) => {
      window.postMessage({
        type: 'ABSMARTLY_INIT_VISUAL_EDITOR',
        config: cfg
      }, '*')
    }, finalConfig)

    // Wait for visual editor to initialize
    try {
      await this.page.waitForFunction(() => {
        // Check for various indicators that visual editor is ready
        return !!(
          document.querySelector('.absmartly-selected') ||
          document.querySelector('#absmartly-visual-editor-banner-host') ||
          document.querySelector('.absmartly-toolbar') ||
          document.querySelector('[data-absmartly-modified]')
        )
      }, { timeout: 10000 })
    } catch (error) {
      console.warn('Visual editor initialization timeout - continuing anyway')
      // Take a screenshot for debugging
      await this.page.screenshot({ path: 'visual-editor-init-timeout.png' })
    }
  }

  /**
   * Select an element in the visual editor
   */
  async selectElement(selector: string) {
    await this.page.click(selector)
    await this.page.waitForTimeout(300)

    // Verify element is selected
    const isSelected = await this.page.evaluate((sel) => {
      const element = document.querySelector(sel)
      return element?.classList.contains('absmartly-selected')
    }, selector)

    if (!isSelected) {
      console.warn(`Element ${selector} might not be properly selected`)
    }
  }

  /**
   * Open context menu for an element
   */
  async openContextMenu(selector: string) {
    await this.selectElement(selector)
    await this.page.click(selector, { button: 'right' })
    await this.page.waitForTimeout(300)

    // Wait for context menu
    await this.page.waitForFunction(() => {
      return document.getElementById('absmartly-menu-host') !== null
    }, { timeout: 5000 })
  }

  /**
   * Click a context menu action
   */
  async clickContextMenuAction(action: string): Promise<boolean> {
    return await this.page.evaluate((actionName) => {
      const menuHost = document.getElementById('absmartly-menu-host')
      if (menuHost && menuHost.shadowRoot) {
        const menuItem = menuHost.shadowRoot.querySelector(`[data-action="${actionName}"]`)
        if (menuItem) {
          (menuItem as HTMLElement).click()
          return true
        }
      }
      return false
    }, action)
  }

  /**
   * Open Monaco HTML editor for an element
   */
  async openMonacoEditor(selector: string) {
    await this.openContextMenu(selector)

    const clicked = await this.clickContextMenuAction('editHtml')
    if (!clicked) {
      throw new Error('Could not click Edit HTML menu option')
    }

    // Wait for Monaco to load
    await this.page.waitForFunction(() => {
      return typeof window.monaco !== 'undefined'
    }, { timeout: 15000 })

    // Wait for editor container
    await this.page.waitForSelector('#absmartly-monaco-temp', { timeout: 10000 })

    // Give Monaco time to fully initialize
    await this.page.waitForTimeout(1000)
  }

  /**
   * Get Monaco editor instance
   */
  async getMonacoEditor() {
    return await this.page.evaluate(() => {
      const monaco = window.monaco
      if (monaco) {
        const editors = monaco.editor.getEditors()
        return editors.length > 0 ? editors[0] : null
      }
      return null
    })
  }

  /**
   * Set Monaco editor content
   */
  async setMonacoContent(content: string) {
    await this.page.evaluate((text) => {
      const monaco = window.monaco
      if (monaco) {
        const editors = monaco.editor.getEditors()
        if (editors.length > 0) {
          editors[0].setValue(text)
        }
      }
    }, content)
  }

  /**
   * Get Monaco editor content
   */
  async getMonacoContent(): Promise<string> {
    return await this.page.evaluate(() => {
      const monaco = window.monaco
      if (monaco) {
        const editors = monaco.editor.getEditors()
        if (editors.length > 0) {
          return editors[0].getValue()
        }
      }
      return ''
    })
  }

  /**
   * Click toolbar button in Monaco editor
   */
  async clickMonacoToolbarButton(buttonIndex: number): Promise<boolean> {
    return await this.page.evaluate((index) => {
      const editorHost = document.getElementById('absmartly-monaco-editor-host')
      if (editorHost && editorHost.shadowRoot) {
        const buttons = editorHost.shadowRoot.querySelectorAll('.toolbar-button')
        if (buttons[index]) {
          (buttons[index] as HTMLElement).click()
          return true
        }
      }
      return false
    }, buttonIndex)
  }

  /**
   * Click save button in Monaco editor
   */
  async saveMonacoEditor(): Promise<boolean> {
    return await this.page.evaluate(() => {
      const editorHost = document.getElementById('absmartly-monaco-editor-host')
      if (editorHost && editorHost.shadowRoot) {
        const saveBtn = editorHost.shadowRoot.querySelector('.editor-button-save')
        if (saveBtn) {
          (saveBtn as HTMLElement).click()
          return true
        }
      }
      return false
    })
  }

  /**
   * Click cancel button in Monaco editor
   */
  async cancelMonacoEditor(): Promise<boolean> {
    return await this.page.evaluate(() => {
      const editorHost = document.getElementById('absmartly-monaco-editor-host')
      if (editorHost && editorHost.shadowRoot) {
        const cancelBtn = editorHost.shadowRoot.querySelector('.editor-button-cancel')
        if (cancelBtn) {
          (cancelBtn as HTMLElement).click()
          return true
        }
      }
      return false
    })
  }

  /**
   * Check if Monaco editor is visible
   */
  async isMonacoVisible(): Promise<boolean> {
    return await this.page.isVisible('#absmartly-monaco-temp')
  }

  /**
   * Trigger autocomplete in Monaco
   */
  async triggerAutocomplete() {
    await this.page.keyboard.press('Control+Space')
    await this.page.waitForTimeout(500)
  }

  /**
   * Get autocomplete suggestions
   */
  async getAutocompleteSuggestions(): Promise<string[]> {
    return await this.page.evaluate(() => {
      const suggestWidget = document.querySelector('.suggest-widget')
      if (!suggestWidget) return []

      const suggestionElements = suggestWidget.querySelectorAll('.monaco-list-row')
      return Array.from(suggestionElements).map(el => {
        const label = el.querySelector('.label-name')?.textContent ||
                      el.querySelector('.monaco-icon-label')?.textContent || ''
        return label.trim()
      }).filter(s => s.length > 0)
    })
  }

  /**
   * Check if syntax highlighting is active
   */
  async hasSyntaxHighlighting(): Promise<boolean> {
    return await this.page.evaluate(() => {
      const monacoContainer = document.querySelector('#absmartly-monaco-temp')
      if (!monacoContainer) return false

      // Monaco adds classes like 'mtk1', 'mtk2', etc. for syntax tokens
      const tokens = monacoContainer.querySelectorAll('[class*="mtk"]')

      // Also check for view-line elements
      const viewLines = monacoContainer.querySelector('.view-lines')

      return tokens.length > 0 || (viewLines !== null && viewLines.children.length > 0)
    })
  }

  /**
   * Format document in Monaco
   */
  async formatDocument() {
    // Try toolbar button first
    const clicked = await this.clickMonacoToolbarButton(0) // Format is usually first button

    if (!clicked) {
      // Fall back to keyboard shortcut
      await this.page.keyboard.press('Shift+Alt+F')
    }

    await this.page.waitForTimeout(1000)
  }

  /**
   * Select text in Monaco editor
   */
  async selectText(startLine: number, startColumn: number, endLine: number, endColumn: number) {
    await this.page.evaluate((selection) => {
      const monaco = window.monaco
      if (monaco) {
        const editors = monaco.editor.getEditors()
        if (editors.length > 0) {
          editors[0].setSelection({
            startLineNumber: selection.startLine,
            startColumn: selection.startColumn,
            endLineNumber: selection.endLine,
            endColumn: selection.endColumn
          })
        }
      }
    }, { startLine, startColumn, endLine, endColumn })
  }

  /**
   * Get visual editor changes
   */
  async getVisualEditorChanges(): Promise<any[]> {
    return await this.page.evaluate(() => {
      return (window as any).absmartlyChanges || []
    })
  }

  /**
   * Take a screenshot for debugging
   */
  async screenshot(filename: string) {
    await this.page.screenshot({
      path: filename,
      fullPage: true
    })
  }
}

// Declare Monaco types for TypeScript
declare global {
  interface Window {
    monaco: any
    absmartlyChanges?: any[]
  }
}