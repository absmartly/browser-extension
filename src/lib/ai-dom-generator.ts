import { createAIProvider, compressHtml, sanitizeHtml } from '~src/lib/ai-providers'
import type { AIProviderType } from '~src/lib/ai-providers'
import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'
import { debugLog, debugError } from '~src/utils/debug'

export async function generateDOMChanges(
  html: string,
  prompt: string,
  apiKey: string,
  currentChanges: DOMChange[] = [],
  images?: string[],
  options?: {
    useOAuth?: boolean
    oauthToken?: string
    aiProvider?: AIProviderType
    conversationSession?: ConversationSession
    pageUrl?: string
    domStructure?: string
    llmModel?: string
    customEndpoint?: string
  }
): Promise<AIDOMGenerationResult & { session: ConversationSession }> {
  const providerName = options?.aiProvider || 'claude-subscription'

  debugLog('[AI Gen] Generating DOM changes', {
    provider: providerName,
    htmlLength: html?.length || 0,
    images: images?.length || 0,
    hasSession: !!options?.conversationSession,
    model: options?.llmModel || 'default'
  })

  if (!html && !options?.conversationSession?.htmlSent) {
    throw new Error('HTML is required for the first message in a conversation')
  }

  const compressedHtml = html ? compressHtml(html) : ''
  const cleanHtml = html ? sanitizeHtml(compressedHtml) : ''

  if (html) {
    debugLog('[AI Gen] HTML compression:', html.length, '->', compressedHtml.length, '->', cleanHtml.length)
  }

  const provider = createAIProvider({
    apiKey,
    aiProvider: providerName,
    useOAuth: options?.useOAuth,
    oauthToken: options?.oauthToken,
    llmModel: options?.llmModel,
    customEndpoint: options?.customEndpoint
  })

  const result = await provider.generate(
    cleanHtml,
    prompt,
    currentChanges,
    images,
    {
      conversationSession: options?.conversationSession,
      pageUrl: options?.pageUrl,
      domStructure: options?.domStructure
    }
  )

  debugLog('[AI Gen] Generation successful:', result.domChanges.length, 'changes')
  return result
}

export type { AIDOMGenerationResult } from '~src/types/dom-changes'
