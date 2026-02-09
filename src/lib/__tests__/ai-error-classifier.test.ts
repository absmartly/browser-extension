import { describe, it, expect } from '@jest/globals'
import { classifyAIError, formatClassifiedError } from '../ai-error-classifier'

describe('AI Error Classifier', () => {
  describe('classifyAIError', () => {
    it('should classify timeout errors', () => {
      const error = new Error('Request timed out after 60 seconds')
      const classified = classifyAIError(error)

      expect(classified.type).toBe('timeout')
      expect(classified.message).toBe('AI service timed out')
      expect(classified.userAction).toBe('Try a simpler request or try again later')
    })

    it('should classify timeout errors with different wording', () => {
      const error = new Error('AI request timeout')
      const classified = classifyAIError(error)

      expect(classified.type).toBe('timeout')
    })

    it('should classify authentication errors with 401', () => {
      const error = new Error('API error: 401 Unauthorized')
      const classified = classifyAIError(error)

      expect(classified.type).toBe('auth')
      expect(classified.message).toBe('Authentication failed')
      expect(classified.userAction).toBe('Check your API key in Settings')
    })

    it('should classify authentication errors with invalid API key', () => {
      const error = new Error('Invalid API key provided')
      const classified = classifyAIError(error)

      expect(classified.type).toBe('auth')
    })

    it('should classify authentication errors with unauthorized', () => {
      const error = new Error('Unauthorized access')
      const classified = classifyAIError(error)

      expect(classified.type).toBe('auth')
    })

    it('should classify rate limit errors with 429', () => {
      const error = new Error('API error: 429 Too Many Requests')
      const classified = classifyAIError(error)

      expect(classified.type).toBe('rate_limit')
      expect(classified.message).toBe('Rate limit exceeded')
      expect(classified.userAction).toBe('Wait a moment and try again')
    })

    it('should classify rate limit errors with text', () => {
      const error = new Error('Rate limit exceeded for requests')
      const classified = classifyAIError(error)

      expect(classified.type).toBe('rate_limit')
    })

    it('should classify quota errors with quota text', () => {
      const error = new Error('You have exceeded your current quota')
      const classified = classifyAIError(error)

      expect(classified.type).toBe('quota')
      expect(classified.message).toBe('API quota exceeded')
      expect(classified.userAction).toBe('Check your billing status')
    })

    it('should classify quota errors with insufficient_quota', () => {
      const error = new Error('Error: insufficient_quota')
      const classified = classifyAIError(error)

      expect(classified.type).toBe('quota')
    })

    it('should classify quota errors with billing', () => {
      const error = new Error('Billing limit exceeded')
      const classified = classifyAIError(error)

      expect(classified.type).toBe('quota')
    })

    it('should classify model not found errors', () => {
      const error = new Error('Model gpt-5 not found')
      const classified = classifyAIError(error)

      expect(classified.type).toBe('model')
      expect(classified.message).toBe('Model not available')
      expect(classified.userAction).toBe('Try a different model or check model availability')
    })

    it('should classify invalid model errors', () => {
      const error = new Error('Invalid model specified')
      const classified = classifyAIError(error)

      expect(classified.type).toBe('model')
    })

    it('should classify model unavailable errors', () => {
      const error = new Error('Model is currently unavailable')
      const classified = classifyAIError(error)

      expect(classified.type).toBe('model')
    })

    it('should classify network errors with network text', () => {
      const error = new Error('Network connection failed')
      const classified = classifyAIError(error)

      expect(classified.type).toBe('network')
      expect(classified.message).toBe('Network connection failed')
      expect(classified.userAction).toBe('Check your internet connection')
    })

    it('should classify fetch errors', () => {
      const error = new Error('Failed to fetch from API')
      const classified = classifyAIError(error)

      expect(classified.type).toBe('network')
    })

    it('should classify connection errors', () => {
      const error = new Error('Connection refused')
      const classified = classifyAIError(error)

      expect(classified.type).toBe('network')
    })

    it('should classify unknown errors', () => {
      const error = new Error('Something unexpected happened')
      const classified = classifyAIError(error)

      expect(classified.type).toBe('unknown')
      expect(classified.message).toBe('Something unexpected happened')
      expect(classified.userAction).toBe('Please try again or contact support')
    })

    it('should handle empty error messages', () => {
      const error = new Error('')
      const classified = classifyAIError(error)

      expect(classified.type).toBe('unknown')
      expect(classified.message).toBe('')
    })

    it('should be case-insensitive', () => {
      const error = new Error('RATE LIMIT EXCEEDED')
      const classified = classifyAIError(error)

      expect(classified.type).toBe('rate_limit')
    })
  })

  describe('formatClassifiedError', () => {
    it('should format error message with user action', () => {
      const classified = {
        type: 'timeout' as const,
        message: 'AI service timed out',
        userAction: 'Try a simpler request or try again later'
      }

      const formatted = formatClassifiedError(classified)
      expect(formatted).toBe('AI service timed out. Try a simpler request or try again later')
    })

    it('should format auth error', () => {
      const classified = {
        type: 'auth' as const,
        message: 'Authentication failed',
        userAction: 'Check your API key in Settings'
      }

      const formatted = formatClassifiedError(classified)
      expect(formatted).toBe('Authentication failed. Check your API key in Settings')
    })

    it('should format rate limit error', () => {
      const classified = {
        type: 'rate_limit' as const,
        message: 'Rate limit exceeded',
        userAction: 'Wait a moment and try again'
      }

      const formatted = formatClassifiedError(classified)
      expect(formatted).toBe('Rate limit exceeded. Wait a moment and try again')
    })

    it('should format unknown error', () => {
      const classified = {
        type: 'unknown' as const,
        message: 'Unexpected error occurred',
        userAction: 'Please try again or contact support'
      }

      const formatted = formatClassifiedError(classified)
      expect(formatted).toBe('Unexpected error occurred. Please try again or contact support')
    })
  })

  describe('real-world error messages', () => {
    it('should handle OpenAI rate limit error', () => {
      const error = new Error('Rate limit reached for gpt-4-turbo in organization org-xxx on tokens per min.')
      const classified = classifyAIError(error)

      expect(classified.type).toBe('rate_limit')
    })

    it('should handle Anthropic auth error', () => {
      const error = new Error('authentication_error: invalid x-api-key')
      const classified = classifyAIError(error)

      expect(classified.type).toBe('auth')
    })

    it('should handle Gemini model error', () => {
      const error = new Error('models/gemini-pro-xxx not found. Invalid model name.')
      const classified = classifyAIError(error)

      expect(classified.type).toBe('model')
    })

    it('should handle network timeout', () => {
      const error = new Error('AI request timed out after 60 seconds')
      const classified = classifyAIError(error)

      expect(classified.type).toBe('timeout')
    })

    it('should handle OpenAI quota error', () => {
      const error = new Error('You exceeded your current quota, please check your plan and billing details.')
      const classified = classifyAIError(error)

      expect(classified.type).toBe('quota')
    })

    it('should handle fetch network error', () => {
      const error = new Error('Network error: Failed to fetch')
      const classified = classifyAIError(error)

      expect(classified.type).toBe('network')
    })
  })
})
