import React from 'react'

/**
 * Simple CSS selector syntax highlighting
 * Highlights classes, IDs, pseudo-selectors, combinators, and strings
 */
export const highlightCSSSelector = (selector: string): React.ReactNode => {
  if (!selector) return null

  // Pattern to match different parts of CSS selectors
  const parts = []
  let current = ''
  let inAttribute = false
  let inQuote = false
  let quoteChar = ''

  for (let i = 0; i < selector.length; i++) {
    const char = selector[i]

    if (inQuote) {
      current += char
      if (char === quoteChar) {
        inQuote = false
        parts.push({ type: 'string', value: current })
        current = ''
      }
    } else if (char === '"' || char === "'") {
      if (current) {
        parts.push({ type: 'text', value: current })
      }
      current = char
      inQuote = true
      quoteChar = char
    } else if (char === '.') {
      if (current) {
        parts.push({ type: 'text', value: current })
      }
      parts.push({ type: 'class', value: '.' })
      current = ''
    } else if (char === '#') {
      if (current) {
        parts.push({ type: 'text', value: current })
      }
      parts.push({ type: 'id', value: '#' })
      current = ''
    } else if (char === '[') {
      if (current) {
        parts.push({ type: 'text', value: current })
      }
      parts.push({ type: 'bracket', value: '[' })
      current = ''
      inAttribute = true
    } else if (char === ']') {
      if (current) {
        parts.push({ type: 'text', value: current })
      }
      parts.push({ type: 'bracket', value: ']' })
      current = ''
      inAttribute = false
    } else if (char === ':') {
      if (current) {
        parts.push({ type: 'text', value: current })
      }
      parts.push({ type: 'pseudo', value: ':' })
      current = ''
    } else if ((char === '>' || char === '+' || char === '~') && !inAttribute) {
      if (current) {
        parts.push({ type: 'text', value: current })
      }
      parts.push({ type: 'combinator', value: char })
      current = ''
    } else {
      current += char
    }
  }

  if (current) {
    parts.push({ type: 'text', value: current })
  }

  return (
    <>
      {parts.map((part, index) => {
        switch (part.type) {
          case 'class':
            return <span key={index} className="text-blue-600">{part.value}</span>
          case 'id':
            return <span key={index} className="text-purple-600">{part.value}</span>
          case 'bracket':
            return <span key={index} className="text-gray-600">{part.value}</span>
          case 'pseudo':
            return <span key={index} className="text-green-600">{part.value}</span>
          case 'combinator':
            return <span key={index} className="text-orange-600">{part.value}</span>
          case 'string':
            return <span key={index} className="text-red-500">{part.value}</span>
          default:
            return <span key={index}>{part.value}</span>
        }
      })}
    </>
  )
}

/**
 * Simple HTML syntax highlighting
 * Highlights tags, attributes, and string values
 */
export const highlightHTML = (html: string): React.ReactNode => {
  if (!html) return null

  const parts = []
  let current = ''
  let inTag = false
  let inTagName = false
  let inAttribute = false
  let inString = false
  let stringChar = ''

  for (let i = 0; i < html.length; i++) {
    const char = html[i]

    if (inString) {
      current += char
      if (char === stringChar) {
        inString = false
        parts.push({ type: 'string', value: current })
        current = ''
      }
    } else if (inTag && (char === '"' || char === "'")) {
      if (current) {
        parts.push({ type: inAttribute ? 'attribute' : 'text', value: current })
      }
      current = char
      inString = true
      stringChar = char
      inAttribute = true
    } else if (char === '<') {
      if (current) {
        parts.push({ type: 'text', value: current })
      }
      parts.push({ type: 'bracket', value: '<' })
      current = ''
      inTag = true
      inTagName = true
    } else if (char === '>') {
      if (current) {
        parts.push({ type: inTagName ? 'tagName' : 'attribute', value: current })
      }
      parts.push({ type: 'bracket', value: '>' })
      current = ''
      inTag = false
      inTagName = false
      inAttribute = false
    } else if (inTag && char === ' ') {
      if (current) {
        parts.push({ type: inTagName ? 'tagName' : 'attribute', value: current })
      }
      current = ' '
      inTagName = false
      inAttribute = true
    } else if (inTag && char === '/') {
      if (current) {
        parts.push({ type: 'attribute', value: current })
      }
      parts.push({ type: 'bracket', value: '/' })
      current = ''
    } else {
      current += char
    }
  }

  if (current) {
    parts.push({ type: 'text', value: current })
  }

  return (
    <>
      {parts.map((part, index) => {
        switch (part.type) {
          case 'bracket':
            return <span key={index} className="text-gray-600">{part.value}</span>
          case 'tagName':
            return <span key={index} className="text-blue-600">{part.value}</span>
          case 'attribute':
            return <span key={index} className="text-purple-600">{part.value}</span>
          case 'string':
            return <span key={index} className="text-green-600">{part.value}</span>
          default:
            return <span key={index}>{part.value}</span>
        }
      })}
    </>
  )
}
