import { describe, it, expect } from '@jest/globals'
import { generateDOMChanges } from '../ai-dom-generator'
import { TEST_IMAGES } from './test-images'

describe('AI Image Reading', () => {
  const apiKey = process.env.ANTHROPIC_API_KEY || ''
  const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === '1'

  const skipIfNoApiKey = (apiKey && runIntegrationTests) ? it : it.skip

  describe.skip('Anthropic API Tests (requires API key and RUN_INTEGRATION_TESTS=1)', () => {
    skipIfNoApiKey('should read text from an image using Claude', async () => {
    const imageDataUrl = TEST_IMAGES.HELLO

    const html = '<html><body><h1>Test Page</h1></body></html>'

    const result = await generateDOMChanges(
      html,
      'What text do you see in the image I attached?',
      apiKey,
      [],
      [imageDataUrl],
      { aiProvider: 'anthropic-api' }
    )

    expect(result).toBeDefined()
    expect(result.response).toBeDefined()
    expect(typeof result.response).toBe('string')
    expect(result.response.length).toBeGreaterThan(0)

    const responseText = result.response.toLowerCase()
    const mentionsHello = responseText.includes('hello')

    expect(mentionsHello).toBe(true)

    console.log('✓ Claude response:', result.response)
  }, 60000)

  skipIfNoApiKey('should handle multiple images with different text', async () => {
    const images = [
      TEST_IMAGES.HELLO,
      TEST_IMAGES.WORLD
    ]

    const html = '<html><body><h1>Test Page</h1></body></html>'

    const result = await generateDOMChanges(
      html,
      'I attached two images with words. What words do you see in each image?',
      apiKey,
      [],
      images,
      { aiProvider: 'anthropic-api' }
    )

    expect(result).toBeDefined()
    expect(result.response).toBeDefined()
    expect(typeof result.response).toBe('string')

    const responseText = result.response.toLowerCase()
    const mentionsHello = responseText.includes('hello')
    const mentionsWorld = responseText.includes('world')
    const mentionsMultipleImages = responseText.includes('two') || responseText.includes('both') || responseText.includes('first') || responseText.includes('second')

    expect(mentionsHello || mentionsWorld || mentionsMultipleImages).toBe(true)

    console.log('✓ Claude response:', result.response)
  }, 60000)

  skipIfNoApiKey('should work without images (backward compatibility)', async () => {
    const html = '<html><body><h1>Test Page</h1><button id="cta">Click Me</button></body></html>'

    const result = await generateDOMChanges(
      html,
      'Change the button text to "Submit"',
      apiKey,
      [],
      undefined,
      { aiProvider: 'anthropic-api' }
    )

    expect(result).toBeDefined()
    expect(result.domChanges || result.response).toBeDefined()

    const hasChanges = result.domChanges && result.domChanges.length > 0
    const hasResponse = result.response && result.response.length > 0

    expect(hasChanges || hasResponse).toBe(true)

    console.log('✓ AI generation works without images')
  }, 60000)

  skipIfNoApiKey('should handle image with simple visual prompt', async () => {
    const blueSquareImageUrl = TEST_IMAGES.BLUE_SQUARE

    const html = '<html><body><h1>Test</h1></body></html>'

    const result = await generateDOMChanges(
      html,
      'What do you see in this image?',
      apiKey,
      [],
      [blueSquareImageUrl],
      { aiProvider: 'anthropic-api' }
    )

    expect(result).toBeDefined()
    expect(result.response).toBeDefined()

    const responseText = result.response.toLowerCase()
    const describesImage =
      responseText.includes('blue') ||
      responseText.includes('square') ||
      responseText.includes('rectangle') ||
      responseText.includes('shape') ||
      responseText.includes('see')

    expect(describesImage).toBe(true)

      console.log('✓ Claude response:', result.response)
    }, 60000)
  })

  describe('Claude Code Bridge Tests (no API key required)', () => {
    it.skip('should generate DOM changes via bridge with text prompt', async () => {
      const html = '<html><body><h1>Test Page</h1><button id="cta">Click Me</button></body></html>'

      const result = await generateDOMChanges(
        html,
        'Change the button text to "Submit"',
        '',
        [],
        undefined
      )

      expect(result).toBeDefined()
      expect(result.domChanges || result.response).toBeDefined()

      const hasChanges = result.domChanges && result.domChanges.length > 0
      const hasResponse = result.response && result.response.length > 0

      expect(hasChanges || hasResponse).toBe(true)

      console.log('✓ Bridge generation works without API key')
    }, 60000)

    it.skip('should handle image with bridge', async () => {
      const imageDataUrl = TEST_IMAGES.BLUE_SQUARE

      const html = '<html><body><h1>Test</h1></body></html>'

      const result = await generateDOMChanges(
        html,
        'What do you see in this image?',
        '',
        [],
        [imageDataUrl]
      )

      expect(result).toBeDefined()
      expect(result.response).toBeDefined()

      console.log('✓ Bridge handles images:', result.response.substring(0, 100))
    }, 60000)
  })
})
