import { createAIProvider, compressHtml, sanitizeHtml } from '~src/lib/ai-providers'
import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'

export async function generateDOMChanges(
  html: string,
  prompt: string,
  apiKey: string,
  currentChanges: DOMChange[] = [],
  images?: string[],
  options?: {
    useOAuth?: boolean
    oauthToken?: string
    aiProvider?: 'claude-subscription' | 'anthropic-api' | 'openai-api'
    conversationSession?: ConversationSession
    pageUrl?: string
    domStructure?: string
  }
): Promise<AIDOMGenerationResult & { session: ConversationSession }> {
  try {
    console.log('[AI Gen] 🤖 Generating DOM changes with AI...')
    console.log('[AI Gen] 📝 Prompt:', prompt)
    console.log('[AI Gen] 📄 HTML defined:', !!html)
    console.log('[AI Gen] 📄 HTML type:', typeof html)
    console.log('[AI Gen] 📄 HTML length:', html?.length || 'undefined')
    console.log('[AI Gen] 🖼️ Images:', images?.length || 0)
    console.log('[AI Gen] 💾 Has conversation session:', !!options?.conversationSession)
    console.log('[AI Gen] 🌐 Page URL:', options?.pageUrl)
    console.log('[AI Gen] 🌲 DOM Structure:', options?.domStructure ? `${options.domStructure.length} chars` : 'not provided')

    if (!html && !options?.conversationSession?.htmlSent) {
      throw new Error('HTML is required for the first message in a conversation')
    }

    const compressedHtml = html ? compressHtml(html) : ''
    const cleanHtml = html ? sanitizeHtml(compressedHtml) : ''
    if (html) {
      console.log('[AI Gen] Original HTML:', html.length, '→ Compressed:', compressedHtml.length, '→ Sanitized:', cleanHtml.length)
    } else {
      console.log('[AI Gen] Skipping HTML compression (using existing session HTML)')
    }

    const provider = createAIProvider({
      apiKey,
      aiProvider: options?.aiProvider || 'claude-subscription',
      useOAuth: options?.useOAuth,
      oauthToken: options?.oauthToken
    })

    console.log('[AI Gen] 🤖 Using provider:', options?.aiProvider || 'claude-subscription')

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

    console.log('[AI Gen] ✅ Generation successful')
    return result

  } catch (error) {
    console.error('❌ Failed to generate DOM changes:', error)
    throw error
  }
}

export type { AIDOMGenerationResult } from '~src/types/dom-changes'
