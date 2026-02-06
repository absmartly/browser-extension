export interface JSONSchema {
  type: string
  properties?: Record<string, JSONSchemaProperty>
  required?: string[]
  items?: JSONSchema
  enum?: string[]
  description?: string
}

export interface JSONSchemaProperty {
  type?: string
  description?: string
  items?: JSONSchema
  enum?: string[]
  properties?: Record<string, JSONSchemaProperty>
}

export interface AnthropicToolDefinition {
  name: string
  description: string
  input_schema: JSONSchema
}

export interface OpenAIToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: JSONSchema
  }
}

export interface GeminiToolDefinition {
  name: string
  description: string
  parameters: JSONSchema
}

export function isAnthropicTool(tool: unknown): tool is AnthropicToolDefinition {
  if (typeof tool !== 'object' || tool === null) return false
  const t = tool as Record<string, unknown>
  return (
    typeof t.name === 'string' &&
    typeof t.description === 'string' &&
    typeof t.input_schema === 'object' &&
    t.input_schema !== null
  )
}

export function isOpenAITool(tool: unknown): tool is OpenAIToolDefinition {
  if (typeof tool !== 'object' || tool === null) return false
  const t = tool as Record<string, unknown>
  return (
    t.type === 'function' &&
    typeof t.function === 'object' &&
    t.function !== null &&
    typeof (t.function as Record<string, unknown>).name === 'string' &&
    typeof (t.function as Record<string, unknown>).description === 'string' &&
    typeof (t.function as Record<string, unknown>).parameters === 'object'
  )
}

export function isGeminiTool(tool: unknown): tool is GeminiToolDefinition {
  if (typeof tool !== 'object' || tool === null) return false
  const t = tool as Record<string, unknown>
  return (
    typeof t.name === 'string' &&
    typeof t.description === 'string' &&
    typeof t.parameters === 'object' &&
    t.parameters !== null
  )
}
