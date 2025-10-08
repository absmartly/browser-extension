import { test } from '@playwright/test'

test('Debug: Access plugin.instance', async ({ page }) => {
  page.on('console', msg => console.log(`[BROWSER]`, msg.text()))
  
  await page.goto('http://localhost:3456/url-filtering-test.html')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => { history.pushState({}, '', '/products/123') })
  await page.evaluate(() => {
    (window as any).absmartly = {
      Context: class {
        constructor() {}
        async ready() { return Promise.resolve() }
        data() { return { experiments: [{ name: 'test', variants: [
          { config: JSON.stringify({ __dom_changes: [] }) },
          { config: JSON.stringify({ __dom_changes: [{ selector: '#test-element', type: 'text', value: 'Test' }] }) }
        ]}]}}
        treatment() { return 1 }
        peek() { return 1 }
        override() {}
      }
    }
  })
  await page.addScriptTag({ path: 'public/absmartly-dom-changes-core.min.js' })
  await page.evaluate(() => {
    const context = new (window as any).absmartly.Context();
    (window as any).__testContext = context
    const plugin = new (window as any).ABsmartlyDOM.DOMChangesPlugin({
      context, autoApply: true, spa: true, dataSource: 'variable', dataFieldName: '__dom_changes', debug: true
    })
    return plugin.initialize()
  })
  await page.waitForTimeout(1000)

  const info = await page.evaluate(() => {
    const wrapper = (window as any).__testContext.__domPlugin
    const realPlugin = wrapper?.instance
    return {
      wrapperExists: !!wrapper,
      wrapperKeys: wrapper ? Object.keys(wrapper) : [],
      realPluginExists: !!realPlugin,
      realPluginKeys: realPlugin ? Object.keys(realPlugin).slice(0, 20) : [],
      hasExposureTracker: realPlugin && 'exposureTracker' in realPlugin,
      trackerType: realPlugin?.exposureTracker ? typeof realPlugin.exposureTracker : 'N/A',
      experimentsExists: !!realPlugin?.exposureTracker?.experiments,
      experimentsSize: realPlugin?.exposureTracker?.experiments?.size,
    }
  })
  
  console.log('Wrapper exists:', info.wrapperExists)
  console.log('Wrapper keys:', info.wrapperKeys)
  console.log('Real plugin exists:', info.realPluginExists)
  console.log('Real plugin keys:', info.realPluginKeys)
  console.log('Has exposureTracker:', info.hasExposureTracker)
  console.log('Tracker type:', info.trackerType)
  console.log('Experiments exists:', info.experimentsExists)
  console.log('Experiments size:', info.experimentsSize)
})
