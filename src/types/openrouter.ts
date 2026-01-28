export interface OpenRouterModel {
  id: string
  name: string
  description?: string
  pricing: {
    prompt: string
    completion: string
    request?: string
    image?: string
  }
  context_length: number
  architecture?: {
    modality?: string
    tokenizer?: string
    instruct_type?: string
  }
  top_provider?: {
    context_length?: number
    max_completion_tokens?: number
    is_moderated?: boolean
  }
  per_request_limits?: {
    prompt_tokens?: string
    completion_tokens?: string
  }
}

export interface OpenRouterModelsResponse {
  data: OpenRouterModel[]
}

export interface OpenRouterChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | any[]
  name?: string
  tool_call_id?: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: {
      name: string
      arguments: string
    }
  }>
}

export interface OpenRouterChatCompletionRequest {
  model: string
  messages: OpenRouterChatMessage[]
  tools?: Array<{
    type: 'function'
    function: {
      name: string
      description: string
      parameters: any
    }
  }>
  max_tokens?: number
  temperature?: number
  top_p?: number
  stream?: boolean
}

export interface OpenRouterChatCompletionResponse {
  id: string
  model: string
  created: number
  choices: Array<{
    index: number
    message: OpenRouterChatMessage
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}
