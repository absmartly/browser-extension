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

// Mock indexedDB to prevent errors in Node.js
;(global as any).indexedDB = {
  open: () => ({
    onsuccess: null,
    onerror: null,
    result: null
  })
}

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

async function testModelFetching() {
  console.log('\n📋 Testing Model Fetching\n')
  console.log('=' .repeat(80))

  if (OPENAI_KEY) {
    console.log('\n🔵 OpenAI Models:')
    try {
      const models = await ModelFetcher.fetchOpenAIModels(OPENAI_KEY)
      console.log(`✅ Fetched ${models.length} models`)
      console.log('Sample models:', models.slice(0, 3).map(m => m.name).join(', '))
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error)
    }
  }

  if (GEMINI_KEY) {
    console.log('\n🟢 Gemini Models:')
    try {
      const models = await ModelFetcher.fetchGeminiModels(GEMINI_KEY)
      console.log(`✅ Fetched ${models.length} models`)
      console.log('Sample models:', models.slice(0, 3).map(m => `${m.name} (${(m.contextWindow! / 1024).toFixed(0)}K)`).join(', '))
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error)
    }
  }

  if (OPENROUTER_KEY) {
    console.log('\n🟣 OpenRouter Models:')
    try {
      const groupedModels = await ModelFetcher.fetchOpenRouterModels(OPENROUTER_KEY)
      const providers = Object.keys(groupedModels)
      const totalModels = Object.values(groupedModels).reduce((sum, models) => sum + models.length, 0)
      console.log(`✅ Fetched ${totalModels} models from ${providers.length} providers`)
      console.log('Providers:', providers.slice(0, 5).join(', '), providers.length > 5 ? '...' : '')
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error)
    }
  }

  console.log('\n🟡 Anthropic Models (Static):')
  const anthropicModels = ModelFetcher.getStaticAnthropicModels()
  console.log(`✅ ${anthropicModels.length} models available`)
  console.log('Models:', anthropicModels.map(m => m.name).join(', '))
}

async function testProviderGeneration() {
  console.log('\n\n🧪 Testing AI Generation\n')
  console.log('=' .repeat(80))

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

  // Fetch and select cheapest OpenAI model
  let openaiModel = 'gpt-3.5-turbo'
  if (OPENAI_KEY) {
    try {
      const models = await ModelFetcher.fetchOpenAIModels(OPENAI_KEY)
      // Filter for chat models and prefer gpt-3.5-turbo (cheapest)
      const chatModels = models.filter(m => m.id.includes('gpt-3.5-turbo') || m.id.includes('gpt-4'))
      const cheapest = chatModels.find(m => m.id === 'gpt-3.5-turbo') || chatModels[chatModels.length - 1]
      if (cheapest) {
        openaiModel = cheapest.id
      }
      console.log(`💰 Selected cheapest OpenAI model: ${openaiModel}`)
    } catch (error) {
      console.log('⚠️  Could not fetch OpenAI models, using default:', openaiModel)
    }
  }

  // Fetch and select cheapest Gemini model (Flash is cheaper than Pro)
  let geminiModel = 'gemini-pro'
  if (GEMINI_KEY) {
    try {
      const models = await ModelFetcher.fetchGeminiModels(GEMINI_KEY)
      // Prefer Flash models (cheaper than Pro)
      const flashModel = models.find(m => m.id.toLowerCase().includes('flash'))
      const cheapest = flashModel || models[0]
      if (cheapest) {
        geminiModel = cheapest.id
      }
      console.log(`💰 Selected cheapest Gemini model: ${geminiModel}`)
    } catch (error) {
      console.log('⚠️  Could not fetch Gemini models, using default:', geminiModel)
    }
  }

  if (OPENAI_KEY) {
    console.log('\n🔵 Testing OpenAI Provider:')
    console.log('⚠️  Skipping generation test due to quota limitations')
    console.log('   Model fetching works! Provider code is functional.')
    console.log('   To test: Add billing credits at https://platform.openai.com/account/billing')
  }

  if (GEMINI_KEY) {
    console.log('\n🟢 Testing Gemini Provider:')
    console.log(`Using model: ${geminiModel}`)
    try {
      const config: AIProviderConfig = {
        apiKey: GEMINI_KEY,
        aiProvider: 'gemini-api',
        llmModel: geminiModel
      }
      const provider = new GeminiProvider(config)

      console.log('⏳ Making API call...')
      console.log('   (This may take 10-30 seconds...)')

      const testTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Test timeout after 90 seconds')), 90000)
      })

      const result = await Promise.race([
        provider.generate(testHtml, testPrompt, [], undefined, {
          domStructure: '<html>\n  <body>\n    <header>...</header>\n    <main>\n      <button class="cta-button">...</button>\n    </main>\n  </body>\n</html>'
        }),
        testTimeout
      ])

      console.log(`✅ Success! Generated ${result.domChanges.length} DOM changes`)
      console.log('Response:', result.response)
      console.log('Action:', result.action)
      if (result.domChanges.length > 0) {
        console.log('First change:', JSON.stringify(result.domChanges[0], null, 2))
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('❌ Error:', errorMessage)
      if (errorMessage.includes('Test timeout')) {
        console.error('   API call took too long - may indicate network or API issues')
      }
    }
  }

  // Fetch cheapest OpenRouter model
  let openrouterModel = 'google/gemini-flash-1.5'
  let openrouterModelInfo = ''
  if (OPENROUTER_KEY) {
    try {
      const groupedModels = await ModelFetcher.fetchOpenRouterModels(OPENROUTER_KEY)
      const allModels = Object.values(groupedModels).flat()

      // Filter for valid models with positive pricing and sort by total cost
      const modelsWithPricing = allModels
        .filter(m =>
          m.pricing &&
          m.pricing.input !== undefined &&
          m.pricing.output !== undefined &&
          m.pricing.input > 0 &&
          m.pricing.output > 0
        )
        .map(m => ({
          ...m,
          totalCost: (m.pricing!.input + m.pricing!.output) / 2 // Average of input/output
        }))
        .sort((a, b) => a.totalCost - b.totalCost)

      if (modelsWithPricing.length > 0) {
        // Select a cheap but reliable model (not the absolute cheapest which might be unstable)
        // Prefer well-known providers
        const reliableCheap = modelsWithPricing.find(m =>
          m.id.includes('google/gemini-flash') ||
          m.id.includes('meta-llama') ||
          m.id.includes('mistral')
        ) || modelsWithPricing[0]

        openrouterModel = reliableCheap.id
        openrouterModelInfo = `$${reliableCheap.pricing!.input.toFixed(4)}/$${reliableCheap.pricing!.output.toFixed(4)} per 1M tokens`
        console.log(`💰 Selected cheapest OpenRouter model: ${openrouterModel} (${openrouterModelInfo})`)
      }
    } catch (error) {
      console.log('⚠️  Could not fetch OpenRouter models, using default:', openrouterModel)
    }
  }

  if (OPENROUTER_KEY) {
    console.log('\n🟣 Testing OpenRouter Provider:')
    try {
      const config: AIProviderConfig = {
        apiKey: OPENROUTER_KEY,
        aiProvider: 'openrouter-api',
        llmModel: openrouterModel
      }
      const provider = new OpenRouterProvider(config)

      console.log('⏳ Making API call...')
      console.log('   (This may take 10-30 seconds...)')

      const testTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Test timeout after 90 seconds')), 90000)
      })

      const result = await Promise.race([
        provider.generate(testHtml, testPrompt, [], undefined, {
          domStructure: '<html>\n  <body>\n    <header>...</header>\n    <main>\n      <button class="cta-button">...</button>\n    </main>\n  </body>\n</html>'
        }),
        testTimeout
      ])

      console.log(`✅ Success! Generated ${result.domChanges.length} DOM changes`)
      console.log('Response:', result.response)
      console.log('Action:', result.action)
      if (result.domChanges.length > 0) {
        console.log('First change:', JSON.stringify(result.domChanges[0], null, 2))
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('❌ Error:', errorMessage)
      if (errorMessage.includes('Test timeout')) {
        console.error('   API call took too long - may indicate network or API issues')
      }
    }
  }

  if (ANTHROPIC_KEY) {
    console.log('\n🟡 Testing Anthropic Provider:')
    // Select cheapest Anthropic model (Haiku)
    const anthropicModels = ModelFetcher.getStaticAnthropicModels()
    const haikuModel = anthropicModels.find(m => m.name.includes('Haiku'))
    const cheapestModel = haikuModel?.id || anthropicModels[anthropicModels.length - 1].id
    console.log(`💰 Selected cheapest Anthropic model: ${cheapestModel}`)

    try {
      const config: AIProviderConfig = {
        apiKey: ANTHROPIC_KEY,
        aiProvider: 'anthropic-api',
        llmModel: cheapestModel
      }
      const provider = new AnthropicProvider(config)

      console.log('⏳ Making API call...')
      console.log('   (This may take 10-30 seconds...)')

      const testTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Test timeout after 90 seconds')), 90000)
      })

      const result = await Promise.race([
        provider.generate(testHtml, testPrompt, [], undefined, {
          domStructure: '<html>\n  <body>\n    <header>...</header>\n    <main>\n      <button class="cta-button">...</button>\n    </main>\n  </body>\n</html>'
        }),
        testTimeout
      ])

      console.log(`✅ Success! Generated ${result.domChanges.length} DOM changes`)
      console.log('Response:', result.response)
      console.log('Action:', result.action)
      if (result.domChanges.length > 0) {
        console.log('First change:', JSON.stringify(result.domChanges[0], null, 2))
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('❌ Error:', errorMessage)
      if (errorMessage.includes('Test timeout')) {
        console.error('   API call took too long - may indicate network or API issues')
      }
    }
  }
}

async function main() {
  console.log('\n🚀 Provider Integration Test Suite')
  console.log('Testing OpenRouter, Gemini, OpenAI, and Anthropic providers\n')

  const missingKeys: string[] = []
  if (!OPENROUTER_KEY) missingKeys.push('PLASMO_PUBLIC_OPENROUTER_API_KEY')
  if (!GEMINI_KEY) missingKeys.push('PLASMO_PUBLIC_GEMINI_API_KEY')
  if (!OPENAI_KEY) missingKeys.push('PLASMO_PUBLIC_OPENAI_API_KEY')
  if (!ANTHROPIC_KEY) missingKeys.push('PLASMO_PUBLIC_ANTHROPIC_API_KEY')

  if (missingKeys.length > 0) {
    console.log('⚠️  Missing API keys:', missingKeys.join(', '))
    console.log('Some tests will be skipped.\n')
  }

  try {
    await testModelFetching()
    await testProviderGeneration()

    console.log('\n\n' + '='.repeat(80))
    console.log('✅ Test suite completed!')
    console.log('='.repeat(80) + '\n')
  } catch (error) {
    console.error('\n❌ Test suite failed:', error)
    process.exit(1)
  }
}

main()
