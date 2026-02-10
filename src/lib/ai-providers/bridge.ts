import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'
import type { AIProvider, AIProviderConfig, GenerateOptions } from './base'
import { getBridgeProviderName } from './base'
import { getSystemPrompt, buildUserMessage } from './utils'
import { SHARED_TOOL_SCHEMA } from './shared-schema'
import { ClaudeCodeBridgeClient } from '~src/lib/claude-code-client'
import { BRIDGE_CHUNK_RETRIEVAL_PROMPT } from './chunk-retrieval-prompts'
import { validateAIDOMGenerationResult, type ValidationError } from './validation'
import { debugLog, debugWarn } from '~src/utils/debug'
import { unsafeSessionId, unsafeConversationId } from '~src/types/branded'

export class BridgeProvider implements AIProvider {
  private bridgeClient: ClaudeCodeBridgeClient

  constructor(private config: AIProviderConfig) {
    this.bridgeClient = new ClaudeCodeBridgeClient()
  }

  getChunkRetrievalPrompt(): string {
    return BRIDGE_CHUNK_RETRIEVAL_PROMPT
  }

  getToolDefinition() {
    return SHARED_TOOL_SCHEMA
  }

  async generate(
    html: string,
    prompt: string,
    currentChanges: DOMChange[] = [],
    images: string[] | undefined,
    options: GenerateOptions
  ): Promise<AIDOMGenerationResult & { session: ConversationSession }> {
    debugLog('[Bridge] generateWithBridge() called')

    try {
      debugLog('[Bridge] About to call bridgeClient.connect()...')
      await this.bridgeClient.connect()
      debugLog('[Bridge] ✅ connect() completed successfully')
      debugLog('[Bridge] Connection:', this.bridgeClient.getConnection())

      debugLog('[Bridge] Input session:', JSON.stringify(options.conversationSession))
      debugLog('[Bridge] Input HTML:', html ? `${html.length} chars` : 'undefined')
      debugLog('[Bridge] Input pageUrl:', options.pageUrl)
      debugLog('[Bridge] Input domStructure:', options.domStructure ? `${options.domStructure.length} chars` : 'not provided')

      let session = options.conversationSession
      const pageUrl = options.pageUrl || session?.pageUrl
      let conversationId: string
      let systemPromptToSend = await getSystemPrompt(this.getChunkRetrievalPrompt())
      const bridgeProvider = getBridgeProviderName(this.config.aiProvider)

      const providerChanged = session?.provider && session.provider !== bridgeProvider
      if (providerChanged) {
        debugLog('[Bridge] Provider changed from', session!.provider, 'to', bridgeProvider, '- creating new conversation')
      }

      if (!session || !session.conversationId || providerChanged) {
        debugLog('[Bridge] No session or no conversationId, creating new conversation')
        debugLog('[Bridge] session:', session)
        debugLog('[Bridge] session.conversationId:', session?.conversationId)
        const sessionId = crypto.randomUUID()

        if (!html) {
          throw new Error('HTML is required for creating new bridge conversation')
        }

        const connection = this.bridgeClient.getConnection()
        const bridgeUrl = connection?.url || 'http://localhost:3000'
        debugLog('[Bridge] Using bridge URL for CLI commands:', bridgeUrl)

        const structureText = options.domStructure || '(DOM structure not available)'
        debugLog('[Bridge] Using pre-generated DOM structure:', structureText.substring(0, 100) + '...')

        // Add page URL and DOM structure to system prompt
        // Include --bridge-url parameter so CLI connects to correct port
        let domainInfo = ''
        if (pageUrl) {
          try {
            domainInfo = `**Domain**: ${new URL(pageUrl).hostname}`
          } catch {
            domainInfo = '**Domain**: unknown (invalid URL)'
          }
        }

        systemPromptToSend += `\n\n## Page Being Edited

**URL**: ${pageUrl || 'Unknown'}
${domainInfo}

## Page DOM Structure

The following is a tree representation of the page structure. Use curl to retrieve specific HTML sections when needed.

` + '```' + `
${structureText}
` + '```' + `

## Retrieving HTML Chunks

To get the HTML for specific section(s), use curl with the **localhost bridge URL** (NOT the page URL):

` + '```bash' + `
# Single selector - use actual class/id from the DOM structure above
curl -s "` + `${bridgeUrl}/conversations/${sessionId}` + `/chunk?selector=.actual-class-from-structure"

# Multiple selectors (comma-separated, URL-encode # as %23)
curl -s "` + `${bridgeUrl}/conversations/${sessionId}` + `/chunk?selectors=header,%23main-content,section"
` + '```' + `

**CRITICAL RULES**:
1. ✅ Always use ` + '`${bridgeUrl}`' + ` for curl - this is the localhost bridge server
2. ⚠️  Only curl the actual website URL (${pageUrl || 'the page URL'}) as a LAST RESORT if the bridge tool is not working
3. ✅ Use selectors you see in the DOM structure above - don't invent selectors
4. ❌ NEVER use generic selectors like ".hero-section" unless you see them in the structure

The response will contain the HTML for each selector. Use this to inspect elements before generating DOM changes.
`
        debugLog('[Bridge] Including DOM structure in system prompt (not full HTML)')
        debugLog(`[Bridge] DOM structure: ${structureText.length} chars`)

        debugLog('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        debugLog('[Bridge] 🔍 COMPLETE SYSTEM PROMPT BEING SENT TO CLAUDE:')
        debugLog('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        debugLog(systemPromptToSend)
        debugLog('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        debugLog(`[Bridge] 📊 System prompt length: ${systemPromptToSend.length} characters`)
        debugLog('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

        debugLog('[Bridge] About to create conversation with sessionId:', sessionId)
        const model = this.config.llmModel && this.config.llmModel !== 'default' ? this.config.llmModel : undefined
        debugLog('[Bridge] Model:', model || '(CLI default)')
        debugLog('[Bridge] Provider:', bridgeProvider)
        const result = await this.bridgeClient.createConversation(
          sessionId,
          '/',
          'allow',
          SHARED_TOOL_SCHEMA,
          html,
          model,
          bridgeProvider
        )
        conversationId = result.conversationId
        debugLog('[Bridge] ✅ Conversation created with JSON schema and HTML stored on bridge')

        session = {
          id: unsafeSessionId(sessionId),
          htmlSent: true,
          pageUrl,
          messages: [],
          conversationId: unsafeConversationId(conversationId),
          provider: bridgeProvider
        }
        debugLog('[Bridge] ✅ Created new conversation:', conversationId)
      } else {
        conversationId = session.conversationId
        debugLog('[Bridge] Reusing existing conversation:', conversationId)
      }

      const userMessage = buildUserMessage(prompt, currentChanges)
      session.messages.push({ role: 'user', content: userMessage })

      // Wait for the final response from Claude Code
      // Claude Code handles all intermediate tool calls (css_query, xpath_query) internally via CLI
      // We only care about the final result (dom_changes_generator or text response)
      const result = await new Promise<AIDOMGenerationResult>((resolve, reject) => {
        let fullResponse = ''
        let finalToolResult: any = null
        let sendTimeoutId: ReturnType<typeof setTimeout> | undefined
        let responseTimeoutId: ReturnType<typeof setTimeout> | undefined
        let resolved = false

        const cleanup = () => {
          if (sendTimeoutId !== undefined) clearTimeout(sendTimeoutId)
          if (responseTimeoutId !== undefined) clearTimeout(responseTimeoutId)
          resolved = true
        }

        debugLog('[Bridge] Starting stream for conversation:', conversationId)
        debugLog('[Bridge] Bridge connection URL:', this.bridgeClient.getConnection()?.url)
        const eventSource = this.bridgeClient.streamResponses(
          conversationId,
          (event) => {
            debugLog(`[Bridge] 📦 Event: ${event.type}`)

            if (event.type === 'tool_use') {
              let toolInput = event.data

              // Parse if string
              if (typeof toolInput === 'string') {
                try {
                  toolInput = JSON.parse(toolInput)
                } catch (e) {
                  // Not JSON, ignore
                }
              }

              // Unwrap {name, input} structure
              if (toolInput && toolInput.input) {
                toolInput = toolInput.input
              }

              // Check if this is the FINAL result (dom_changes_generator)
              if (toolInput && (toolInput.domChanges !== undefined || toolInput.response !== undefined || toolInput.action !== undefined)) {
                debugLog('[Bridge] 📦 Received final dom_changes_generator result')
                finalToolResult = toolInput
                // Don't close yet - wait for 'done' event
              } else {
                // Intermediate tool call (css_query, xpath_query) - Claude Code handles these via CLI
                debugLog('[Bridge] ℹ️ Intermediate tool call (handled by Claude Code internally)')
              }
            } else if (event.type === 'text') {
              fullResponse += event.data
            } else if (event.type === 'done') {
              debugLog('[Bridge] ✅ Stream done')
              cleanup()
              eventSource.close()

              // If we got a final tool result, validate and return it
              if (finalToolResult) {
                const validation = validateAIDOMGenerationResult(JSON.stringify(finalToolResult))
                if (validation.isValid) {
                  debugLog('[Bridge] ✅ Generated', validation.result.domChanges.length, 'DOM changes')
                  resolve(validation.result)
                } else {
                  reject(new Error(`Validation failed: ${(validation as ValidationError).errors.join(', ')}`))
                }
                return
              }

              // Otherwise try to parse text response as JSON
              const responseText = fullResponse.trim()
              if (responseText) {
                let jsonText = responseText
                if (jsonText.startsWith('```')) {
                  jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
                }
                const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
                if (jsonMatch) {
                  jsonText = jsonMatch[0]
                }

                const validation = validateAIDOMGenerationResult(jsonText)
                if (validation.isValid) {
                  resolve(validation.result)
                  return
                }

                // Not valid JSON - return as conversational response
                cleanup()
                resolve({
                  domChanges: [],
                  response: responseText,
                  action: 'none' as const
                })
              } else {
                cleanup()
                reject(new Error('No response received from Claude Code'))
              }
            } else if (event.type === 'error') {
              console.error('[Bridge] ❌ Error:', event.data)
              cleanup()
              eventSource.close()

              let errorData = event.data
              if (typeof errorData === 'string') {
                try {
                  const parsed = JSON.parse(errorData)
                  if (parsed.error) errorData = parsed.error
                } catch (parseError) {
                  debugWarn('[Bridge] Failed to parse SSE error data as JSON, using raw string:', errorData.substring(0, 100))
                }
              }

              const formatBridgeError = (value: unknown): string => {
                let raw: string
                if (typeof value === 'string') {
                  raw = value
                } else if (value && typeof value === 'object') {
                  const obj = value as { type?: string; message?: string; code?: string }
                  if (obj.type || obj.code || obj.message) {
                    const prefix = [obj.type, obj.code].filter(Boolean).join(' ')
                    raw = prefix && obj.message ? `${prefix}: ${obj.message}` : prefix || obj.message || String(value)
                  } else {
                    try {
                      raw = JSON.stringify(value)
                    } catch {
                      raw = String(value)
                    }
                  }
                } else {
                  raw = String(value)
                }

                const separator = raw.indexOf(' -------- ')
                if (separator !== -1) {
                  raw = raw.substring(0, separator)
                }
                return raw
              }

              let userMessage = 'AI CLI Bridge error: '
              const formattedError = formatBridgeError(errorData)
              const errorStr = formattedError

              if (errorStr.includes('ECONNREFUSED') || errorStr.includes('Failed to fetch')) {
                userMessage = 'Cannot connect to AI CLI Bridge. Make sure it\'s running:\n\nnpx @absmartly/ai-cli-bridge'
              } else if (errorStr.includes('401') || errorStr.includes('Unauthorized') || errorStr.includes('unauthorized')) {
                userMessage = 'Authentication failed. Check your Claude API credentials in Settings.'
              } else if (errorStr.includes('403') || errorStr.includes('Forbidden')) {
                userMessage = 'Access forbidden. Your API key may not have the required permissions.'
              } else if (errorStr.includes('429') || errorStr.includes('rate limit')) {
                userMessage = 'Rate limit exceeded. Please wait a moment and try again.'
              } else if (
                errorStr.includes('model') &&
                (errorStr.includes('not found') || errorStr.includes('unavailable')) &&
                !errorStr.toLowerCase().includes('invalid model')
              ) {
                userMessage = `Model error: ${formattedError}\n\nCheck that the selected model is available with your API key.`
              } else if (errorStr.includes('token') || errorStr.includes('context') || errorStr.includes('limit')) {
                userMessage = `Token limit exceeded: ${formattedError}\n\nTry simplifying your request or reducing the HTML size.`
              } else if (errorStr.includes('timeout') || errorStr.includes('timed out')) {
                userMessage = 'Request timed out. Try again or simplify your request.'
              } else if (errorStr.includes('network') || errorStr.includes('NetworkError')) {
                userMessage = 'Network error. Check your internet connection and try again.'
              } else {
                userMessage += formattedError
              }

              reject(new Error(userMessage))
            }
          },
          (error) => {
            console.error('[Bridge] Stream error:', error)
            cleanup()
            eventSource.close()
            reject(error)
          }
        )

        // Send the message
        sendTimeoutId = setTimeout(async () => {
          try {
            await this.bridgeClient.sendMessage(conversationId, userMessage, images || [], systemPromptToSend, SHARED_TOOL_SCHEMA)
            debugLog('[Bridge] Message sent')
          } catch (error) {
            cleanup()
            eventSource.close()
            reject(error)
          }
        }, 100)

        // Timeout after 5 minutes (Claude Code may take a while with multiple tool calls)
        responseTimeoutId = setTimeout(() => {
          if (!resolved) {
            cleanup()
            eventSource.close()
            reject(new Error('Response timeout after 5 minutes'))
          }
        }, 300000)
      })

      session.messages.push({ role: 'assistant', content: result.response })

      return {
        ...result,
        session
      }
    } catch (error) {
      console.error('❌ Bridge generation failed:', error)

      const errorMessage = error instanceof Error ? error.message : String(error)

      if (errorMessage.includes('AI CLI Bridge error:')) {
        throw error
      }

      let userMessage = 'AI CLI Bridge error: '
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Failed to fetch')) {
        userMessage = 'Cannot connect to AI CLI Bridge. Make sure it\'s running:\n\nnpx @absmartly/ai-cli-bridge'
      } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        userMessage = 'Authentication failed. Check your Claude API credentials in Settings.'
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        userMessage = 'Access forbidden. Your API key may not have the required permissions.'
      } else if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
        userMessage = 'Rate limit exceeded. Please wait a moment and try again.'
      } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
        userMessage = 'Request timed out after 5 minutes. Try again or simplify your request.'
      } else if (errorMessage.includes('network') || errorMessage.includes('NetworkError')) {
        userMessage = 'Network error. Check your internet connection and try again.'
      } else if (errorMessage.includes('HTML is required')) {
        userMessage = 'HTML is required for creating new bridge conversation'
      } else {
        userMessage += errorMessage
      }

      throw new Error(userMessage)
    } finally {
      this.bridgeClient.disconnect()
    }
  }
}
