import * as fs from 'fs'
import * as path from 'path'

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
const ANTHROPIC_KEY = envVars.PLASMO_PUBLIC_ANTHROPIC_API_KEY || ''
const ANTHROPIC_ENDPOINT = envVars.PLASMO_PUBLIC_ANTHROPIC_ENDPOINT || 'https://api.anthropic.com'

const systemPrompt = `You are a helpful assistant that generates DOM changes for A/B testing. When asked to change a button's color and text, respond with a JSON object containing:
{
  "domChanges": [{ "selector": ".cta-button", "type": "styleRules", "states": { "normal": { "background-color": "blue", "color": "white" } } }],
  "response": "I changed the button to blue with white text",
  "action": "append"
}`

const userPrompt = 'Change the button with class "cta-button" to have a blue background and white text'

async function testGemini() {
  console.log('\n🟢 Testing Gemini Direct API')
  console.log('-'.repeat(80))

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: systemPrompt }] },
            { role: 'model', parts: [{ text: 'I understand.' }] },
            { role: 'user', parts: [{ text: userPrompt }] }
          ],
          generationConfig: { maxOutputTokens: 2048 }
        })
      }
    )

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response'

    console.log('Response:', text)
    return { success: true, response: text }
  } catch (error) {
    console.error('Error:', error)
    return { success: false, error }
  }
}

async function testOpenRouter() {
  console.log('\n🟣 Testing OpenRouter Direct API')
  console.log('-'.repeat(80))

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://test.com',
        'X-Title': 'Test'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-haiku',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 2048
      })
    })

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || JSON.stringify(data)

    console.log('Response:', text)
    return { success: true, response: text }
  } catch (error) {
    console.error('Error:', error)
    return { success: false, error }
  }
}

async function testAnthropic() {
  console.log('\n🟡 Testing Anthropic Direct API')
  console.log('-'.repeat(80))

  try {
    const response = await fetch(`${ANTHROPIC_ENDPOINT}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-3-5-20241022',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || JSON.stringify(data)

    console.log('Response:', text)
    return { success: true, response: text }
  } catch (error) {
    console.error('Error:', error)
    return { success: false, error }
  }
}

async function main() {
  console.log('\n🧪 Direct API Test - Simple Prompt')
  console.log('='.repeat(80))

  const results = {
    gemini: await testGemini(),
    openrouter: await testOpenRouter(),
    anthropic: await testAnthropic()
  }

  console.log('\n' + '='.repeat(80))
  console.log('Summary:')
  console.log('  Gemini:', results.gemini.success ? '✅' : '❌')
  console.log('  OpenRouter:', results.openrouter.success ? '✅' : '❌')
  console.log('  Anthropic:', results.anthropic.success ? '✅' : '❌')
  console.log('='.repeat(80) + '\n')
}

main()
