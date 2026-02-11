import type { AIDOMGenerationResult, DOMChange } from '~src/types/dom-changes'
import type { ConversationSession } from '~src/types/absmartly'
import type { GenerateOptions } from './base'
import { validateAIDOMGenerationResult, type ValidationError } from './validation'
import { handleCssQuery, handleXPathQuery } from './tool-handlers'
import { MAX_TOOL_ITERATIONS } from './constants'
import { getSystemPrompt, buildUserMessage, buildSystemPromptWithDOMStructure, createSession } from './utils'
import { API_CHUNK_RETRIEVAL_PROMPT } from './chunk-retrieval-prompts'
import { debugLog } from '~src/utils/debug'

export interface ToolCall {
  name: string
  id: string
  input: any
}

type FinalResult = {
  type: 'final'
  result: AIDOMGenerationResult
}

type ContinueResult = {
  type: 'continue'
  results: Array<{ id: string; content: string }>
}

type ConversationalResult = {
  type: 'conversational'
  text: string
}

export type ToolProcessingOutcome = FinalResult | ContinueResult

export function processToolCalls(
  toolCalls: ToolCall[],
  providerName: string,
  parseInput?: (raw: any) => any
): Promise<ToolProcessingOutcome> {
  return processToolCallsInternal(toolCalls, providerName, parseInput)
}

async function processToolCallsInternal(
  toolCalls: ToolCall[],
  providerName: string,
  parseInput?: (raw: any) => any
): Promise<ToolProcessingOutcome> {
  const toolResults: Array<{ id: string; content: string }> = []

  for (const tool of toolCalls) {
    const input = parseInput ? parseInput(tool.input) : tool.input
    debugLog(`[${providerName}] Tool call: ${tool.name}`)

    if (tool.name === 'dom_changes_generator') {
      const validation = validateAIDOMGenerationResult(JSON.stringify(input))

      if (!validation.isValid) {
        const errorValidation = validation as ValidationError
        console.error(`[${providerName}] Tool call validation failed:`, errorValidation.errors)
        throw new Error(`Tool call validation failed: ${errorValidation.errors.join(', ')}`)
      }

      debugLog(`[${providerName}] Generated`, validation.result.domChanges.length, 'DOM changes with action:', validation.result.action)

      return { type: 'final', result: validation.result }
    } else if (tool.name === 'css_query') {
      const selectors = input.selectors as string[]
      const result = await handleCssQuery(selectors)
      toolResults.push({ id: tool.id, content: result.error || result.result || '' })
    } else if (tool.name === 'xpath_query') {
      const xpath = input.xpath as string
      const maxResults = (input.maxResults as number) || 10
      const result = await handleXPathQuery(xpath, maxResults)
      toolResults.push({ id: tool.id, content: result.error || result.result || '' })
    } else {
      toolResults.push({ id: tool.id, content: `Error: Unknown tool "${tool.name}"` })
    }
  }

  return { type: 'continue', results: toolResults }
}

export interface SessionSetup {
  session: ConversationSession
  systemPrompt: string
  userMessageText: string
}

export async function prepareSession(
  html: string,
  prompt: string,
  currentChanges: DOMChange[],
  options: GenerateOptions,
  providerName: string,
  postProcess?: (text: string) => string
): Promise<SessionSetup> {
  const session = createSession(options.conversationSession)
  let systemPrompt = await getSystemPrompt(API_CHUNK_RETRIEVAL_PROMPT)

  if (!session.htmlSent) {
    if (!html && !options.domStructure) {
      throw new Error('HTML or DOM structure is required for first message in conversation')
    }

    systemPrompt = buildSystemPromptWithDOMStructure(systemPrompt, options.domStructure, providerName)
    session.htmlSent = true
  }

  if (postProcess) {
    systemPrompt = postProcess(systemPrompt)
  }

  const userMessageText = postProcess
    ? postProcess(buildUserMessage(prompt, currentChanges))
    : buildUserMessage(prompt, currentChanges)

  return { session, systemPrompt, userMessageText }
}

export function makeConversationalResponse(
  text: string,
  session: ConversationSession
): AIDOMGenerationResult & { session: ConversationSession } {
  session.messages.push({ role: 'assistant', content: text })
  return {
    domChanges: [],
    response: text,
    action: 'none' as const,
    session
  }
}

export function makeFinalResponse(
  result: AIDOMGenerationResult,
  session: ConversationSession
): AIDOMGenerationResult & { session: ConversationSession } {
  session.messages.push({ role: 'assistant', content: result.response })
  return { ...result, session }
}

export { MAX_TOOL_ITERATIONS }
