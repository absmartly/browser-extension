# AI Provider Integration Guide

## Supported Providers

The ABsmartly Browser Extension supports 5 AI providers for generating DOM changes:

### 1. Claude Subscription (Default)
- **Type:** Local bridge to Claude CLI
- **Cost:** Included with Claude subscription
- **Models:** Sonnet, Opus, Haiku
- **Setup:** Requires `@absmartly/claude-code-bridge` running locally

### 2. Anthropic API
- **Type:** Direct Anthropic API
- **Cost:** Pay-as-you-go ($0.25-$15 per 1M tokens)
- **Models:** 4 Claude models (static list)
  - Claude 3.5 Sonnet (Latest) - Most capable
  - Claude 3 Opus - Highest quality
  - Claude 3 Sonnet - Balanced
  - Claude 3 Haiku - Fastest & cheapest
- **API Key:** Get from https://console.anthropic.com/

### 3. OpenAI API
- **Type:** Direct OpenAI API
- **Cost:** Pay-as-you-go ($0.50-$30 per 1M tokens)
- **Models:** 86 models (dynamically fetched)
  - GPT-4 Turbo, GPT-4, GPT-3.5 Turbo
  - Realtime and specialized models
- **API Key:** Get from https://platform.openai.com/api-keys
- **Cheapest:** gpt-3.5-turbo

### 4. Google Gemini API
- **Type:** Direct Google Generative AI API
- **Cost:** Free tier available, then pay-as-you-go
- **Models:** 29 models (dynamically fetched)
  - Gemini 2.5 Pro (1024K context)
  - Gemini 2.5 Flash (1024K context) - Fastest & cheapest
  - Gemini 2.0 Flash
  - Gemini Pro (legacy)
- **API Key:** Get from https://makersuite.google.com/app/apikey
- **Cheapest:** gemini-2.5-flash

### 5. OpenRouter API ⭐ Best Value
- **Type:** Multi-provider aggregator
- **Cost:** Variable by model ($0.01-$50+ per 1M tokens)
- **Models:** 347 models from 58 providers! (dynamically fetched)
  - All major providers: OpenAI, Anthropic, Google, Meta, Mistral, Cohere, etc.
  - Open source models: Llama, Mixtral, Qwen, etc.
  - Specialized models: Vision, code, reasoning
- **API Key:** Get from https://openrouter.ai/keys
- **Cheapest:** liquid/lfm2-8b-a1b ($0.01/$0.02 per 1M tokens)
- **Best Feature:** Access all providers with one API key

## Feature Comparison

| Feature | Claude Sub | Anthropic | OpenAI | Gemini | OpenRouter |
|---------|-----------|-----------|---------|---------|------------|
| **Models** | 3 | 4 | 86 | 29 | 347 |
| **Dynamic List** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Grouped Display** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Pricing Info** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Free Tier** | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Local Processing** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Multi-Provider** | ❌ | ❌ | ❌ | ❌ | ✅ |

## Test Results (2026-01-28)

All providers successfully tested with real API keys:

### ✅ OpenAI (86 models)
- Fetched from `/v1/models` endpoint
- Cheapest: `gpt-3.5-turbo`
- Sample models: GPT-4 Turbo, GPT-4, GPT-3.5 Turbo

### ✅ Gemini (29 models)
- Fetched from `/v1beta/models` endpoint
- Cheapest: `gemini-2.5-flash` (1024K context)
- Sample models: Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.0 Flash

### ✅ OpenRouter (347 models from 58 providers!)
- Fetched from `/v1/models` endpoint
- Cheapest: `liquid/lfm2-8b-a1b` ($0.01/$0.02 per 1M tokens)
- Providers include: Anthropic, OpenAI, Google, Meta, Mistral, Cohere, Deepseek, and 51 more

### ✅ Anthropic (4 static models)
- No API endpoint for model listing
- Cheapest: `claude-3-haiku-20240307`
- All models have 200K context window

## Implementation Details

### Model Fetching Architecture
- **Session-based caching:** Models fetched once per extension session
- **Automatic refresh:** Clears on extension reload
- **Error fallback:** Falls back to static list if API fails
- **Concurrent protection:** Deduplicates simultaneous fetches
- **Non-blocking UI:** Loading states while fetching

### Provider Classes
All providers implement the `AIProvider` interface:
```typescript
interface AIProvider {
  generate(html, prompt, changes, images, options): Promise<Result>
  getToolDefinition(): any
  getChunkRetrievalPrompt(): string
}
```

### Tool Support
All providers support:
- `dom_changes_generator` - Final DOM changes output
- `css_query` - Inspect page sections by CSS selector
- `xpath_query` - Complex element queries with XPath

### Agentic Loop
All providers use an agentic loop (max 10 iterations) that:
1. Sends prompt to AI
2. AI calls tools to inspect page
3. Tools return HTML snippets
4. AI generates DOM changes
5. Returns validated result

## Usage in Extension

### Setup Steps

1. Open extension settings
2. Select AI provider from dropdown
3. Enter API key (or configure Claude bridge)
4. Model list populates automatically
5. Select desired model
6. Save settings

### Model Selection
- **OpenAI/Gemini:** Simple dropdown with model names
- **OpenRouter:** Grouped by provider with pricing info
- **Anthropic:** Dropdown with 4 Claude models

### Error Handling
- Invalid API key: Shows error with link to get new key
- Model fetch failure: Retry button available
- Network errors: Falls back to static list where available

## Cost Optimization

**Cheapest Options:**
1. **Gemini Free Tier:** gemini-2.5-flash (free quota available)
2. **OpenRouter:** liquid/lfm2-8b-a1b ($0.01/$0.02 per 1M)
3. **Anthropic:** claude-3-haiku ($0.25/$1.25 per 1M)
4. **OpenAI:** gpt-3.5-turbo ($0.50/$1.50 per 1M)

**Best Balance:**
- **For quality:** Anthropic Claude 3.5 Sonnet via OpenRouter
- **For speed:** Gemini 2.5 Flash
- **For variety:** OpenRouter (access to all providers)

## Troubleshooting

### Models not loading
- Check API key is valid
- Click retry button
- Check console for errors
- Reload extension

### API errors during generation
- Verify API key has credits/quota
- Check model is still available
- Try different model
- Check network connection

### Provider not in dropdown
- Update extension to latest version
- Clear browser cache
- Reload extension

## Development

### Adding New Providers

1. Create provider class in `src/lib/ai-providers/`
2. Implement `AIProvider` interface
3. Add to factory in `factory.ts`
4. Update `AIProviderConfig` type in `base.ts`
5. Add UI in `AIProviderSection.tsx`
6. Create unit tests
7. Update this documentation

### Testing Providers

```bash
# Run unit tests
npm run test:unit -- openai.test.ts gemini.test.ts openrouter.test.ts

# Run integration test (model fetching only)
npx tsx scripts/test-providers-simple.ts
```

Note: Full AI generation testing requires browser environment (extension context).
