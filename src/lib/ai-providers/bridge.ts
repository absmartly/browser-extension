import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'
import type { AIProvider, AIProviderConfig, GenerateOptions } from './base'
import { getSystemPrompt, buildUserMessage } from './utils'
import { SHARED_TOOL_SCHEMA } from './shared-schema'
import { ClaudeCodeBridgeClient } from '~src/lib/claude-code-client'
import { BRIDGE_CHUNK_RETRIEVAL_PROMPT } from './chunk-retrieval-prompts'
import { validateAIDOMGenerationResult } from './validation'

export class BridgeProvider implements AIProvider {
  private bridgeClient: ClaudeCodeBridgeClient

  constructor(private config: AIProviderConfig) {
    this.bridgeClient = new ClaudeCodeBridgeClient()
  }

  getChunkRetrievalPrompt(): string {
    return BRIDGE_CHUNK_RETRIEVAL_PROMPT
  }

  getToolDefinition(): any {
    return SHARED_TOOL_SCHEMA as any
  }

  async generate(
    html: string,
    prompt: string,
    currentChanges: DOMChange[] = [],
    images: string[] | undefined,
    options: GenerateOptions
  ): Promise<AIDOMGenerationResult & { session: ConversationSession }> {
    console.log('[Bridge] generateWithBridge() called')

    try {
      console.log('[Bridge] About to call bridgeClient.connect()...')
      await this.bridgeClient.connect()
      console.log('[Bridge] ✅ connect() completed successfully')
      console.log('[Bridge] Connection:', this.bridgeClient.getConnection())

      console.log('[Bridge] Input session:', JSON.stringify(options.conversationSession))
      console.log('[Bridge] Input HTML:', html ? `${html.length} chars` : 'undefined')
      console.log('[Bridge] Input pageUrl:', options.pageUrl)
      console.log('[Bridge] Input domStructure:', options.domStructure ? `${options.domStructure.length} chars` : 'not provided')

      let session = options.conversationSession
      const pageUrl = options.pageUrl || session?.pageUrl
      let conversationId: string
      let systemPromptToSend = await getSystemPrompt(this.getChunkRetrievalPrompt())

      if (!session || !session.conversationId) {
        console.log('[Bridge] No session or no conversationId, creating new conversation')
        console.log('[Bridge] session:', session)
        console.log('[Bridge] session.conversationId:', session?.conversationId)
        const sessionId = crypto.randomUUID()

        if (!html) {
          throw new Error('HTML is required for creating new bridge conversation')
        }

        const connection = this.bridgeClient.getConnection()
        const bridgeUrl = connection?.url || 'http://localhost:3000'
        console.log('[Bridge] Using bridge URL for CLI commands:', bridgeUrl)

        const structureText = options.domStructure || '(DOM structure not available)'
        console.log('[Bridge] Using pre-generated DOM structure:', structureText.substring(0, 100) + '...')

        // Add page URL and DOM structure to system prompt
        // Include --bridge-url parameter so CLI connects to correct port
        systemPromptToSend += `\n\n## Page Being Edited

**URL**: ${pageUrl || 'Unknown'}
${pageUrl ? `**Domain**: ${new URL(pageUrl).hostname}` : ''}

## Page DOM Structure

The following is a tree representation of the page structure. Use curl to retrieve specific HTML sections when needed.

\`\`\`
${structureText}
\`\`\`

## Retrieving HTML Chunks

To get the HTML for specific section(s), use curl with the **localhost bridge URL** (NOT the page URL):

\`\`\`bash
# Single selector - use actual class/id from the DOM structure above
curl -s "${bridgeUrl}/conversations/${sessionId}/chunk?selector=.actual-class-from-structure"

# Multiple selectors (comma-separated, URL-encode # as %23)
curl -s "${bridgeUrl}/conversations/${sessionId}/chunk?selectors=header,%23main-content,section"
\`\`\`

**CRITICAL RULES**:
1. ✅ Always use \`${bridgeUrl}\` for curl - this is the localhost bridge server
2. ⚠️  Only curl the actual website URL (${pageUrl || 'the page URL'}) as a LAST RESORT if the bridge tool is not working
3. ✅ Use selectors you see in the DOM structure above - don't invent selectors
4. ❌ NEVER use generic selectors like ".hero-section" unless you see them in the structure

The response will contain the HTML for each selector. Use this to inspect elements before generating DOM changes.
`
        console.log('[Bridge] Including DOM structure in system prompt (not full HTML)')
        console.log(`[Bridge] DOM structure: ${structureText.length} chars`)

        console.log('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('[Bridge] 🔍 COMPLETE SYSTEM PROMPT BEING SENT TO CLAUDE:')
        console.log('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(systemPromptToSend)
        console.log('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(`[Bridge] 📊 System prompt length: ${systemPromptToSend.length} characters`)
        console.log('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

        console.log('[Bridge] About to create conversation with sessionId:', sessionId)
        console.log('[Bridge] Model:', this.config.llmModel || 'sonnet (default)')
        // Pass HTML to bridge for storage (used by get-chunk CLI)
        const result = await this.bridgeClient.createConversation(
          sessionId,
          '/',
          'allow',
          SHARED_TOOL_SCHEMA,
          html, // Store full HTML on bridge for chunk retrieval
          this.config.llmModel || 'sonnet' // Pass model selection (default to sonnet)
        )
        conversationId = result.conversationId
        console.log('[Bridge] ✅ Conversation created with JSON schema and HTML stored on bridge')

        session = {
          id: sessionId,
          htmlSent: true,
          pageUrl,
          messages: [],
          conversationId
        }
        console.log('[Bridge] ✅ Created new conversation:', conversationId)
      } else {
        conversationId = session.conversationId
        console.log('[Bridge] Reusing existing conversation:', conversationId)
      }

      const userMessage = buildUserMessage(prompt, currentChanges)
      session.messages.push({ role: 'user', content: userMessage })

      // Wait for the final response from Claude Code
      // Claude Code handles all intermediate tool calls (css_query, xpath_query) internally via CLI
      // We only care about the final result (dom_changes_generator or text response)
      const result = await new Promise<AIDOMGenerationResult>((resolve, reject) => {
        let fullResponse = ''
        let finalToolResult: any = null

        console.log('[Bridge] Starting stream for conversation:', conversationId)
        console.log('[Bridge] Bridge connection URL:', this.bridgeClient.getConnection()?.url)
        const eventSource = this.bridgeClient.streamResponses(
          conversationId,
          (event) => {
            console.log(`[Bridge] 📦 Event: ${event.type}`)

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
                console.log('[Bridge] 📦 Received final dom_changes_generator result')
                finalToolResult = toolInput
                // Don't close yet - wait for 'done' event
              } else {
                // Intermediate tool call (css_query, xpath_query) - Claude Code handles these via CLI
                console.log('[Bridge] ℹ️ Intermediate tool call (handled by Claude Code internally)')
              }
            } else if (event.type === 'text') {
              fullResponse += event.data
            } else if (event.type === 'done') {
              console.log('[Bridge] ✅ Stream done')
              eventSource.close()

              // If we got a final tool result, validate and return it
              if (finalToolResult) {
                const validation = validateAIDOMGenerationResult(JSON.stringify(finalToolResult))
                if (validation.isValid) {
                  console.log('[Bridge] ✅ Generated', validation.result.domChanges.length, 'DOM changes')
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
                resolve({
                  domChanges: [],
                  response: responseText,
                  action: 'none' as const
                })
              } else {
                reject(new Error('No response received from Claude Code'))
              }
            } else if (event.type === 'error') {
              console.error('[Bridge] ❌ Error:', event.data)
              eventSource.close()
              // Don't add "Claude error:" prefix - it gets wrapped again in outer catch
              reject(new Error(event.data || 'Unknown error'))
            }
          },
          (error) => {
            console.error('[Bridge] Stream error:', error)
            eventSource.close()
            reject(error)
          }
        )

        // Send the message
        setTimeout(async () => {
          try {
            await this.bridgeClient.sendMessage(conversationId, userMessage, images || [], systemPromptToSend, SHARED_TOOL_SCHEMA)
            console.log('[Bridge] Message sent')
          } catch (error) {
            eventSource.close()
            reject(error)
          }
        }, 100)

        // Timeout after 5 minutes (Claude Code may take a while with multiple tool calls)
        setTimeout(() => {
          eventSource.close()
          reject(new Error('Response timeout after 5 minutes'))
        }, 300000)
      })

      session.messages.push({ role: 'assistant', content: result.response })

      return {
        ...result,
        session
      }
    } catch (error) {
      console.error('❌ Bridge generation failed:', error)
      throw new Error(`Claude Code Bridge error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      this.bridgeClient.disconnect()
    }
  }
}
