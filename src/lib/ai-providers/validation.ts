import type { AIDOMGenerationResult } from '~src/types/dom-changes'

export interface ValidationError {
  isValid: false
  errors: string[]
}

export interface ValidationSuccess {
  isValid: true
  result: AIDOMGenerationResult
}

export type ValidationResult = ValidationError | ValidationSuccess

export function validateAIDOMGenerationResult(responseText: string): ValidationResult {
  const errors: string[] = []

  let parsedResult: any
  try {
    parsedResult = JSON.parse(responseText)
  } catch (error) {
    const parseError = error instanceof Error ? error.message : String(error)
    console.error('[Validation] JSON parse failed:', {
      error: parseError,
      received: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''),
      suggestion: 'Ensure the AI response is pure JSON without markdown code blocks or extra text'
    })
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
    console.error('[Validation] AI DOM Generation validation failed:', {
      errors,
      received: {
        domChanges: parsedResult?.domChanges ? `array[${parsedResult.domChanges.length}]` : typeof parsedResult?.domChanges,
        response: parsedResult?.response ? `string[${parsedResult.response.length}]` : typeof parsedResult?.response,
        action: parsedResult?.action || 'missing',
        targetSelectors: parsedResult?.targetSelectors ? `array[${parsedResult.targetSelectors.length}]` : undefined
      },
      expected: {
        domChanges: 'array of DOMChange objects',
        response: 'string (conversational message)',
        action: 'one of: append, replace_all, replace_specific, remove_specific, none',
        targetSelectors: 'array (required for replace_specific/remove_specific actions)'
      },
      suggestion: 'Fix the AI response to match the expected schema'
    })
    return { isValid: false, errors }
  }

  return {
    isValid: true,
    result: parsedResult as AIDOMGenerationResult
  }
}
