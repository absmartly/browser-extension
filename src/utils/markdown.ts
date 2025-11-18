import { marked } from 'marked'
import DOMPurify from 'dompurify'

function cleanMarkdownContent(markdown: string): string {
  let cleaned = markdown

  // Remove code fences (```json, ```, etc.)
  cleaned = cleaned.replace(/```json\s*/gi, '')
  cleaned = cleaned.replace(/```\s*/g, '')

  // Remove duplicate consecutive paragraphs (simple deduplication)
  // Split by double newlines, remove exact duplicates, rejoin
  const paragraphs = cleaned.split(/\n\n+/)
  const uniqueParagraphs: string[] = []
  let lastParagraph = ''

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (trimmed && trimmed !== lastParagraph) {
      uniqueParagraphs.push(para)
      lastParagraph = trimmed
    }
  }

  cleaned = uniqueParagraphs.join('\n\n')

  return cleaned
}

export function renderMarkdown(markdown: string): string {
  const cleaned = cleanMarkdownContent(markdown)
  const rawHtml = marked(cleaned)

  // Sanitize and add custom CSS classes for code blocks
  const sanitized = DOMPurify.sanitize(rawHtml)

  // Wrap in a div with custom styles for code blocks
  return `<style>
    .markdown-content pre {
      overflow-x: auto;
      max-width: 100%;
      background: #f6f8fa;
      padding: 12px;
      border-radius: 6px;
      font-size: 12px;
      line-height: 1.5;
    }
    .markdown-content code {
      word-break: break-word;
      overflow-wrap: break-word;
      white-space: pre-wrap;
    }
    .markdown-content pre code {
      white-space: pre;
    }
  </style><div class="markdown-content">${sanitized}</div>`
}
