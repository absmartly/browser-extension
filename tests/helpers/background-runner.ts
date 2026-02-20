import type { Page } from '@playwright/test'

export class BackgroundRunner {
  private page: Page

  constructor(page: Page) {
    this.page = page
  }

  async initialize(buildPath: string) {
    // No-op: runtime polyfills and window.postMessage bridges are removed.
    await this.page.evaluate(() => {
      console.log('BackgroundRunner.initialize: no-op (native chrome.runtime messaging only)')
    })
  }
}