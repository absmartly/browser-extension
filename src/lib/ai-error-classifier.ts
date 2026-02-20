export type AIErrorType = 'timeout' | 'auth' | 'rate_limit' | 'quota' | 'model' | 'network' | 'unknown'

export interface ClassifiedAIError {
  type: AIErrorType
  message: string
  userAction: string
}

export function classifyAIError(error: Error): ClassifiedAIError {
  const msg = error.message.toLowerCase()

  if (msg.includes('timeout') || msg.includes('timed out')) {
    return {
      type: 'timeout',
      message: 'AI service timed out',
      userAction: 'Try a simpler request or try again later'
    }
  }

  if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('invalid api key') || msg.includes('authentication')) {
    return {
      type: 'auth',
      message: 'Authentication failed',
      userAction: 'Check your API key in Settings'
    }
  }

  if (msg.includes('429') || msg.includes('rate limit')) {
    return {
      type: 'rate_limit',
      message: 'Rate limit exceeded',
      userAction: 'Wait a moment and try again'
    }
  }

  if (msg.includes('quota') || msg.includes('insufficient_quota') || msg.includes('billing')) {
    return {
      type: 'quota',
      message: 'API quota exceeded',
      userAction: 'Check your billing status'
    }
  }

  if (msg.includes('model') && (msg.includes('not found') || msg.includes('invalid') || msg.includes('unavailable'))) {
    return {
      type: 'model',
      message: 'Model not available',
      userAction: 'Try a different model or check model availability'
    }
  }

  if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) {
    return {
      type: 'network',
      message: 'Network connection failed',
      userAction: 'Check your internet connection'
    }
  }

  return {
    type: 'unknown',
    message: error.message,
    userAction: 'Please try again or contact support'
  }
}

export function formatClassifiedError(classified: ClassifiedAIError): string {
  return `${classified.message}. ${classified.userAction}`
}
