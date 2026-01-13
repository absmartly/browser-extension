import { debugLog, debugError } from './debug'

export interface HTMLChunkResult {
  selector: string
  html: string
  found: boolean
  error?: string
}

export interface TextSearchResult {
  text: string
  selector: string
  html: string
  found: boolean
  error?: string
}

export interface TextSearchMatch {
  selector: string
  html: string
  textContent: string
}

export interface TextSearchResults {
  searchText: string
  matches: TextSearchMatch[]
  found: boolean
  error?: string
}

export interface XPathMatch {
  selector: string
  html: string
  textContent: string
  nodeType: string
}

export interface XPathResults {
  xpath: string
  matches: XPathMatch[]
  found: boolean
  error?: string
}

export async function captureHTMLChunk(selector: string): Promise<HTMLChunkResult> {
  const results = await captureHTMLChunks([selector])
  return results[0]
}

export async function captureHTMLChunks(selectors: string[], tabId?: number): Promise<HTMLChunkResult[]> {
  console.log('[HTML Capture] Capturing chunks for selectors:', selectors, 'tabId:', tabId)

  try {
    if (!chrome?.tabs || !chrome?.scripting) {
      console.error('[HTML Capture] chrome.tabs or chrome.scripting API not available!')
      return selectors.map(sel => ({ selector: sel, html: '', found: false, error: 'chrome.scripting API not available' }))
    }

    let targetTabId = tabId
    if (!targetTabId) {
      // Try to find the active tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!activeTab?.id) {
        // Fallback: try to find any active tab in any window
        const [anyActiveTab] = await chrome.tabs.query({ active: true })
        if (!anyActiveTab?.id) {
          return selectors.map(sel => ({ selector: sel, html: '', found: false, error: 'No active tab found' }))
        }
        targetTabId = anyActiveTab.id
        console.log('[HTML Capture] Using fallback active tab:', targetTabId)
      } else {
        targetTabId = activeTab.id
      }
    }

    // Validate the tab exists and is a valid webpage
    try {
      const tab = await chrome.tabs.get(targetTabId)
      if (!tab.url ||
          tab.url.startsWith('chrome-extension://') ||
          tab.url.startsWith('chrome://') ||
          tab.url.startsWith('about:')) {
        return selectors.map(sel => ({ selector: sel, html: '', found: false, error: 'Tab is not a webpage' }))
      }
    } catch (e) {
      return selectors.map(sel => ({ selector: sel, html: '', found: false, error: `Tab ${targetTabId} not found` }))
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: (sels: string[]) => {
        return sels.map(sel => {
          const element = document.querySelector(sel)
          if (!element) {
            return { selector: sel, html: '', found: false, error: `Element not found: ${sel}` }
          }
          return { selector: sel, html: element.outerHTML, found: true }
        })
      },
      args: [selectors]
    })

    if (!results || results.length === 0 || !results[0]?.result) {
      return selectors.map(sel => ({ selector: sel, html: '', found: false, error: 'Failed to execute script' }))
    }

    const chunkResults = results[0].result as HTMLChunkResult[]
    for (const result of chunkResults) {
      console.log('[HTML Capture] Chunk result for', result.selector + ':', result.found ? `${result.html.length} chars` : result.error)
    }
    return chunkResults
  } catch (error) {
    console.error('[HTML Capture] Chunk error:', error)
    return selectors.map(sel => ({ selector: sel, html: '', found: false, error: (error as Error).message }))
  }
}

export async function searchTextInPage(searchText: string, maxResults: number = 5): Promise<TextSearchResults> {
  console.log('[HTML Capture] Searching for text:', searchText)

  try {
    if (!chrome?.tabs || !chrome?.scripting) {
      console.error('[HTML Capture] chrome.tabs or chrome.scripting API not available!')
      return { searchText, matches: [], found: false, error: 'chrome.scripting API not available' }
    }

    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!activeTab?.id) {
      return { searchText, matches: [], found: false, error: 'No active tab found' }
    }

    if (!activeTab.url ||
        activeTab.url.startsWith('chrome-extension://') ||
        activeTab.url.startsWith('chrome://') ||
        activeTab.url.startsWith('about:')) {
      return { searchText, matches: [], found: false, error: 'Active tab is not a webpage' }
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: (text: string, limit: number) => {
        const matches: { selector: string; html: string; textContent: string }[] = []

        const generateSelector = (element: Element): string => {
          if (element.id) {
            return `#${element.id}`
          }

          const tagName = element.tagName.toLowerCase()
          const classes = Array.from(element.classList).filter(c => c && !c.includes(':'))

          if (classes.length > 0) {
            const classSelector = `${tagName}.${classes.slice(0, 2).join('.')}`
            if (document.querySelectorAll(classSelector).length === 1) {
              return classSelector
            }
          }

          const parent = element.parentElement
          if (parent) {
            const siblings = Array.from(parent.children).filter(c => c.tagName === element.tagName)
            if (siblings.length > 1) {
              const index = siblings.indexOf(element) + 1
              const parentSelector = generateSelector(parent)
              return `${parentSelector} > ${tagName}:nth-of-type(${index})`
            }
            const parentSelector = generateSelector(parent)
            return `${parentSelector} > ${tagName}`
          }

          return tagName
        }

        try {
          const xpath = `//*[contains(text(), "${text.replace(/"/g, '\\"')}")]`
          const xpathResult = document.evaluate(
            xpath,
            document.body,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
          )

          for (let i = 0; i < Math.min(xpathResult.snapshotLength, limit); i++) {
            const node = xpathResult.snapshotItem(i) as Element
            if (node && node.outerHTML) {
              matches.push({
                selector: generateSelector(node),
                html: node.outerHTML,
                textContent: node.textContent?.slice(0, 200) || ''
              })
            }
          }
        } catch (xpathError) {
          console.error('[HTML Capture] XPath error:', xpathError)
        }

        return matches
      },
      args: [searchText, maxResults]
    })

    if (!results || results.length === 0 || !results[0]?.result) {
      return { searchText, matches: [], found: false, error: 'Failed to execute search script' }
    }

    const matches = results[0].result as TextSearchMatch[]
    console.log('[HTML Capture] Text search found', matches.length, 'matches')
    return { searchText, matches, found: matches.length > 0 }
  } catch (error) {
    console.error('[HTML Capture] Text search error:', error)
    return { searchText, matches: [], found: false, error: (error as Error).message }
  }
}

export async function queryXPath(xpath: string, maxResults: number = 10): Promise<XPathResults> {
  console.log('[HTML Capture] Executing XPath query:', xpath)

  try {
    if (!chrome?.tabs || !chrome?.scripting) {
      console.error('[HTML Capture] chrome.tabs or chrome.scripting API not available!')
      return { xpath, matches: [], found: false, error: 'chrome.scripting API not available' }
    }

    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!activeTab?.id) {
      return { xpath, matches: [], found: false, error: 'No active tab found' }
    }

    if (!activeTab.url ||
        activeTab.url.startsWith('chrome-extension://') ||
        activeTab.url.startsWith('chrome://') ||
        activeTab.url.startsWith('about:')) {
      return { xpath, matches: [], found: false, error: 'Active tab is not a webpage' }
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: (xpathQuery: string, limit: number) => {
        const matches: { selector: string; html: string; textContent: string; nodeType: string }[] = []

        const generateSelector = (element: Element): string => {
          if (element.id) {
            return `#${element.id}`
          }

          const tagName = element.tagName.toLowerCase()
          const classes = Array.from(element.classList).filter(c => c && !c.includes(':'))

          if (classes.length > 0) {
            const classSelector = `${tagName}.${classes.slice(0, 2).join('.')}`
            if (document.querySelectorAll(classSelector).length === 1) {
              return classSelector
            }
          }

          const parent = element.parentElement
          if (parent) {
            const siblings = Array.from(parent.children).filter(c => c.tagName === element.tagName)
            if (siblings.length > 1) {
              const index = siblings.indexOf(element) + 1
              const parentSelector = generateSelector(parent)
              return `${parentSelector} > ${tagName}:nth-of-type(${index})`
            }
            const parentSelector = generateSelector(parent)
            return `${parentSelector} > ${tagName}`
          }

          return tagName
        }

        try {
          const xpathResult = document.evaluate(
            xpathQuery,
            document,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
          )

          for (let i = 0; i < Math.min(xpathResult.snapshotLength, limit); i++) {
            const node = xpathResult.snapshotItem(i)
            if (!node) continue

            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element
              matches.push({
                selector: generateSelector(element),
                html: element.outerHTML.slice(0, 2000),
                textContent: element.textContent?.slice(0, 200) || '',
                nodeType: 'element'
              })
            } else if (node.nodeType === Node.TEXT_NODE) {
              const parentElement = node.parentElement
              if (parentElement) {
                matches.push({
                  selector: generateSelector(parentElement),
                  html: parentElement.outerHTML.slice(0, 2000),
                  textContent: node.textContent?.slice(0, 200) || '',
                  nodeType: 'text'
                })
              }
            } else if (node.nodeType === Node.ATTRIBUTE_NODE) {
              const attr = node as Attr
              matches.push({
                selector: '',
                html: `${attr.name}="${attr.value}"`,
                textContent: attr.value,
                nodeType: 'attribute'
              })
            }
          }
        } catch (xpathError: any) {
          return { error: xpathError.message || 'Invalid XPath expression' }
        }

        return { matches }
      },
      args: [xpath, maxResults]
    })

    if (!results || results.length === 0 || !results[0]?.result) {
      return { xpath, matches: [], found: false, error: 'Failed to execute XPath script' }
    }

    const result = results[0].result as { matches?: XPathMatch[]; error?: string }

    if (result.error) {
      return { xpath, matches: [], found: false, error: result.error }
    }

    const matches = result.matches || []
    console.log('[HTML Capture] XPath query found', matches.length, 'matches')
    return { xpath, matches, found: matches.length > 0 }
  } catch (error) {
    console.error('[HTML Capture] XPath query error:', error)
    return { xpath, matches: [], found: false, error: (error as Error).message }
  }
}

export interface PageCaptureResult {
  html: string
  url: string
  domStructure: string
}

function generateDOMStructureInPage(): string {
  const MAX_DEPTH = 10
  const MAX_CLASSES = 5

  const EXCLUDE_SELECTORS = [
    '#__plasmo',
    '#__plasmo-loading__',
    '[data-plasmo]',
    'plasmo-csui',
    'script',
    'style',
    'noscript',
    'iframe[id^="absmartly-"]'
  ]

  function shouldExclude(el: Element): boolean {
    for (const sel of EXCLUDE_SELECTORS) {
      try {
        if (el.matches(sel)) return true
      } catch { /* ignore */ }
    }
    return false
  }

  function getElementSignature(el: Element): string {
    let sig = el.tagName.toLowerCase()
    if (el.id) sig += `#${el.id}`
    const classes = Array.from(el.classList)
      .filter(c => !c.startsWith('__') && !c.includes('plasmo'))
      .slice(0, MAX_CLASSES)
    if (classes.length > 0) sig += '.' + classes.join('.')
    return sig
  }

  function findVaryingClasses(elements: Element[]): Set<string> {
    if (elements.length <= 1) return new Set()

    const allClassSets = elements.map(el => new Set(Array.from(el.classList)))
    const firstClasses = allClassSets[0]
    const varying = new Set<string>()

    // Check each class in first element
    for (const cls of firstClasses) {
      for (let i = 1; i < allClassSets.length; i++) {
        if (!allClassSets[i].has(cls)) {
          varying.add(cls)
          break
        }
      }
    }

    // Check for classes in other elements not in first
    for (let i = 1; i < allClassSets.length; i++) {
      for (const cls of allClassSets[i]) {
        if (!firstClasses.has(cls)) {
          varying.add(cls)
        }
      }
    }

    return varying
  }

  function formatNodeWithVariations(
    el: Element,
    allElements: Element[],
    prefix: string,
    isLast: boolean,
    depth: number,
    count: number
  ): string[] {
    if (shouldExclude(el) || depth > MAX_DEPTH) return []

    const lines: string[] = []
    const connector = isLast ? '└── ' : '├── '
    const childPrefix = isLast ? '    ' : '│   '

    let label = el.tagName.toLowerCase()

    if (el.id) {
      label += `#${el.id}`
    }

    // Find which classes vary across all elements
    const varyingClasses = findVaryingClasses(allElements)
    const classes = Array.from(el.classList)
      .filter(c => !c.startsWith('__') && !c.includes('plasmo'))
      .slice(0, MAX_CLASSES)

    if (classes.length > 0) {
      const stableClasses = classes.filter(c => !varyingClasses.has(c))
      if (stableClasses.length > 0) {
        label += '.' + stableClasses.join('.')
      }
      if (varyingClasses.size > 0) {
        const varyingList = classes.filter(c => varyingClasses.has(c))
        if (varyingList.length > 0) {
          label += '.[varies]'
        }
      }
    }

    const role = el.getAttribute('role')
    if (role) {
      label += ` [role="${role}"]`
    }

    const ariaLabel = el.getAttribute('aria-label')
    if (ariaLabel) {
      const short = ariaLabel.length > 30 ? ariaLabel.slice(0, 30) + '...' : ariaLabel
      label += ` [aria-label="${short}"]`
    }

    const dataAttrs: string[] = []
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('data-') && !attr.name.includes('plasmo')) {
        const val = attr.value.length > 30 ? attr.value.slice(0, 30) + '...' : attr.value
        dataAttrs.push(`${attr.name}="${val}"`)
        if (dataAttrs.length >= 3) break
      }
    }
    if (dataAttrs.length > 0) {
      label += ` {${dataAttrs.join(' ')}}`
    }

    label += ` (×${count})`

    const validChildren = Array.from(el.children).filter(c => !shouldExclude(c))
    if (validChildren.length > 0 && depth >= MAX_DEPTH) {
      label += ` (${validChildren.length} children)`
    }

    if (el.children.length === 0) {
      const text = el.textContent?.trim()
      if (text && text.length > 0 && text.length < 50) {
        label += ` "${text}"`
      }
    }

    lines.push(prefix + connector + label)

    // Recurse into children with same compression logic
    if (depth < MAX_DEPTH && validChildren.length > 0) {
      // Group children by signature across all parent elements
      const childrenByPosition: Element[][] = []
      for (let childIdx = 0; childIdx < validChildren.length; childIdx++) {
        childrenByPosition[childIdx] = []
        for (const parentEl of allElements) {
          const parentChildren = Array.from(parentEl.children).filter(c => !shouldExclude(c))
          if (parentChildren[childIdx]) {
            childrenByPosition[childIdx].push(parentChildren[childIdx])
          }
        }
      }

      for (let childIdx = 0; childIdx < validChildren.length; childIdx++) {
        const childGroup = childrenByPosition[childIdx]
        if (childGroup.length === 0) continue

        const isChildLast = childIdx === validChildren.length - 1
        const childSig = getElementSignature(childGroup[0])

        // Check if all children at this position have same signature
        const allSame = childGroup.every(c => getElementSignature(c) === childSig)

        if (allSame && childGroup.length > 1) {
          // Use formatNodeWithVariations for this child position
          const childLines = formatNodeWithVariations(
            childGroup[0],
            childGroup,
            prefix + childPrefix,
            isChildLast,
            depth + 1,
            childGroup.length
          )
          lines.push(...childLines)
        } else {
          // Format normally
          lines.push(...formatNode(validChildren[childIdx], prefix + childPrefix, isChildLast, depth + 1))
        }
      }
    }

    return lines
  }

  function formatNode(el: Element, prefix: string, isLast: boolean, depth: number): string[] {
    if (shouldExclude(el) || depth > MAX_DEPTH) return []

    const lines: string[] = []
    const connector = isLast ? '└── ' : '├── '
    const childPrefix = isLast ? '    ' : '│   '

    let label = el.tagName.toLowerCase()

    if (el.id) {
      label += `#${el.id}`
    }

    const classes = Array.from(el.classList)
      .filter(c => !c.startsWith('__') && !c.includes('plasmo'))
      .slice(0, MAX_CLASSES)
    if (classes.length > 0) {
      label += '.' + classes.join('.')
    }

    const role = el.getAttribute('role')
    if (role) {
      label += ` [role="${role}"]`
    }

    const ariaLabel = el.getAttribute('aria-label')
    if (ariaLabel) {
      const short = ariaLabel.length > 30 ? ariaLabel.slice(0, 30) + '...' : ariaLabel
      label += ` [aria-label="${short}"]`
    }

    const dataAttrs: string[] = []
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('data-') && !attr.name.includes('plasmo')) {
        const val = attr.value.length > 30 ? attr.value.slice(0, 30) + '...' : attr.value
        dataAttrs.push(`${attr.name}="${val}"`)
        if (dataAttrs.length >= 3) break
      }
    }
    if (dataAttrs.length > 0) {
      label += ` {${dataAttrs.join(' ')}}`
    }

    const validChildren = Array.from(el.children).filter(c => !shouldExclude(c))
    if (validChildren.length > 0 && depth >= MAX_DEPTH) {
      label += ` (${validChildren.length} children)`
    }

    if (el.children.length === 0) {
      const text = el.textContent?.trim()
      if (text && text.length > 0 && text.length < 50) {
        label += ` "${text}"`
      }
    }

    lines.push(prefix + connector + label)

    if (depth < MAX_DEPTH) {
      // Group consecutive children with same signature
      let i = 0
      while (i < validChildren.length) {
        const child = validChildren[i]
        const childSig = getElementSignature(child)

        // Count consecutive elements with same signature
        let count = 1
        while (i + count < validChildren.length &&
               getElementSignature(validChildren[i + count]) === childSig) {
          count++
        }

        if (count > 1) {
          // Show compressed format with ONE representative structure
          const isChildLast = i + count >= validChildren.length

          // Generate the structure for the first element but mark it as repeated
          const childLines = formatNodeWithVariations(
            child,
            validChildren.slice(i, i + count),
            prefix + childPrefix,
            isChildLast,
            depth + 1,
            count
          )

          lines.push(...childLines)
          i += count
        } else {
          // Show normally (single element)
          const isChildLast = i === validChildren.length - 1
          lines.push(...formatNode(child, prefix + childPrefix, isChildLast, depth + 1))
          i++
        }
      }
    }

    return lines
  }

  const lines: string[] = ['body']
  const bodyChildren = Array.from(document.body.children).filter(c => !shouldExclude(c))
  for (let i = 0; i < bodyChildren.length; i++) {
    const child = bodyChildren[i]
    const isLast = i === bodyChildren.length - 1
    lines.push(...formatNode(child, '', isLast, 1))
  }

  return lines.join('\n')
}

export async function capturePageHTML(): Promise<PageCaptureResult> {
  console.log('[HTML Capture] Function called')

  try {
    console.log('[HTML Capture] Starting capture...')

    if (!chrome?.tabs || !chrome?.scripting) {
      console.error('[HTML Capture] chrome.tabs or chrome.scripting API not available!')
      throw new Error('chrome.tabs or chrome.scripting API not available')
    }

    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    console.log('[HTML Capture] Active tab:', activeTab?.id, 'URL:', activeTab?.url)

    if (!activeTab?.id) {
      console.error('[HTML Capture] No active tab found!')
      throw new Error('No active tab found')
    }

    if (!activeTab.url ||
        activeTab.url.startsWith('chrome-extension://') ||
        activeTab.url.startsWith('chrome://') ||
        activeTab.url.startsWith('about:')) {
      console.error('[HTML Capture] Active tab is not a webpage:', activeTab.url)
      throw new Error('Please open the extension on a webpage, not an extension page')
    }

    const pageUrl = activeTab.url
    console.log('[HTML Capture] Page URL:', pageUrl)
    console.log('[HTML Capture] Injecting script to capture HTML and DOM structure...')

    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: generateDOMStructureInPage
    })

    const htmlResults = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => document.documentElement.outerHTML
    })

    console.log('[HTML Capture] Script executed, results:', results?.length)

    if (!htmlResults || htmlResults.length === 0 || !htmlResults[0]?.result) {
      console.error('[HTML Capture] No HTML results returned from script')
      throw new Error('Failed to capture HTML: No results returned')
    }

    const html = htmlResults[0].result
    const domStructure = results?.[0]?.result || 'body\n└── (structure unavailable)'

    debugLog('📸 Captured HTML from page, length:', html?.length, 'URL:', pageUrl)
    console.log('[HTML Capture] Success! HTML length:', html?.length, 'Structure lines:', domStructure.split('\n').length)
    return { html, url: pageUrl, domStructure }
  } catch (error) {
    console.error('[HTML Capture] Error:', error)
    debugError('❌ Failed to capture page HTML:', error)
    throw error
  }
}
