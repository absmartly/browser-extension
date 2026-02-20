declare const brand: unique symbol

type Brand<T, B> = T & { [brand]: B }

export type ExperimentId = Brand<number, 'ExperimentId'>
export type VariantName = Brand<string, 'VariantName'>
export type CSSSelector = Brand<string, 'CSSSelector'>
export type XPathSelector = Brand<string, 'XPathSelector'>
export type APIEndpoint = Brand<string, 'APIEndpoint'>
export type ApplicationId = Brand<number, 'ApplicationId'>
export type ConversationId = Brand<string, 'ConversationId'>
export type SessionId = Brand<string, 'SessionId'>

export function experimentId(id: number): ExperimentId {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid experiment ID: ${id}. Must be a positive integer.`)
  }
  return id as ExperimentId
}

export function variantName(name: string): VariantName {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error(`Invalid variant name: ${name}. Must be a non-empty string.`)
  }
  return name.trim() as VariantName
}

export function cssSelector(selector: string): CSSSelector {
  if (typeof selector !== 'string' || selector.trim().length === 0) {
    throw new Error(`Invalid CSS selector: ${selector}. Must be a non-empty string.`)
  }
  try {
    document.createDocumentFragment().querySelector(selector)
  } catch {
    throw new Error(`Invalid CSS selector syntax: ${selector}`)
  }
  return selector.trim() as CSSSelector
}

export function xpathSelector(xpath: string): XPathSelector {
  if (typeof xpath !== 'string' || xpath.trim().length === 0) {
    throw new Error(`Invalid XPath selector: ${xpath}. Must be a non-empty string.`)
  }
  return xpath.trim() as XPathSelector
}

export function apiEndpoint(url: string): APIEndpoint {
  if (typeof url !== 'string' || url.trim().length === 0) {
    throw new Error(`Invalid API endpoint: ${url}. Must be a non-empty string.`)
  }
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Protocol must be http or https')
    }
  } catch (error) {
    throw new Error(`Invalid API endpoint URL: ${url}. ${error instanceof Error ? error.message : ''}`)
  }
  return url.trim() as APIEndpoint
}

export function applicationId(id: number): ApplicationId {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid application ID: ${id}. Must be a positive integer.`)
  }
  return id as ApplicationId
}

export function conversationId(id: string): ConversationId {
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new Error(`Invalid conversation ID: ${id}. Must be a non-empty string.`)
  }
  return id.trim() as ConversationId
}

export function sessionId(id: string): SessionId {
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new Error(`Invalid session ID: ${id}. Must be a non-empty string.`)
  }
  return id.trim() as SessionId
}

export function unsafeExperimentId(id: number): ExperimentId {
  return id as ExperimentId
}

export function unsafeVariantName(name: string): VariantName {
  return name as VariantName
}

export function unsafeCSSSelector(selector: string): CSSSelector {
  return selector as CSSSelector
}

export function unsafeXPathSelector(xpath: string): XPathSelector {
  return xpath as XPathSelector
}

export function unsafeAPIEndpoint(url: string): APIEndpoint {
  return url as APIEndpoint
}

export function unsafeApplicationId(id: number): ApplicationId {
  return id as ApplicationId
}

export function unsafeConversationId(id: string): ConversationId {
  return id as ConversationId
}

export function unsafeSessionId(id: string): SessionId {
  return id as SessionId
}
