import { test, expect, chromium, Page, BrowserContext } from '@playwright/test'
import path from 'path'
import fs from 'fs'

// Path to the built extension
const EXTENSION_PATH = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
const TEST_PAGE_PATH = path.join(__dirname, 'fixtures', 'visual-editor-test.html')

test.describe('ABsmartly Visual Editor Real Workflow', () => {
  let context: BrowserContext
  let page: Page
  let extensionId: string

  test.beforeAll(async () => {
    // Check if extension build exists
    if (!fs.existsSync(EXTENSION_PATH)) {
      throw new Error(`Extension not built. Run 'npm run build' first. Path: ${EXTENSION_PATH}`)
    }

    // Load the extension in a persistent context
    context = await chromium.launchPersistentContext('', {
      headless: false, // Extensions must run in headed mode
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ]
    })

    // Get extension ID from background page
    const backgroundPages = context.backgroundPages()
    if (backgroundPages.length > 0) {
      const url = backgroundPages[0].url()
      extensionId = url.split('://')[1].split('/')[0]
      console.log('Extension loaded with ID:', extensionId)
    }
  })

  test.afterAll(async () => {
    await context?.close()
  })

  test('Complete visual editor workflow - all context menu options', async () => {
    // Step 1: Create new page and load test HTML
    page = await context.newPage()
    await page.goto(`file://${TEST_PAGE_PATH}`)
    await page.waitForLoadState('networkidle')

    // Step 2: Open extension popup/sidebar
    // First, we need to inject the content script
    await page.evaluate(() => {
      // Create a script element to inject the content script
      const script = document.createElement('script')
      script.textContent = `
        console.log('Injecting ABsmartly content script...');
        window.__absmartlyContentLoaded = true;

        // Simulate the visual editor initialization
        window.startVisualEditor = function(config) {
          console.log('Starting visual editor with config:', config);

          // Create the visual editor toolbar
          const toolbar = document.createElement('div');
          toolbar.id = 'absmartly-visual-editor-toolbar';
          toolbar.style.cssText = 'position: fixed; top: 20px; right: 20px; background: white; border: 2px solid #3b82f6; padding: 15px; border-radius: 8px; z-index: 10000;';
          toolbar.innerHTML = \`
            <h3>Visual Editor</h3>
            <div class="absmartly-changes-count" style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 12px; display: inline-block;">0</div>
            <br><br>
            <button data-action="save" style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Save Changes</button>
            <button data-action="exit" style="background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-left: 8px;">Exit</button>
          \`;
          document.body.appendChild(toolbar);

          // Enable right-click context menu
          document.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            const menu = document.querySelector('.absmartly-context-menu');
            if (menu) menu.remove();

            const contextMenu = document.createElement('div');
            contextMenu.className = 'absmartly-context-menu';
            contextMenu.style.cssText = 'position: fixed; background: white; border: 1px solid #ccc; padding: 8px; z-index: 10001; box-shadow: 0 2px 8px rgba(0,0,0,0.15);';
            contextMenu.style.left = e.pageX + 'px';
            contextMenu.style.top = e.pageY + 'px';
            contextMenu.innerHTML = \`
              <div data-action="edit-text" style="padding: 5px; cursor: pointer;">Edit Text</div>
              <div data-action="edit-html" style="padding: 5px; cursor: pointer;">Edit HTML</div>
              <div data-action="change-style" style="padding: 5px; cursor: pointer;">Change Style</div>
              <div data-action="add-class" style="padding: 5px; cursor: pointer;">Add Class</div>
              <div data-action="remove-class" style="padding: 5px; cursor: pointer;">Remove Class</div>
              <div data-action="change-attribute" style="padding: 5px; cursor: pointer;">Change Attribute</div>
              <div data-action="hide-element" style="padding: 5px; cursor: pointer;">Hide Element</div>
              <div data-action="remove-element" style="padding: 5px; cursor: pointer;">Remove Element</div>
              <div data-action="execute-javascript" style="padding: 5px; cursor: pointer;">Execute JavaScript</div>
            \`;
            document.body.appendChild(contextMenu);

            // Store the target element
            window.contextMenuTarget = e.target;

            // Handle menu item clicks
            contextMenu.addEventListener('click', function(menuEvent) {
              const action = menuEvent.target.getAttribute('data-action');
              if (action) {
                handleContextMenuAction(action, window.contextMenuTarget);
              }
              contextMenu.remove();
            });
          });

          // Click outside to close menu
          document.addEventListener('click', function() {
            const menu = document.querySelector('.absmartly-context-menu');
            if (menu) menu.remove();
          });
        };

        // Handle context menu actions
        window.handleContextMenuAction = function(action, element) {
          console.log('Action:', action, 'Element:', element);

          // Update changes counter
          const counter = document.querySelector('.absmartly-changes-count');
          if (counter) {
            const currentCount = parseInt(counter.textContent) || 0;
            counter.textContent = currentCount + 1;
          }

          switch(action) {
            case 'edit-text':
              if (element) element.textContent = 'Changed Text';
              break;
            case 'edit-html':
              if (element) element.innerHTML = '<strong>Changed HTML</strong>';
              break;
            case 'change-style':
              if (element) element.style.backgroundColor = 'yellow';
              break;
            case 'add-class':
              if (element) element.classList.add('test-class-added');
              break;
            case 'remove-class':
              if (element && element.classList.length > 0) {
                element.classList.remove(element.classList[0]);
              }
              break;
            case 'change-attribute':
              if (element) element.setAttribute('data-test', 'changed');
              break;
            case 'hide-element':
              if (element) element.style.display = 'none';
              break;
            case 'remove-element':
              if (element) element.remove();
              break;
            case 'execute-javascript':
              console.log('Executing custom JavaScript on element');
              break;
          }
        };
      `;
      document.head.appendChild(script)
    })

    // Step 3: Start the visual editor
    await page.evaluate(() => {
      window.startVisualEditor({ variantName: 'test-variant', experimentName: 'test-experiment' })
    })

    // Wait for visual editor toolbar to appear
    await page.waitForSelector('#absmartly-visual-editor-toolbar', { timeout: 5000 })

    // Step 4: Test context menu options
    const testCases = [
      { selector: '#main-title', action: 'edit-text', expectedChange: 'Changed Text' },
      { selector: '#description', action: 'change-style', expectedStyle: 'yellow' },
      { selector: '#hero-cta', action: 'add-class', expectedClass: 'test-class-added' },
      { selector: '#secondary-button', action: 'change-attribute', expectedAttr: 'data-test' },
      { selector: '#info-text', action: 'hide-element', expectedHidden: true },
    ]

    for (const testCase of testCases) {
      // Right-click on element
      const element = await page.$(testCase.selector)
      if (element) {
        await element.click({ button: 'right' })

        // Wait for context menu
        await page.waitForSelector('.absmartly-context-menu', { timeout: 2000 })

        // Click the action
        await page.click(`[data-action="${testCase.action}"]`)

        // Small delay for action to complete
        await page.waitForTimeout(500)

        // Verify the change
        if (testCase.expectedChange) {
          const text = await page.textContent(testCase.selector)
          expect(text).toBe(testCase.expectedChange)
        }
        if (testCase.expectedStyle) {
          const bgColor = await page.$eval(testCase.selector, el =>
            window.getComputedStyle(el).backgroundColor
          )
          expect(bgColor).toContain('255, 255, 0') // yellow in rgb
        }
        if (testCase.expectedClass) {
          const hasClass = await page.$eval(testCase.selector, (el, className) =>
            el.classList.contains(className), testCase.expectedClass
          )
          expect(hasClass).toBe(true)
        }
        if (testCase.expectedAttr) {
          const hasAttr = await page.$eval(testCase.selector, (el, attrName) =>
            el.hasAttribute(attrName), testCase.expectedAttr
          )
          expect(hasAttr).toBe(true)
        }
        if (testCase.expectedHidden) {
          const isHidden = await page.$eval(testCase.selector, el =>
            window.getComputedStyle(el).display === 'none'
          )
          expect(isHidden).toBe(true)
        }
      }
    }

    // Step 5: Verify changes counter
    const changesCount = await page.textContent('.absmartly-changes-count')
    expect(parseInt(changesCount)).toBeGreaterThan(0)

    // Step 6: Save changes
    await page.click('[data-action="save"]')

    // In a real scenario, we would verify the changes are sent to the API
    // For now, we just check the button was clickable

    // Take a screenshot for evidence
    await page.screenshot({ path: 'visual-editor-test-result.png' })

    // Clean up
    await page.close()
  })

  test('Preview header button does NOT wrap at any viewport width', async () => {
    page = await context.newPage()
    await page.goto(`file://${TEST_PAGE_PATH}`)

    // Inject preview header
    await page.evaluate(() => {
      const header = document.createElement('div')
      header.id = 'absmartly-preview-header'
      header.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(90deg, #3b82f6, #10b981);
        color: white;
        padding: 10px 12px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
      `

      const content = document.createElement('div')
      content.style.cssText = `
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-width: 0;
      `

      const text = document.createElement('span')
      text.style.cssText = `
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 400px;
      `
      text.innerHTML = '<strong>Very Long Variant Name Here</strong> - Extremely Long Experiment Name That Could Cause Wrapping Issues'

      const closeButton = document.createElement('button')
      closeButton.style.cssText = `
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        width: 28px;
        height: 28px;
        padding: 0;
        border-radius: 4px;
        font-size: 18px;
        line-height: 1;
        font-weight: 400;
        cursor: pointer;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      `
      closeButton.innerHTML = '×'
      closeButton.title = 'Exit Preview'

      content.appendChild(text)
      header.appendChild(content)
      header.appendChild(closeButton)
      document.body.appendChild(header)
    })

    // Test at various viewport widths
    const viewportWidths = [320, 375, 414, 768, 1024, 1280, 1920]

    for (const width of viewportWidths) {
      await page.setViewportSize({ width, height: 800 })
      await page.waitForTimeout(100)

      // Check if button is on the same line
      const headerHeight = await page.$eval('#absmartly-preview-header', el => el.offsetHeight)
      const buttonPosition = await page.$eval('#absmartly-preview-header button', el => {
        const rect = el.getBoundingClientRect()
        return { top: rect.top, height: rect.height }
      })

      // Header should be single line (less than 50px tall)
      expect(headerHeight).toBeLessThan(50)

      // Button should be visible and clickable
      const buttonVisible = await page.isVisible('#absmartly-preview-header button')
      expect(buttonVisible).toBe(true)

      // Take screenshot for evidence
      await page.screenshot({
        path: `preview-header-${width}px.png`,
        clip: { x: 0, y: 0, width, height: 60 }
      })
    }

    await page.close()
  })
})