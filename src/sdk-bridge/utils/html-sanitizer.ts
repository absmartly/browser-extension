/**
 * HTML Sanitization Utility
 *
 * Provides XSS protection by sanitizing HTML content using DOMPurify.
 * Removes dangerous tags, attributes, and URIs.
 *
 * @module HTMLSanitizer
 */

import DOMPurify from 'dompurify'

/**
 * Sanitize HTML to prevent XSS attacks
 *
 * This function removes:
 * - Dangerous tags: script, iframe, object, embed, link, style, meta, base
 * - Event handler attributes: onerror, onload, onclick, etc.
 * - Dangerous URIs: javascript:, data:
 *
 * Uses DOMPurify for robust sanitization with proper XSS protection.
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

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'div', 'span', 'p', 'a', 'img', 'br', 'hr',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'table', 'thead', 'tbody', 'tr', 'td', 'th',
      'strong', 'em', 'b', 'i', 'u',
      'blockquote', 'pre', 'code'
    ],
    ALLOWED_ATTR: [
      'class', 'id', 'style',
      'href', 'src', 'alt', 'title',
      'width', 'height',
      'colspan', 'rowspan'
    ],
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true
  })
}
