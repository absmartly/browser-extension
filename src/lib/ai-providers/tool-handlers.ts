import { captureHTMLChunks, queryXPath } from '~src/utils/html-capture'
import { validateXPath } from '~src/utils/xpath-validator'
import { validateSelector } from '~src/utils/selector-validator'

export interface ToolCallResult {
  toolName: string
  result?: string
  error?: string
}

export async function handleCssQuery(selectors: string[]): Promise<ToolCallResult> {
  console.log(`[ToolHandler] 📄 CSS query for ${selectors.length} selector(s):`, selectors)

  for (const selector of selectors) {
    if (!validateSelector(selector)) {
      return {
        toolName: 'css_query',
        error: `Invalid CSS selector: "${selector}". Selector must use safe patterns only.`
      }
    }
  }

  const chunkResults = await captureHTMLChunks(selectors)

  const resultParts: string[] = []
  for (const chunkResult of chunkResults) {
    if (chunkResult.found) {
      resultParts.push(`## ${chunkResult.selector}\n\`\`\`html\n${chunkResult.html}\n\`\`\``)
    } else {
      resultParts.push(`## ${chunkResult.selector}\nError: ${chunkResult.error || 'Element not found'}`)
    }
  }

  return {
    toolName: 'css_query',
    result: resultParts.join('\n\n')
  }
}

export async function handleXPathQuery(
  xpath: string,
  maxResults: number = 10
): Promise<ToolCallResult> {
  if (!validateXPath(xpath)) {
    return {
      toolName: 'xpath_query',
      error: `Invalid XPath expression: "${xpath}". XPath must use safe patterns only.`
    }
  }

  console.log(`[ToolHandler] 🔍 Executing XPath: "${xpath}" (max ${maxResults} results)`)

  const xpathResult = await queryXPath(xpath, maxResults)

  let resultContent: string
  if (xpathResult.found) {
    const parts: string[] = [`Found ${xpathResult.matches.length} node(s) matching XPath "${xpath}":\n`]
    for (const match of xpathResult.matches) {
      const selectorInfo = match.selector ? `Selector: \`${match.selector}\`` : '(No CSS selector available)'
      parts.push(`## ${selectorInfo}\nNode type: ${match.nodeType}\nText preview: ${match.textContent}\n\`\`\`html\n${match.html}\n\`\`\``)
    }
    resultContent = parts.join('\n\n')
  } else {
    resultContent = xpathResult.error || `No nodes found matching XPath: "${xpath}"`
  }

  return {
    toolName: 'xpath_query',
    result: resultContent
  }
}
