export interface DOMNode {
  tag: string
  id?: string
  classes?: string[]
  dataAttrs?: Record<string, string>
  ariaLabel?: string
  role?: string
  selector: string
  childCount: number
  textPreview?: string
  children?: DOMNode[]
}

export interface DOMStructure {
  root: DOMNode
  totalElements: number
  maxDepth: number
}

export interface DOMStructureOptions {
  maxDepth?: number
  includeTextPreview?: boolean
  includeDataAttrs?: boolean
  maxClasses?: number
  excludeSelectors?: string[]
}

export const DEFAULT_DOM_STRUCTURE_OPTIONS: DOMStructureOptions = {
  maxDepth: 10,
  maxClasses: 5,
  includeDataAttrs: true,
  includeTextPreview: true
}

const DEFAULT_EXCLUDE_SELECTORS = [
  '#__plasmo',
  '#__plasmo-loading__',
  '[data-plasmo]',
  'plasmo-csui',
  'script',
  'style',
  'noscript',
  'iframe[id^="absmartly-"]',
  '[id^="__framer-"]',
  '[id^="hs-web-interactives-"]',
  '[id^="tldx-"]'
]

function generateSelector(element: Element, parent?: Element): string {
  if (element.id) {
    return `#${element.id}`
  }

  const tag = element.tagName.toLowerCase()
  const classes = Array.from(element.classList).filter(c =>
    !c.startsWith('__') &&
    !c.includes('plasmo') &&
    !c.includes('framer-')
  )

  let selector = tag
  if (classes.length > 0) {
    selector += '.' + classes.slice(0, 2).join('.')
  }

  if (parent) {
    const siblings = Array.from(parent.children).filter(
      el => el.tagName === element.tagName
    )
    if (siblings.length > 1) {
      const index = siblings.indexOf(element) + 1
      selector += `:nth-of-type(${index})`
    }
  }

  return selector
}

function getTextPreview(element: Element, maxLength: number = 50): string | undefined {
  const textContent = element.textContent?.trim() || ''
  if (!textContent || element.children.length > 0) {
    return undefined
  }

  if (textContent.length <= maxLength) {
    return textContent
  }

  return textContent.substring(0, maxLength) + '...'
}

function shouldExclude(element: Element, excludeSelectors: string[]): boolean {
  for (const selector of excludeSelectors) {
    try {
      if (element.matches(selector)) {
        return true
      }
    } catch {
      continue
    }
  }
  return false
}

function buildDOMNode(
  element: Element,
  parentElement: Element | undefined,
  currentDepth: number,
  options: Required<DOMStructureOptions>,
  stats: { totalElements: number; maxDepth: number }
): DOMNode | null {
  if (shouldExclude(element, options.excludeSelectors)) {
    return null
  }

  stats.totalElements++
  stats.maxDepth = Math.max(stats.maxDepth, currentDepth)

  const tag = element.tagName.toLowerCase()
  const id = element.id || undefined
  const classes = Array.from(element.classList).filter(c =>
    !c.startsWith('__') &&
    !c.includes('plasmo')
  )

  const node: DOMNode = {
    tag,
    selector: generateSelector(element, parentElement),
    childCount: element.children.length
  }

  if (id) {
    node.id = id
  }

  if (classes.length > 0) {
    node.classes = classes.slice(0, options.maxClasses)
  }

  if (options.includeDataAttrs) {
    const dataAttrs: Record<string, string> = {}
    for (const attr of Array.from(element.attributes)) {
      if (attr.name.startsWith('data-') && !attr.name.includes('plasmo')) {
        const shortValue = attr.value.length > 50 ? attr.value.slice(0, 50) + '...' : attr.value
        dataAttrs[attr.name] = shortValue
      }
    }
    if (Object.keys(dataAttrs).length > 0) {
      node.dataAttrs = dataAttrs
    }

    const ariaLabel = element.getAttribute('aria-label')
    if (ariaLabel) {
      node.ariaLabel = ariaLabel.length > 50 ? ariaLabel.slice(0, 50) + '...' : ariaLabel
    }

    const role = element.getAttribute('role')
    if (role) {
      node.role = role
    }
  }

  if (options.includeTextPreview && element.children.length === 0) {
    const preview = getTextPreview(element)
    if (preview) {
      node.textPreview = preview
    }
  }

  if (currentDepth < options.maxDepth && element.children.length > 0) {
    const children: DOMNode[] = []
    for (const child of Array.from(element.children)) {
      const childNode = buildDOMNode(
        child,
        element,
        currentDepth + 1,
        options,
        stats
      )
      if (childNode) {
        children.push(childNode)
      }
    }
    if (children.length > 0) {
      node.children = children
    }
  }

  return node
}

export function generateDOMStructure(
  html: string,
  options?: DOMStructureOptions
): DOMStructure {
  const opts: Required<DOMStructureOptions> = {
    maxDepth: options?.maxDepth ?? 8,
    includeTextPreview: options?.includeTextPreview ?? true,
    includeDataAttrs: options?.includeDataAttrs ?? true,
    maxClasses: options?.maxClasses ?? 5,
    excludeSelectors: options?.excludeSelectors ?? DEFAULT_EXCLUDE_SELECTORS
  }

  if (typeof DOMParser === 'undefined') {
    console.warn('[DOM Structure] DOMParser not available (service worker context), using fallback structure')
    return generateFallbackStructure(html)
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const body = doc.body

  const stats = { totalElements: 0, maxDepth: 0 }

  const rootNode = buildDOMNode(body, undefined, 0, opts, stats)

  if (!rootNode) {
    return {
      root: {
        tag: 'body',
        selector: 'body',
        childCount: 0
      },
      totalElements: 0,
      maxDepth: 0
    }
  }

  return {
    root: rootNode,
    totalElements: stats.totalElements,
    maxDepth: stats.maxDepth
  }
}

function generateFallbackStructure(html: string): DOMStructure {
  const tagMatches = html.match(/<(\w+)[\s>]/g) || []
  const uniqueTags = [...new Set(tagMatches.map(m => m.replace(/<|[\s>]/g, '').toLowerCase()))]

  const idMatches = html.match(/id="([^"]+)"/g) || []
  const ids = idMatches.map(m => m.replace(/id="|"/g, ''))

  const children: DOMNode[] = []

  for (const id of ids.slice(0, 10)) {
    children.push({
      tag: 'element',
      id,
      selector: `#${id}`,
      childCount: 0
    })
  }

  for (const tag of uniqueTags.filter(t => ['main', 'header', 'footer', 'nav', 'section', 'article', 'aside', 'div'].includes(t)).slice(0, 5)) {
    if (!children.some(c => c.tag === tag)) {
      children.push({
        tag,
        selector: tag,
        childCount: 0
      })
    }
  }

  return {
    root: {
      tag: 'body',
      selector: 'body',
      childCount: children.length,
      children: children.length > 0 ? children : undefined
    },
    totalElements: children.length + 1,
    maxDepth: 1
  }
}

function formatNode(node: DOMNode, prefix: string, isLast: boolean): string[] {
  const lines: string[] = []

  const connector = isLast ? '└── ' : '├── '
  const childPrefix = isLast ? '    ' : '│   '

  let label = node.tag
  if (node.id) {
    label += `#${node.id}`
  }
  if (node.classes && node.classes.length > 0) {
    label += '.' + node.classes.join('.')
  }

  if (node.role) {
    label += ` [role="${node.role}"]`
  }

  if (node.ariaLabel) {
    label += ` [aria-label="${node.ariaLabel}"]`
  }

  if (node.dataAttrs && Object.keys(node.dataAttrs).length > 0) {
    const attrs = Object.entries(node.dataAttrs)
      .slice(0, 3)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ')
    label += ` {${attrs}}`
  }

  if (node.childCount > 0 && !node.children) {
    label += ` (${node.childCount} children)`
  }

  if (node.textPreview) {
    label += ` "${node.textPreview}"`
  }

  lines.push(prefix + connector + label)

  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]
      const isChildLast = i === node.children.length - 1
      lines.push(...formatNode(child, prefix + childPrefix, isChildLast))
    }
  }

  return lines
}

export function formatDOMStructureAsText(structure: DOMStructure): string {
  const lines: string[] = []

  let rootLabel = structure.root.tag
  if (structure.root.id) {
    rootLabel += `#${structure.root.id}`
  }
  lines.push(rootLabel)

  if (structure.root.children) {
    for (let i = 0; i < structure.root.children.length; i++) {
      const child = structure.root.children[i]
      const isLast = i === structure.root.children.length - 1
      lines.push(...formatNode(child, '', isLast))
    }
  }

  return lines.join('\n')
}

export function getHTMLChunk(html: string, selector: string): { html: string; found: boolean; error?: string } {
  if (typeof DOMParser === 'undefined') {
    console.warn('[DOM Structure] DOMParser not available for getHTMLChunk, using regex fallback')
    return getHTMLChunkFallback(html, selector)
  }

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const element = doc.querySelector(selector)

    if (!element) {
      return {
        html: '',
        found: false,
        error: `Element not found: ${selector}`
      }
    }

    return {
      html: element.outerHTML,
      found: true
    }
  } catch (error) {
    return {
      html: '',
      found: false,
      error: `Failed to parse selector: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

function getHTMLChunkFallback(html: string, selector: string): { html: string; found: boolean; error?: string } {
  if (selector.startsWith('#')) {
    const id = selector.slice(1)
    const idRegex = new RegExp(`<([a-z0-9]+)[^>]*\\s+id=["']${id}["'][^>]*>`, 'i')
    const match = html.match(idRegex)

    if (match) {
      const tag = match[1]
      const startIndex = html.indexOf(match[0])
      const closeTag = `</${tag}>`
      let depth = 1
      let searchIndex = startIndex + match[0].length

      while (depth > 0 && searchIndex < html.length) {
        const nextOpen = html.indexOf(`<${tag}`, searchIndex)
        const nextClose = html.indexOf(closeTag, searchIndex)

        if (nextClose === -1) break

        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth++
          searchIndex = nextOpen + tag.length + 1
        } else {
          depth--
          if (depth === 0) {
            const chunk = html.substring(startIndex, nextClose + closeTag.length)
            return { html: chunk, found: true }
          }
          searchIndex = nextClose + closeTag.length
        }
      }
    }
  }

  return {
    html: '',
    found: false,
    error: `Fallback parser cannot find: ${selector} (DOMParser not available in service worker)`
  }
}
