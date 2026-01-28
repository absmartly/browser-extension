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

  // Fetch Gemini models to get a valid model name
  let geminiModel = 'gemini-pro'
  if (GEMINI_KEY) {
    try {
      const models = await ModelFetcher.fetchGeminiModels(GEMINI_KEY)
      if (models.length > 0) {
        geminiModel = models[0].id
      }
    } catch (error) {
      console.log('⚠️  Could not fetch Gemini models, using default:', geminiModel)
    }
  }

  if (OPENAI_KEY) {
    console.log('\n🔵 Testing OpenAI Provider:')
    try {
      const config: AIProviderConfig = {
        apiKey: OPENAI_KEY,
        aiProvider: 'openai-api',
        llmModel: 'gpt-4-turbo'
      }
      const provider = new OpenAIProvider(config)

      console.log('⏳ Making API call...')
      const result = await provider.generate(testHtml, testPrompt, [], undefined, {
        domStructure: '<html>\n  <body>\n    <header>...</header>\n    <main>\n      <button class="cta-button">...</button>\n    </main>\n  </body>\n</html>'
      })

      console.log(`✅ Success! Generated ${result.domChanges.length} DOM changes`)
      console.log('Response:', result.response)
      console.log('Action:', result.action)
      if (result.domChanges.length > 0) {
        console.log('First change:', JSON.stringify(result.domChanges[0], null, 2))
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('quota') || errorMessage.includes('429')) {
        console.error('⚠️  Quota exceeded - OpenAI account needs billing credits added')
        console.error('   Visit: https://platform.openai.com/account/billing')
      } else {
        console.error('❌ Error:', errorMessage)
      }
    }
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
      const result = await provider.generate(testHtml, testPrompt, [], undefined, {
        domStructure: '<html>\n  <body>\n    <header>...</header>\n    <main>\n      <button class="cta-button">...</button>\n    </main>\n  </body>\n</html>'
      })

      console.log(`✅ Success! Generated ${result.domChanges.length} DOM changes`)
      console.log('Response:', result.response)
      console.log('Action:', result.action)
      if (result.domChanges.length > 0) {
        console.log('First change:', JSON.stringify(result.domChanges[0], null, 2))
      }
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error)
    }
  }

  // Fetch OpenRouter model to use
  let openrouterModel = 'anthropic/claude-3-5-sonnet'
  if (OPENROUTER_KEY) {
    try {
      const groupedModels = await ModelFetcher.fetchOpenRouterModels(OPENROUTER_KEY)
      const allModels = Object.values(groupedModels).flat()
      if (allModels.length > 0) {
        // Prefer Claude if available, otherwise use first model
        const claudeModel = allModels.find(m => m.id.includes('claude'))
        openrouterModel = claudeModel?.id || allModels[0].id
      }
    } catch (error) {
      console.log('⚠️  Could not fetch OpenRouter models, using default:', openrouterModel)
    }
  }

  if (OPENROUTER_KEY) {
    console.log('\n🟣 Testing OpenRouter Provider:')
    console.log(`Using model: ${openrouterModel}`)
    try {
      const config: AIProviderConfig = {
        apiKey: OPENROUTER_KEY,
        aiProvider: 'openrouter-api',
        llmModel: openrouterModel
      }
      const provider = new OpenRouterProvider(config)

      console.log('⏳ Making API call...')
      const result = await provider.generate(testHtml, testPrompt, [], undefined, {
        domStructure: '<html>\n  <body>\n    <header>...</header>\n    <main>\n      <button class="cta-button">...</button>\n    </main>\n  </body>\n</html>'
      })

      console.log(`✅ Success! Generated ${result.domChanges.length} DOM changes`)
      console.log('Response:', result.response)
      console.log('Action:', result.action)
      if (result.domChanges.length > 0) {
        console.log('First change:', JSON.stringify(result.domChanges[0], null, 2))
      }
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error)
    }
  }

  if (ANTHROPIC_KEY) {
    console.log('\n🟡 Testing Anthropic Provider:')
    try {
      const config: AIProviderConfig = {
        apiKey: ANTHROPIC_KEY,
        aiProvider: 'anthropic-api',
        llmModel: 'claude-3-5-sonnet-20241022'
      }
      const provider = new AnthropicProvider(config)

      console.log('⏳ Making API call...')
      const result = await provider.generate(testHtml, testPrompt, [], undefined, {
        domStructure: '<html>\n  <body>\n    <header>...</header>\n    <main>\n      <button class="cta-button">...</button>\n    </main>\n  </body>\n</html>'
      })

      console.log(`✅ Success! Generated ${result.domChanges.length} DOM changes`)
      console.log('Response:', result.response)
      console.log('Action:', result.action)
      if (result.domChanges.length > 0) {
        console.log('First change:', JSON.stringify(result.domChanges[0], null, 2))
      }
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error)
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
