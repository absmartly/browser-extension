import { ModelFetcher } from '../src/lib/model-fetcher'
import { OpenRouterProvider } from '../src/lib/ai-providers/openrouter'
import { GeminiProvider } from '../src/lib/ai-providers/gemini'
import { OpenAIProvider } from '../src/lib/ai-providers/openai'
import { AnthropicProvider } from '../src/lib/ai-providers/anthropic'
import type { AIProviderConfig } from '../src/lib/ai-providers/base'
import * as fs from 'fs'
import * as path from 'path'

// Mock browser globals for Node.js environment
;(global as any).chrome = {
  runtime: {
    getURL: (path: string) => `chrome-extension://test/${path}`
  }
}

// Mock captureHTMLChunks and queryXPath by monkey-patching the module
const htmlCaptureModule = require('../src/utils/html-capture')
htmlCaptureModule.captureHTMLChunks = async (selectors: string[]) => {
  return selectors.map(selector => ({
    selector,
    found: true,
    html: `<button class="cta-button" style="padding: 10px;">Click Me</button>`,
    error: null
  }))
}
htmlCaptureModule.queryXPath = async (xpath: string) => ({
  found: false,
  matches: [],
  error: 'XPath not used in this test'
})

function loadEnvFile(filename: string): Record<string, string> {
  const envPath = path.join(process.cwd(), filename)
  if (!fs.existsSync(envPath)) {
    return {}
  }

  const content = fs.readFileSync(envPath, 'utf-8')
  const vars: Record<string, string> = {}

  content.split('\n').forEach(line => {
    line = line.trim()
    if (!line || line.startsWith('#')) return

    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      const [, key, value] = match
      vars[key.trim()] = value.trim()
    }
  })

  return vars
}

const envVars = loadEnvFile('.env.dev.local')

const OPENROUTER_KEY = envVars.PLASMO_PUBLIC_OPENROUTER_API_KEY || ''
const GEMINI_KEY = envVars.PLASMO_PUBLIC_GEMINI_API_KEY || ''
const OPENAI_KEY = envVars.PLASMO_PUBLIC_OPENAI_API_KEY || ''
const ANTHROPIC_KEY = envVars.PLASMO_PUBLIC_ANTHROPIC_API_KEY || ''

const testHtml = `
<html>
  <body>
    <header>
      <h1 class="title">Welcome to Our Site</h1>
      <nav>
        <a href="/home">Home</a>
        <a href="/about">About</a>
      </nav>
    </header>
    <main>
      <button class="cta-button">Click Me</button>
    </main>
  </body>
</html>
`

const testPrompt = 'Change the button color to blue and make the text white'

async function testProvider(
  name: string,
  emoji: string,
  provider: any,
  model: string
): Promise<any> {
  console.log(`\n${emoji} Testing ${name}`)
  console.log('Model:', model)
  console.log('-'.repeat(80))

  try {
    console.log('⏳ Making API call...')

    const testTimeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Test timeout after 60 seconds')), 60000)
    })

    const result = await Promise.race([
      provider.generate(testHtml, testPrompt, [], undefined, {
        domStructure: '<html>\n  <body>\n    <header>...</header>\n    <main>\n      <button class="cta-button">...</button>\n    </main>\n  </body>\n</html>'
      }),
      testTimeout
    ])

    console.log('✅ SUCCESS!')
    console.log(`   DOM Changes: ${result.domChanges.length}`)
    console.log(`   Action: ${result.action}`)
    console.log(`   Response: ${result.response}`)

    if (result.domChanges.length > 0) {
      console.log('\n📦 DOM Changes Generated:')
      result.domChanges.forEach((change: any, i: number) => {
        console.log(`\n   [${i + 1}] ${change.type} on "${change.selector}":`)
        if (change.type === 'style' || change.type === 'css') {
          console.log(`       ${JSON.stringify(change.value || change.css, null, 6)}`)
        } else if (change.type === 'styleRules' && change.states) {
          console.log(`       States: ${Object.keys(change.states).join(', ')}`)
          console.log(`       Normal: ${JSON.stringify(change.states.normal, null, 6)}`)
        } else {
          console.log(`       Value: ${JSON.stringify(change.value, null, 6)}`)
        }
      })
    }

    return {
      success: true,
      model,
      domChanges: result.domChanges,
      response: result.response,
      action: result.action
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`❌ FAILED: ${errorMessage}`)

    return {
      success: false,
      model,
      error: errorMessage
    }
  }
}

async function main() {
  console.log('\n🧪 Complete Provider Integration Test')
  console.log('=' .repeat(80))
  console.log('Testing AI generation with real API keys\n')

  const results: any = {}

  // Test OpenAI
  if (OPENAI_KEY) {
    try {
      const models = await ModelFetcher.fetchOpenAIModels(OPENAI_KEY)
      const cheapest = models.find(m => m.id === 'gpt-3.5-turbo') || models[0]

      const config: AIProviderConfig = {
        apiKey: OPENAI_KEY,
        aiProvider: 'openai-api',
        llmModel: cheapest.id
      }
      const provider = new OpenAIProvider(config)
      results.openai = await testProvider('OpenAI', '🔵', provider, cheapest.id)
    } catch (error) {
      results.openai = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
      console.error('🔵 OpenAI: ❌', results.openai.error)
    }
  }

  // Test Gemini
  if (GEMINI_KEY) {
    try {
      const models = await ModelFetcher.fetchGeminiModels(GEMINI_KEY)
      const cheapest = models.find(m => m.id.toLowerCase().includes('flash')) || models[0]

      const config: AIProviderConfig = {
        apiKey: GEMINI_KEY,
        aiProvider: 'gemini-api',
        llmModel: cheapest.id
      }
      const provider = new GeminiProvider(config)
      results.gemini = await testProvider('Gemini', '🟢', provider, cheapest.id)
    } catch (error) {
      results.gemini = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
      console.error('🟢 Gemini: ❌', results.gemini.error)
    }
  }

  // Test OpenRouter
  if (OPENROUTER_KEY) {
    try {
      const groupedModels = await ModelFetcher.fetchOpenRouterModels(OPENROUTER_KEY)
      const allModels = Object.values(groupedModels).flat()

      const modelsWithPricing = allModels
        .filter(m => m.pricing && m.pricing.input > 0 && m.pricing.output > 0)
        .map(m => ({
          ...m,
          totalCost: (m.pricing!.input + m.pricing!.output) / 2
        }))
        .sort((a, b) => a.totalCost - b.totalCost)

      const cheapest = modelsWithPricing.find(m =>
        m.id.includes('google/gemini-flash') ||
        m.id.includes('meta-llama/llama-3') ||
        m.id.includes('mistral')
      ) || modelsWithPricing[0]

      const config: AIProviderConfig = {
        apiKey: OPENROUTER_KEY,
        aiProvider: 'openrouter-api',
        llmModel: cheapest.id
      }
      const provider = new OpenRouterProvider(config)
      results.openrouter = await testProvider(
        'OpenRouter',
        '🟣',
        provider,
        `${cheapest.id} ($${cheapest.pricing!.input.toFixed(4)}/$${cheapest.pricing!.output.toFixed(4)})`
      )
    } catch (error) {
      results.openrouter = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
      console.error('🟣 OpenRouter: ❌', results.openrouter.error)
    }
  }

  // Test Anthropic
  if (ANTHROPIC_KEY) {
    const models = ModelFetcher.getStaticAnthropicModels()
    const cheapest = models.find(m => m.name.includes('Haiku')) || models[models.length - 1]

    const config: AIProviderConfig = {
      apiKey: ANTHROPIC_KEY,
      aiProvider: 'anthropic-api',
      llmModel: cheapest.id
    }
    const provider = new AnthropicProvider(config)
    results.anthropic = await testProvider('Anthropic', '🟡', provider, cheapest.id)
  }

  // Summary
  console.log('\n\n' + '='.repeat(80))
  console.log('📊 FINAL RESULTS')
  console.log('='.repeat(80))

  const successCount = Object.values(results).filter((r: any) => r.success).length
  const totalCount = Object.keys(results).length

  console.log(`\n✅ Successful: ${successCount}/${totalCount} providers\n`)

  for (const [provider, result] of Object.entries(results)) {
    const emoji = provider === 'openai' ? '🔵' : provider === 'gemini' ? '🟢' : provider === 'openrouter' ? '🟣' : '🟡'
    if ((result as any).success) {
      console.log(`${emoji} ${provider.toUpperCase()}: ✅ Generated ${(result as any).domChanges.length} DOM changes`)
    } else {
      console.log(`${emoji} ${provider.toUpperCase()}: ❌ ${(result as any).error}`)
    }
  }

  console.log('\n' + '='.repeat(80) + '\n')
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error)
  process.exit(1)
})
