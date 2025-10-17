import { describe, it, expect } from '@jest/globals'
import React from 'react'
import { render } from '@testing-library/react'
import { highlightCSSSelector, highlightHTML } from '../syntax-highlighter'

describe('syntax-highlighter', () => {
  describe('highlightCSSSelector', () => {
    it('should return null for empty selector', () => {
      const result = highlightCSSSelector('')
      expect(result).toBeNull()
    })

    it('should highlight class selectors', () => {
      const result = highlightCSSSelector('.my-class')
      const { container } = render(<>{result}</>)

      const classSpan = container.querySelector('.text-blue-600')
      expect(classSpan).toBeTruthy()
      expect(classSpan?.textContent).toBe('.')
    })

    it('should highlight ID selectors', () => {
      const result = highlightCSSSelector('#my-id')
      const { container } = render(<>{result}</>)

      const idSpan = container.querySelector('.text-purple-600')
      expect(idSpan).toBeTruthy()
      expect(idSpan?.textContent).toBe('#')
    })

    it('should highlight pseudo-selectors', () => {
      const result = highlightCSSSelector('a:hover')
      const { container } = render(<>{result}</>)

      const pseudoSpan = container.querySelector('.text-green-600')
      expect(pseudoSpan).toBeTruthy()
      expect(pseudoSpan?.textContent).toBe(':')
    })

    it('should highlight combinators', () => {
      const result = highlightCSSSelector('div > span')
      const { container } = render(<>{result}</>)

      const combinatorSpan = container.querySelector('.text-orange-600')
      expect(combinatorSpan).toBeTruthy()
      expect(combinatorSpan?.textContent).toBe('>')
    })

    it('should highlight attribute selectors', () => {
      const result = highlightCSSSelector('[data-test="value"]')
      const { container } = render(<>{result}</>)

      const bracketSpans = container.querySelectorAll('.text-gray-600')
      expect(bracketSpans.length).toBeGreaterThanOrEqual(2) // [ and ]
    })

    it('should highlight strings in attribute selectors', () => {
      const result = highlightCSSSelector('[data-test="value"]')
      const { container } = render(<>{result}</>)

      const stringSpan = container.querySelector('.text-red-500')
      expect(stringSpan).toBeTruthy()
      expect(stringSpan?.textContent).toContain('"value"')
    })

    it('should handle complex selectors', () => {
      const result = highlightCSSSelector('.container > #header.active:hover [data-role="button"]')
      const { container } = render(<>{result}</>)

      // Should have class, ID, pseudo, combinator, and string highlights
      expect(container.querySelector('.text-blue-600')).toBeTruthy() // class
      expect(container.querySelector('.text-purple-600')).toBeTruthy() // ID
      expect(container.querySelector('.text-green-600')).toBeTruthy() // pseudo
      expect(container.querySelector('.text-orange-600')).toBeTruthy() // combinator
      expect(container.querySelector('.text-red-500')).toBeTruthy() // string
    })
  })

  describe('highlightHTML', () => {
    it('should return null for empty HTML', () => {
      const result = highlightHTML('')
      expect(result).toBeNull()
    })

    it('should highlight tag brackets', () => {
      const result = highlightHTML('<div></div>')
      const { container } = render(<>{result}</>)

      const bracketSpans = container.querySelectorAll('.text-gray-600')
      expect(bracketSpans.length).toBeGreaterThanOrEqual(4) // <, >, </, >
    })

    it('should highlight tag names', () => {
      const result = highlightHTML('<div></div>')
      const { container } = render(<>{result}</>)

      const tagSpans = container.querySelectorAll('.text-blue-600')
      expect(tagSpans.length).toBe(2) // opening and closing div
      expect(tagSpans[0].textContent).toBe('div')
    })

    it('should highlight attributes', () => {
      const result = highlightHTML('<div class="container"></div>')
      const { container } = render(<>{result}</>)

      const attrSpan = container.querySelector('.text-purple-600')
      expect(attrSpan).toBeTruthy()
      expect(attrSpan?.textContent).toContain('class')
    })

    it('should highlight attribute values as strings', () => {
      const result = highlightHTML('<div class="container"></div>')
      const { container } = render(<>{result}</>)

      const stringSpan = container.querySelector('.text-green-600')
      expect(stringSpan).toBeTruthy()
      expect(stringSpan?.textContent).toContain('"container"')
    })

    it('should handle self-closing tags', () => {
      const result = highlightHTML('<img src="image.jpg" />')
      const { container } = render(<>{result}</>)

      const tagSpan = container.querySelector('.text-blue-600')
      expect(tagSpan?.textContent).toBe('img')

      const stringSpan = container.querySelector('.text-green-600')
      expect(stringSpan?.textContent).toContain('"image.jpg"')
    })

    it('should handle complex HTML', () => {
      const html = '<div class="container" id="main"><span data-role="title">Hello</span></div>'
      const result = highlightHTML(html)
      const { container } = render(<>{result}</>)

      // Should have multiple tag names
      const tagSpans = container.querySelectorAll('.text-blue-600')
      expect(tagSpans.length).toBeGreaterThanOrEqual(2) // div, span

      // Should have attributes
      const attrSpans = container.querySelectorAll('.text-purple-600')
      expect(attrSpans.length).toBeGreaterThanOrEqual(3) // class, id, data-role

      // Should have string values
      const stringSpans = container.querySelectorAll('.text-green-600')
      expect(stringSpans.length).toBeGreaterThanOrEqual(3) // "container", "main", "title"
    })

    it('should preserve text content outside tags', () => {
      const result = highlightHTML('<p>Hello World</p>')
      const { container } = render(<>{result}</>)

      expect(container.textContent).toContain('Hello World')
    })
  })
})
