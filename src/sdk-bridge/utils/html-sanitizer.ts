/**
 * HTML Sanitization Utility
 *
 * Provides XSS protection by sanitizing HTML content.
 * Removes dangerous tags, attributes, and URIs.
 *
 * @module HTMLSanitizer
 */

/**
 * Sanitize HTML to prevent XSS attacks
 *
 * This function removes:
 * - Dangerous tags: script, iframe, object, embed, link, style, meta, base
 * - Event handler attributes: onerror, onload, onclick, etc.
 * - Dangerous URIs: javascript:, data:
 *
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string safe for insertion into DOM
 *
 * @example
 * ```typescript
 * const unsafe = '<img src=x onerror=alert(1)>'
 * const safe = sanitizeHTML(unsafe) // '<img src="x">'
 * ```
 */
export function sanitizeHTML(html: string): string {
  if (!html) return ''

  // Create a temporary element to parse the HTML
  const temp = document.createElement('div')
  temp.innerHTML = html

  // List of dangerous tags to remove
  const dangerousTags = [
    'script',
    'iframe',
    'object',
    'embed',
    'link',
    'style',
    'meta',
    'base'
  ]

  // List of dangerous attributes to remove
  const dangerousAttrs = [
    'onerror',
    'onload',
    'onclick',
    'onmouseover',
    'onfocus',
    'onblur',
    'onchange',
    'onsubmit'
  ]

  // Remove dangerous tags
  dangerousTags.forEach((tag) => {
    const elements = temp.querySelectorAll(tag)
    elements.forEach((el) => el.remove())
  })

  // Remove dangerous attributes from all elements
  const allElements = temp.querySelectorAll('*')
  allElements.forEach((el) => {
    // Remove event handler attributes
    dangerousAttrs.forEach((attr) => {
      if (el.hasAttribute(attr)) {
        el.removeAttribute(attr)
      }
    })

    // Remove any attribute starting with 'on'
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.toLowerCase().startsWith('on')) {
        el.removeAttribute(attr.name)
      }
    })

    // Sanitize href and src attributes
    ;['href', 'src'].forEach((attr) => {
      if (el.hasAttribute(attr)) {
        const value = el.getAttribute(attr)
        // Remove javascript: and data: URIs
        if (value && /^(javascript|data):/i.test(value)) {
          el.removeAttribute(attr)
        }
      }
    })
  })

  return temp.innerHTML
}
