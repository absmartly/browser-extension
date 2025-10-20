import { test as base, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import path from 'path'

export interface ExtensionFixtures {
  context: BrowserContext
  extensionId: string
  extensionPage: Page
  testPage: Page
}

export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    const pathToExtension = path.join(process.cwd(), 'build/chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      headless: true,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-dev-shm-usage'
      ],
      ignoreHTTPSErrors: true
    })
    await use(context)
    await context.close()
  },

  extensionId: async ({ context }, use) => {
    // Get extension ID from context
    let extensionId = ''
    
    // Try to find the extension page
    const pages = context.pages()
    for (const page of pages) {
      const url = page.url()
      if (url.startsWith('chrome-extension://')) {
        extensionId = url.split('://')[1].split('/')[0]
        break
      }
    }
    
    // If not found, navigate to popup to get extension ID
    if (!extensionId) {
      const page = await context.newPage()
      try {
        // Try to navigate to a generic extension page to get the ID
        await page.goto('chrome://extensions/')
        await page.waitForTimeout(1000)
        
        // Find extension in the list
        const extensions = await page.$$('[id^="extension-"]')
        if (extensions.length > 0) {
          const firstExt = extensions[0]
          const extId = await firstExt.getAttribute('id')
          if (extId) {
            extensionId = extId.replace('extension-', '')
          }
        }
      } catch (error) {
        console.log('Could not auto-detect extension ID:', error)
      }
      await page.close()
    }
    
    await use(extensionId)
  },

  extensionPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage()
    if (extensionId) {
      await page.goto(`chrome-extension://${extensionId}/popup.html`)
    }
    await use(page)
  },

  testPage: async ({ context }, use) => {
    const page = await context.newPage()
    await use(page)
  }
})

export { expect }