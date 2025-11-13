import { marked } from 'marked'
import DOMPurify from 'dompurify'

export function renderMarkdown(markdown: string): string {
  const rawHtml = marked(markdown)
  return DOMPurify.sanitize(rawHtml)
}
