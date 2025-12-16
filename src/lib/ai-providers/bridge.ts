import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'
import type { AIProvider, AIProviderConfig, GenerateOptions } from './base'
import { getSystemPrompt, buildUserMessage } from './utils'
import { SHARED_TOOL_SCHEMA } from './shared-schema'
import { ClaudeCodeBridgeClient } from '~src/lib/claude-code-client'

interface ValidationError {
  isValid: false
  errors: string[]
}

interface ValidationSuccess {
  isValid: true
  result: AIDOMGenerationResult
}

type ValidationResult = ValidationError | ValidationSuccess

function validateAIDOMGenerationResult(responseText: string): ValidationResult {
  const errors: string[] = []

  let parsedResult: any
  try {
    parsedResult = JSON.parse(responseText)
  } catch (error) {
    return {
      isValid: false,
      errors: ['Response is not valid JSON. Your response must be pure JSON starting with { and ending with }.']
    }
  }

  if (!parsedResult.domChanges) {
    errors.push('Missing required field: "domChanges" (must be an array of DOM change objects)')
  } else if (!Array.isArray(parsedResult.domChanges)) {
    errors.push('"domChanges" must be an array, got: ' + typeof parsedResult.domChanges)
  }

  if (!parsedResult.response) {
    errors.push('Missing required field: "response" (must be a string with your conversational message)')
  } else if (typeof parsedResult.response !== 'string') {
    errors.push('"response" must be a string, got: ' + typeof parsedResult.response)
  }

  if (!parsedResult.action) {
    errors.push('Missing required field: "action" (must be one of: append, replace_all, replace_specific, remove_specific, none)')
  } else if (!['append', 'replace_all', 'replace_specific', 'remove_specific', 'none'].includes(parsedResult.action)) {
    errors.push(`"action" must be one of: append, replace_all, replace_specific, remove_specific, none. Got: "${parsedResult.action}"`)
  }

  if ((parsedResult.action === 'replace_specific' || parsedResult.action === 'remove_specific') &&
      (!parsedResult.targetSelectors || !Array.isArray(parsedResult.targetSelectors) || parsedResult.targetSelectors.length === 0)) {
    errors.push(`Action "${parsedResult.action}" requires a non-empty "targetSelectors" array`)
  }

  if (errors.length > 0) {
    return { isValid: false, errors }
  }

  return {
    isValid: true,
    result: parsedResult as AIDOMGenerationResult
  }
}

export class BridgeProvider implements AIProvider {
  private bridgeClient: ClaudeCodeBridgeClient

  constructor(private config: AIProviderConfig) {
    this.bridgeClient = new ClaudeCodeBridgeClient()
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

      let session = options.conversationSession
      let conversationId: string
      let systemPromptToSend = await getSystemPrompt()

      if (!session || !session.conversationId) {
        console.log('[Bridge] No session or no conversationId, creating new conversation')
        console.log('[Bridge] session:', session)
        console.log('[Bridge] session.conversationId:', session?.conversationId)
        const sessionId = crypto.randomUUID()

        if (!html) {
          throw new Error('HTML is required for creating new bridge conversation')
        }
        systemPromptToSend += `\n\nHTML Content:\n\`\`\`html\n${html}\n\`\`\``
        console.log('[Bridge] Including HTML in system prompt (initializing conversation)')

        console.log('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('[Bridge] 🔍 COMPLETE SYSTEM PROMPT BEING SENT TO CLAUDE:')
        console.log('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(systemPromptToSend)
        console.log('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(`[Bridge] 📊 System prompt length: ${systemPromptToSend.length} characters`)
        console.log('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

        console.log('[Bridge] About to create conversation with sessionId:', sessionId)
        const result = await this.bridgeClient.createConversation(
          sessionId,
          '/',
          'allow',
          SHARED_TOOL_SCHEMA
        )
        conversationId = result.conversationId
        console.log('[Bridge] ✅ Conversation created with JSON schema from extension')

        session = {
          id: sessionId,
          htmlSent: true,
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

      const responseData = await new Promise<{ type: 'text' | 'tool_use', data: any }>((resolve, reject) => {
        let fullResponse = ''
        let receivedToolUse = false

        console.log('[Bridge] Starting stream for conversation:', conversationId)
        const eventSource = this.bridgeClient.streamResponses(
          conversationId,
          (event) => {
            console.log('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
            console.log(`[Bridge] 📦 RAW EVENT TYPE: ${event.type}`)
            console.log('[Bridge] Full event data:', JSON.stringify(event, null, 2))
            console.log('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

            if (event.type === 'tool_use') {
              console.log('[Bridge] 🔧 Received tool_use response from Claude')
              receivedToolUse = true
              eventSource.close()
              resolve({ type: 'tool_use', data: event.data })
            } else if (event.type === 'text') {
              fullResponse += event.data
            } else if (event.type === 'done') {
              console.log('[Bridge] Stream done, full response length:', fullResponse.length)
              eventSource.close()
              if (!receivedToolUse) {
                resolve({ type: 'text', data: fullResponse })
              }
            } else if (event.type === 'error') {
              console.error('[Bridge] Claude error:', event.data)
              eventSource.close()
              reject(new Error(`Claude error: ${event.data || 'Unknown error'}`))
            }
          },
          (error) => {
            console.error('[Bridge] Stream error:', error)
            eventSource.close()
            reject(error)
          }
        )

        setTimeout(async () => {
          console.log('[Bridge] Sending message to conversation:', conversationId)
          try {
            await this.bridgeClient.sendMessage(conversationId, userMessage, images || [], systemPromptToSend, SHARED_TOOL_SCHEMA)
            console.log('[Bridge] Message sent successfully (with schema)')
          } catch (error) {
            console.error('[Bridge] Failed to send message:', error)
            eventSource.close()
            reject(error)
          }
        }, 100)

        setTimeout(() => {
          console.error('[Bridge] Response timeout after 60s')
          eventSource.close()
          reject(new Error('Bridge response timeout after 60s'))
        }, 60000)
      })

      if (responseData.type === 'tool_use') {
        console.log('[Bridge] Processing tool_use response')

        console.log('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('[Bridge] 📦 RAW STRUCTURED OUTPUT FROM CLAUDE (tool call arguments):')
        console.log(JSON.stringify(responseData.data, null, 2))
        console.log('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

        const validation = validateAIDOMGenerationResult(JSON.stringify(responseData.data))

        if (!validation.isValid) {
          const errorValidation = validation as ValidationError
          console.error('[Bridge] ❌ Tool use validation failed:', errorValidation.errors)
          throw new Error(`Tool use validation failed: ${errorValidation.errors.join(', ')}`)
        }

        console.log('[Bridge] ✅ Generated', validation.result.domChanges.length, 'DOM changes with action:', validation.result.action)
        session.messages.push({ role: 'assistant', content: validation.result.response })

        return {
          ...validation.result,
          session
        }
      }

      console.warn('[Bridge] ⚠️ Tool calling not used - falling back to text parsing')

      let responseText = responseData.data.trim()
      console.log('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('[Bridge] 📝 FULL TEXT RESPONSE:')
      console.log(responseText)
      console.log('[Bridge] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      let jsonText = responseText
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
      }

      const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        jsonText = jsonMatch[0]
      }

      const validation = validateAIDOMGenerationResult(jsonText)

      if (!validation.isValid) {
        console.log('[Bridge] ℹ️ Response is not structured JSON, normalizing as conversational message')

        session.messages.push({ role: 'assistant', content: responseText })

        const returnValueConv = {
          domChanges: [],
          response: responseText,
          action: 'none' as const,
          session
        }

        console.log('[AI Generator] Returning from Bridge (conversational):', {
          domChanges: returnValueConv.domChanges.length,
          response: returnValueConv.response.substring(0, 50),
          action: returnValueConv.action,
          session: returnValueConv.session?.id
        })

        return returnValueConv
      }

      console.log('[Bridge] ✅ Generated', validation.result.domChanges.length, 'DOM changes with action:', validation.result.action)

      if (!validation.result.domChanges || !Array.isArray(validation.result.domChanges)) {
        console.error('⚠️ Bridge validation.result.domChanges is invalid:', validation.result.domChanges)
        throw new Error('Bridge validation result missing domChanges array')
      }

      session.messages.push({ role: 'assistant', content: validation.result.response })

      const returnValue = {
        ...validation.result,
        session
      }

      console.log('[AI Generator] Returning from Bridge (validated):', {
        domChanges: returnValue.domChanges?.length,
        response: returnValue.response?.substring(0, 50),
        action: returnValue.action,
        session: returnValue.session?.id
      })

      return returnValue
    } catch (error) {
      console.error('❌ Bridge generation failed:', error)
      throw new Error(`Claude Code Bridge error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      this.bridgeClient.disconnect()
    }
  }
}
