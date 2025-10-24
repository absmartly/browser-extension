import { test, expect } from '@playwright/test'
import path from 'path'

test('visual editor bundle should load and expose API', async ({ page }) => {
  const testPagePath = path.join(__dirname, 'test-page.html')
  const visualEditorBundlePath = path.join(__dirname, '../../build/chrome-mv3-dev/src/injected/build/visual-editor-injection.js')

  // Navigate to test page
  await page.goto(`file://${testPagePath}`)

  // Inject visual editor script
  await page.addScriptTag({ path: visualEditorBundlePath })

  // Check if API is available
  const apiCheck = await page.evaluate(() => {
    return {
      ABSmartlyVisualEditorType: typeof ABSmartlyVisualEditor,
      windowABSmartlyVisualEditorType: typeof window.ABSmartlyVisualEditor,
      ABSmartlyVisualEditorKeys: typeof ABSmartlyVisualEditor !== 'undefined' ? Object.keys(ABSmartlyVisualEditor).slice(0, 10) : [],
      initVisualEditorType: typeof (window.ABSmartlyVisualEditor && window.ABSmartlyVisualEditor.initVisualEditor)
    }
  })

  console.log('API Check:', JSON.stringify(apiCheck, null, 2))
  expect(apiCheck.ABSmartlyVisualEditorType).not.toBe('undefined')
  expect(apiCheck.windowABSmartlyVisualEditorType).not.toBe('undefined')
  expect(apiCheck.initVisualEditorType).toBe('function')
})
