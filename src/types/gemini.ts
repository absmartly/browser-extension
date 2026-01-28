export interface GeminiModel {
  name: string
  version: string
  displayName: string
  description: string
  inputTokenLimit: number
  outputTokenLimit: number
  supportedGenerationMethods: string[]
  temperature?: number
  topP?: number
  topK?: number
}

export interface GeminiModelsResponse {
  models: GeminiModel[]
}

export interface GeminiPart {
  text?: string
  inlineData?: {
    mimeType: string
    data: string
  }
  functionCall?: {
    name: string
    args: Record<string, any>
  }
  functionResponse?: {
    name: string
    response: Record<string, any>
  }
}

export interface GeminiContent {
  role: 'user' | 'model' | 'function'
  parts: GeminiPart[]
}

export interface GeminiFunctionDeclaration {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
}

export interface GeminiTool {
  functionDeclarations: GeminiFunctionDeclaration[]
}

export interface GeminiGenerateContentRequest {
  contents: GeminiContent[]
  tools?: GeminiTool[]
  generationConfig?: {
    temperature?: number
    topK?: number
    topP?: number
    maxOutputTokens?: number
    stopSequences?: string[]
  }
}

export interface GeminiCandidate {
  content: GeminiContent
  finishReason?: string
  index: number
  safetyRatings?: Array<{
    category: string
    probability: string
  }>
}

export interface GeminiGenerateContentResponse {
  candidates: GeminiCandidate[]
  promptFeedback?: {
    blockReason?: string
    safetyRatings?: Array<{
      category: string
      probability: string
    }>
  }
  usageMetadata?: {
    promptTokenCount: number
    candidatesTokenCount: number
    totalTokenCount: number
  }
}
