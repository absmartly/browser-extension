import type { DOMChange } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'
import { getSystemPromptOverride } from '~src/components/SystemPromptEditor'
import { AI_DOM_GENERATION_SYSTEM_PROMPT } from '~src/prompts/ai-dom-generation-system-prompt'

// Shared HTML sanitization - removes invalid Unicode characters
export function sanitizeHtml(htmlStr: string): string {
  let result = ''
  const chars = htmlStr.split('')

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]
    const code = char.charCodeAt(0)

    if (code >= 0xD800 && code <= 0xDBFF) {
      if (i + 1 < chars.length) {
        const nextCode = chars[i + 1].charCodeAt(0)
        if (nextCode >= 0xDC00 && nextCode <= 0xDFFF) {
          result += char + chars[i + 1]
          i++
          continue
        }
      }
      continue
    }

    if (code >= 0xDC00 && code <= 0xDFFF) {
      continue
    }

    if (code >= 0x00 && code <= 0x08) continue
    if (code === 0x0B || code === 0x0C) continue
    if (code >= 0x0E && code <= 0x1F) continue
    if (code === 0xFFFD) continue

    result += char
  }

  return result
}

// Shared HTML compression - removes extension elements and reduces size
export function compressHtml(html: string): string {
  if (!html) {
    console.error('[Compress] ❌ HTML is undefined or empty!')
    return ''
  }

  let compressed = html
  console.log('[Compress] Starting compression, original length:', html.length)

  const plasmoLoadingStart = compressed.indexOf('<div id="__plasmo-loading__"')
  if (plasmoLoadingStart !== -1) {
    let depth = 0
    let inTag = false
    let currentTag = ''
    let plasmoEnd = -1

    for (let i = plasmoLoadingStart; i < compressed.length; i++) {
      const char = compressed[i]

      if (char === '<') {
        inTag = true
        currentTag = ''
      } else if (char === '>') {
        inTag = false

        if (currentTag.startsWith('div') || currentTag.startsWith('div ')) {
          depth++
        } else if (currentTag === '/div') {
          depth--
          if (depth === 0) {
            plasmoEnd = i + 1
            break
          }
        }
        currentTag = ''
      } else if (inTag) {
        currentTag += char
      }
    }

    if (plasmoEnd !== -1) {
      console.log('[Compress] Removing Plasmo loading div:', plasmoEnd - plasmoLoadingStart, 'characters')
      compressed = compressed.substring(0, plasmoLoadingStart) + compressed.substring(plasmoEnd)
    }
  }

  const beforeOtherPlasmo = compressed.length
  compressed = compressed
    .replace(/<div[^>]*id="__plasmo"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<plasmo-csui[^>]*>[\s\S]*?<\/plasmo-csui>/gi, '')
    .replace(/<div[^>]*data-plasmo[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*id="absmartly-debug-[^"]*"[^>]*>.*?<\/div>/gi, '')

  console.log('[Compress] After other Plasmo removal:', compressed.length, 'Removed:', beforeOtherPlasmo - compressed.length)

  compressed = compressed
    .replace(/<iframe[^>]*id="absmartly-sidebar-iframe"[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<iframe[^>]*chrome-extension[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<div[^>]*id="absmartly-preview-header-host"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/\s+data-absmartly-preview-[a-z-]+="[^"]*"/gi, '')
    .replace(/\s+data-absmartly-original-[a-z-]+="[^"]*"/gi, '')
    .replace(/\s+data-absmartly-modified="[^"]*"/gi, '')
    .replace(/<div[^>]*class="[^"]*extension[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    // Remove noisy Framer framework attributes (keep data-framer-name as it's useful)
    .replace(/\s+data-framer-hydrate-v2="[^"]*"/gi, '')
    .replace(/\s+data-framer-appear-id="[^"]*"/gi, '')
    .replace(/\s+data-framer-ssr-released-at="[^"]*"/gi, '')
    .replace(/\s+data-framer-page-optimized-at="[^"]*"/gi, '')
    .replace(/\s+data-framer-generated-page="[^"]*"/gi, '')
    .replace(/\s+data-framer-component-type="[^"]*"/gi, '')
    .replace(/\s+data-styles-preset="[^"]*"/gi, '')
    .replace(/\s+data-framer-page-link-current="[^"]*"/gi, '')

  const beforeHeadStrip = compressed.length
  compressed = compressed.replace(/<head[^>]*>([\s\S]*?)<\/head>/gi, (match, headContent) => {
    let styleTags = (headContent.match(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi) || [])
      .filter(tag => {
        return !tag.includes('plasmo') &&
               !tag.includes('__plasmo') &&
               !tag.includes('data-plasmo') &&
               !tag.includes('data-framer-css-ssr-minified') &&
               !tag.includes('__framer-editorbar') &&
               !tag.includes('_goober') &&
               !tag.includes('type="text/css"')
      })
      .map(tag => {
        let cleaned = tag.replace(/@font-face\s*\{[^}]*\}/gi, '')
        cleaned = cleaned.replace(/\/\*\s*(vietnamese|latin-ext|latin|cyrillic-ext|cyrillic|greek)\s*\*\//gi, '')
        cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '')
        cleaned = cleaned.replace(/@import\s+url\([^)]+\);?/gi, '')
        return cleaned
      })
      .filter(tag => {
        const content = tag.replace(/<\/?style[^>]*>/gi, '').trim()
        return content.length > 0 && !content.match(/^\/\*[\s\S]*\*\/$/)
      })

    console.log('[Compress] Found', styleTags.length, 'essential style tags in head')
    return styleTags.length > 0 ? `<head>${styleTags.join('')}</head>` : '<head></head>'
  })
  console.log('[Compress] After head strip:', compressed.length, 'Removed:', beforeHeadStrip - compressed.length)

  return compressed
    .replace(/<div[^>]*id="__framer-editorbar-container"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<iframe[^>]*id="__framer-editorbar"[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<div[^>]*id="tooltip-root"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*id="hs-web-interactives-[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]*id="tldx-[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<tldx-lmi-shadow-root[^>]*>[\s\S]*?<\/tldx-lmi-shadow-root>/gi, '')
    .replace(/<iframe[^>]*owner="archetype"[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+style="[^"]*"/gi, '')
    .replace(/\s+on[a-z]+="[^"]*"/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .replace(/>\s+/g, '>')
    .replace(/\s+</g, '<')
    .trim()
}

export async function getSystemPrompt(chunkRetrievalPrompt: string): Promise<string> {
  const override = await getSystemPromptOverride()
  const basePrompt = override || AI_DOM_GENERATION_SYSTEM_PROMPT
  return basePrompt.replace('{{CHUNK_RETRIEVAL_DOCUMENTATION}}', chunkRetrievalPrompt)
}

export function createSession(conversationSession?: ConversationSession): ConversationSession {
  return conversationSession || {
    id: crypto.randomUUID(),
    htmlSent: false,
    messages: []
  }
}

export function buildUserMessage(prompt: string, currentChanges: DOMChange[]): string {
  let userMessageText = ''

  if (currentChanges.length > 0) {
    const sanitizedChanges = sanitizeHtml(JSON.stringify(currentChanges, null, 2))
    userMessageText += `Current DOM Changes:\n\`\`\`json\n${sanitizedChanges}\n\`\`\`\n\n`
  }

  const sanitizedPrompt = sanitizeHtml(prompt)
  userMessageText += `User Request: ${sanitizedPrompt}`

  return userMessageText
}
