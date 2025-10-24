import { test, expect } from '@playwright/test'
import path from 'path'

test('check for JavaScript errors when loading bundle', async ({ page }) => {
  const testPagePath = path.join(__dirname, 'test-page.html')
  const visualEditorBundlePath = path.join(__dirname, '../../build/chrome-mv3-dev/src/injected/build/visual-editor-injection.js')

  const errors: string[] = []
  const logs: string[] = []

  page.on('console', msg => {
    logs.push(`${msg.type()}: ${msg.text()}`)
  })

  page.on('pageerror', error => {
    errors.push(error.message)
  })

  // Navigate to test page
  await page.goto(`file://${testPagePath}`)

  // Inject visual editor script
  await page.addScriptTag({ path: visualEditorBundlePath })

  // Wait for script to execute by checking for window object
  await page.waitForFunction(() => {
    return document.readyState === 'complete'
  }, { timeout: 3000 }).catch(() => {})

  console.log('=== Console Logs ===')
  logs.forEach(log => console.log(log))

  console.log('\n=== Errors ===')
  errors.forEach(err => console.log(err))

  expect(errors.length).toBe(0)
})
