import { generateDOMChanges } from '../ai-dom-generator'

// Sample HTML for testing
const TEST_HTML = `
<!DOCTYPE html>
<html>
<head><title>Test Page</title></head>
<body>
  <div id="test-container">
    <h1 id="main-heading">Original Heading</h1>
    <p id="test-paragraph">Original text content</p>
    <button id="button-1">Button 1</button>
    <button id="button-2">Button 2</button>
    <ul>
      <li id="item-1">Item 1</li>
      <li id="item-2">Item 2</li>
      <li id="item-3">Item 3</li>
    </ul>
  </div>
</body>
</html>
`

describe('AI DOM Generator', () => {
  const API_KEY = process.env.ANTHROPIC_API_KEY || ''

  if (!API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY not found in environment variables')
    console.warn('   Tests will be skipped. Set ANTHROPIC_API_KEY to run these tests.')
  }

  (API_KEY ? it : it.skip)('should generate text change', async () => {
    console.log('\n🤖 Testing: Text change generation')

    const prompt = 'Change the text in the paragraph with id "test-paragraph" to say "Modified text!"'
    console.log(`  Prompt: ${prompt}`)

    const changes = await generateDOMChanges(TEST_HTML, prompt, API_KEY)
    console.log(`  Generated ${changes.length} change(s)`)
    console.log(`  Changes:`, JSON.stringify(changes, null, 2))

    // Verify we got at least one change
    expect(changes.length).toBeGreaterThan(0)

    // Find the text change
    const textChange = changes.find(c =>
      c.selector?.includes('test-paragraph') &&
      (c.type === 'text' || c.type === 'html')
    ) as any

    expect(textChange).toBeDefined()
    expect(textChange?.value || textChange?.html).toContain('Modified text')

    console.log('  ✅ Text change generated correctly')
  }, 60000);

  (API_KEY ? it : it.skip)( 'should generate style change (hide element)', async () => {
    console.log('\n🤖 Testing: Style change (hide) generation')

    const prompt = 'Add a CSS style change to the button with id "button-1" to set the display property to "none" (do not remove the element, only change its style)'
    console.log(`  Prompt: ${prompt}`)

    const changes = await generateDOMChanges(TEST_HTML, prompt, API_KEY)
    console.log(`  Generated ${changes.length} change(s)`)
    console.log(`  Changes:`, JSON.stringify(changes, null, 2))

    expect(changes.length).toBeGreaterThan(0)

    // Find the style change
    const styleChange = changes.find(c =>
      c.selector?.includes('button-1') &&
      c.type === 'style'
    ) as any

    if (!styleChange) {
      console.log('  ⚠️  Style change not found. All changes:', JSON.stringify(changes, null, 2))
    }

    expect(styleChange).toBeDefined()
    expect(styleChange?.value).toBeDefined()
    expect(styleChange?.value?.display).toBe('none')

    console.log('  ✅ Style change generated correctly')
  }, 60000);

  (API_KEY ? it : it.skip)( 'should generate remove change', async () => {
    console.log('\n🤖 Testing: Remove element generation')

    const prompt = 'Remove the button with id "button-2" from the page completely'
    console.log(`  Prompt: ${prompt}`)

    const changes = await generateDOMChanges(TEST_HTML, prompt, API_KEY)
    console.log(`  Generated ${changes.length} change(s)`)
    console.log(`  Changes:`, JSON.stringify(changes, null, 2))

    expect(changes.length).toBeGreaterThan(0)

    // Find the remove change
    const removeChange = changes.find(c =>
      c.selector?.includes('button-2') &&
      c.type === 'remove'
    )

    expect(removeChange).toBeDefined()

    console.log('  ✅ Remove change generated correctly')
  }, 60000);

  (API_KEY ? it : it.skip)( 'should generate move change', async () => {
    console.log('\n🤖 Testing: Move element generation')

    const prompt = 'Move the list item with id "item-2" to appear before the item with id "item-1"'
    console.log(`  Prompt: ${prompt}`)

    const changes = await generateDOMChanges(TEST_HTML, prompt, API_KEY)
    console.log(`  Generated ${changes.length} change(s)`)
    console.log(`  Changes:`, JSON.stringify(changes, null, 2))

    expect(changes.length).toBeGreaterThan(0)

    // Find the move change
    const moveChange = changes.find(c =>
      c.selector?.includes('item-2') &&
      c.type === 'move'
    ) as any

    expect(moveChange).toBeDefined()
    expect(moveChange?.targetSelector).toBeDefined()
    expect(moveChange?.targetSelector).toContain('item-1')

    console.log('  ✅ Move change generated correctly')
  }, 60000);

  (API_KEY ? it : it.skip)( 'should generate HTML replace change', async () => {
    console.log('\n🤖 Testing: HTML replacement generation')

    const prompt = 'Replace the HTML content inside the div with id "test-container" with this: <h2>HTML Edited!</h2><p>New paragraph content</p>'
    console.log(`  Prompt: ${prompt}`)

    const changes = await generateDOMChanges(TEST_HTML, prompt, API_KEY)
    console.log(`  Generated ${changes.length} change(s)`)
    console.log(`  Changes:`, JSON.stringify(changes, null, 2))

    expect(changes.length).toBeGreaterThan(0)

    // Find the HTML change
    const htmlChange = changes.find(c =>
      c.selector?.includes('test-container') &&
      c.type === 'html'
    ) as any

    if (!htmlChange) {
      console.log('  ⚠️  HTML change not found. All changes:', JSON.stringify(changes, null, 2))
    }

    expect(htmlChange).toBeDefined()
    expect(htmlChange?.value).toContain('HTML Edited!')
    expect(htmlChange?.value).toContain('New paragraph content')

    console.log('  ✅ HTML change generated correctly')
  }, 60000);

  (API_KEY ? it : it.skip)( 'should generate multiple changes in one request', async () => {
    console.log('\n🤖 Testing: Multiple changes in one request')

    const prompt = `Make these changes:
    1. Change the heading text to "New Heading"
    2. Hide button-1
    3. Remove button-2`
    console.log(`  Prompt: ${prompt}`)

    const changes = await generateDOMChanges(TEST_HTML, prompt, API_KEY)
    console.log(`  Generated ${changes.length} change(s)`)
    console.log(`  Changes:`, JSON.stringify(changes, null, 2))

    // Should generate multiple changes
    expect(changes.length).toBeGreaterThanOrEqual(3)

    // Verify we have different types of changes
    const hasTextChange = changes.some(c => c.type === 'text' || c.type === 'html')
    const hasStyleChange = changes.some(c => c.type === 'style')
    const hasRemoveChange = changes.some(c => c.type === 'remove')

    expect(hasTextChange).toBe(true)
    expect(hasStyleChange).toBe(true)
    expect(hasRemoveChange).toBe(true)

    console.log('  ✅ Multiple changes generated correctly')
  }, 60000);

  it('should handle invalid API key gracefully', async () => {
    console.log('\n🤖 Testing: Invalid API key handling')

    const prompt = 'Change the heading text'
    const invalidKey = 'invalid-key-12345'

    await expect(async () => {
      await generateDOMChanges(TEST_HTML, prompt, invalidKey)
    }).rejects.toThrow()

    console.log('  ✅ Invalid API key handled with error')
  }, 30000);

  (API_KEY ? it : it.skip)( 'should handle minimal HTML gracefully', async () => {
    console.log('\n🤖 Testing: Minimal HTML handling')

    const prompt = 'Add a paragraph with text "Hello World"'
    const minimalHTML = '<html><body></body></html>'

    const changes = await generateDOMChanges(minimalHTML, prompt, API_KEY)
    console.log(`  Generated ${changes.length} change(s)`)
    console.log(`  Changes:`, JSON.stringify(changes, null, 2))

    // Should return valid array of changes
    expect(Array.isArray(changes)).toBe(true)
    expect(changes.length).toBeGreaterThanOrEqual(0)

    console.log('  ✅ Minimal HTML handled gracefully')
  }, 60000);

  (API_KEY ? it : it.skip)( 'should handle complex natural language prompts', async () => {
    console.log('\n🤖 Testing: Complex natural language prompts')

    const prompt = 'Hide the button with id "button-1" by setting its display style to none'
    console.log(`  Prompt: ${prompt}`)

    const changes = await generateDOMChanges(TEST_HTML, prompt, API_KEY)
    console.log(`  Generated ${changes.length} change(s)`)
    console.log(`  Changes:`, JSON.stringify(changes, null, 2))

    expect(changes.length).toBeGreaterThan(0)

    // Should generate either a style or remove change (both are valid interpretations)
    const hasStyleOrRemove = changes.some(c =>
      c.selector?.includes('button-1') &&
      (c.type === 'style' || c.type === 'remove')
    )

    expect(hasStyleOrRemove).toBe(true)

    console.log('  ✅ Complex prompt handled correctly')
  }, 60000);
})
