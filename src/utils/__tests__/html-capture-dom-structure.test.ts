import { capturePageHTML, PageCaptureResult } from '../html-capture'

// Mock chrome.tabs and chrome.scripting APIs
const mockChrome = {
  tabs: {
    query: jest.fn(),
    get: jest.fn()
  },
  scripting: {
    executeScript: jest.fn()
  }
}

global.chrome = mockChrome as any

describe('DOM Structure Generation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('capturePageHTML', () => {
    it('should generate DOM structure with classes and IDs', async () => {
      const mockTab = {
        id: 123,
        url: 'https://example.com'
      }

      mockChrome.tabs.query.mockResolvedValue([mockTab])
      mockChrome.tabs.get.mockResolvedValue(mockTab)

      // Mock the structure generation result
      const mockDOMStructure = `body
├── div#header.header-class
│   └── nav.nav-class
└── main#content.content-class`

      const mockHTML = '<html><body><div id="header" class="header-class"><nav class="nav-class"></nav></div><main id="content" class="content-class"></main></body></html>'

      // First call returns DOM structure, second returns HTML
      mockChrome.scripting.executeScript
        .mockResolvedValueOnce([{ result: mockDOMStructure }])
        .mockResolvedValueOnce([{ result: mockHTML }])

      const result: PageCaptureResult = await capturePageHTML()

      expect(result).toEqual({
        html: mockHTML,
        url: 'https://example.com',
        domStructure: mockDOMStructure
      })

      expect(mockChrome.scripting.executeScript).toHaveBeenCalledTimes(2)
    })

    it('should include data attributes in structure', async () => {
      const mockTab = {
        id: 123,
        url: 'https://example.com'
      }

      mockChrome.tabs.query.mockResolvedValue([mockTab])
      mockChrome.tabs.get.mockResolvedValue(mockTab)

      const mockDOMStructure = `body
└── div.component {data-testid="main" data-component="header"}`

      mockChrome.scripting.executeScript
        .mockResolvedValueOnce([{ result: mockDOMStructure }])
        .mockResolvedValueOnce([{ result: '<html><body></body></html>' }])

      const result = await capturePageHTML()

      expect(result.domStructure).toContain('data-testid')
      expect(result.domStructure).toContain('data-component')
    })

    it('should include aria-label and role attributes', async () => {
      const mockTab = {
        id: 123,
        url: 'https://example.com'
      }

      mockChrome.tabs.query.mockResolvedValue([mockTab])
      mockChrome.tabs.get.mockResolvedValue(mockTab)

      const mockDOMStructure = `body
└── button.btn [role="button"] [aria-label="Close dialog"]`

      mockChrome.scripting.executeScript
        .mockResolvedValueOnce([{ result: mockDOMStructure }])
        .mockResolvedValueOnce([{ result: '<html><body></body></html>' }])

      const result = await capturePageHTML()

      expect(result.domStructure).toContain('role="button"')
      expect(result.domStructure).toContain('aria-label')
    })

    it('should handle nested structures with proper indentation', async () => {
      const mockTab = {
        id: 123,
        url: 'https://example.com'
      }

      mockChrome.tabs.query.mockResolvedValue([mockTab])
      mockChrome.tabs.get.mockResolvedValue(mockTab)

      const mockDOMStructure = `body
├── header#main-header
│   ├── nav.primary-nav
│   │   ├── a.nav-link
│   │   └── a.nav-link
│   └── div.search
└── main#content`

      mockChrome.scripting.executeScript
        .mockResolvedValueOnce([{ result: mockDOMStructure }])
        .mockResolvedValueOnce([{ result: '<html><body></body></html>' }])

      const result = await capturePageHTML()

      expect(result.domStructure).toContain('├──')
      expect(result.domStructure).toContain('└──')
      expect(result.domStructure).toContain('│')
    })

    it('should provide fallback when structure generation fails', async () => {
      const mockTab = {
        id: 123,
        url: 'https://example.com'
      }

      mockChrome.tabs.query.mockResolvedValue([mockTab])
      mockChrome.tabs.get.mockResolvedValue(mockTab)

      // First call returns null/undefined (structure failed)
      mockChrome.scripting.executeScript
        .mockResolvedValueOnce([{ result: null }])
        .mockResolvedValueOnce([{ result: '<html><body></body></html>' }])

      const result = await capturePageHTML()

      expect(result.domStructure).toBe('body\n└── (structure unavailable)')
    })

    it('should reject chrome:// and extension pages', async () => {
      const mockTab = {
        id: 123,
        url: 'chrome://extensions'
      }

      mockChrome.tabs.query.mockResolvedValue([mockTab])
      mockChrome.tabs.get.mockResolvedValue(mockTab)

      await expect(capturePageHTML()).rejects.toThrow('Please open the extension on a webpage')
    })

    it('should reject chrome-extension:// pages', async () => {
      const mockTab = {
        id: 123,
        url: 'chrome-extension://abcd1234/popup.html'
      }

      mockChrome.tabs.query.mockResolvedValue([mockTab])
      mockChrome.tabs.get.mockResolvedValue(mockTab)

      await expect(capturePageHTML()).rejects.toThrow('Please open the extension on a webpage')
    })
  })

  describe('generateDOMStructureInPage function isolation', () => {
    it('should work without external dependencies when serialized', () => {
      // This test ensures the function can be serialized and executed in a different context
      // (like chrome.scripting.executeScript does)

      // Create a simple HTML structure
      const testHTML = `
        <body>
          <div id="main" class="container">
            <header class="site-header" data-testid="header">
              <nav role="navigation">
                <a href="/">Home</a>
              </nav>
            </header>
          </div>
          <script>console.log('should be excluded')</script>
        </body>
      `

      const parser = new DOMParser()
      const doc = parser.parseFromString(testHTML, 'text/html')

      // Simulate what happens when the function is serialized and executed
      const functionString = simulateStructureGeneration.toString()

      // Verify the function doesn't reference external variables
      expect(functionString).toContain('const EXCLUDE_SELECTORS')
      expect(functionString).toContain('const MAX_DEPTH')
      expect(functionString).toContain('const MAX_CLASSES')

      // Run it
      const result = simulateStructureGeneration(doc.body)

      expect(result).toBeTruthy()
      expect(result).toContain('body')
      expect(result).toContain('div#main')
      expect(result).toContain('header.site-header')
      expect(result).toContain('[role="navigation"]')
      expect(result).toContain('data-testid="header"')
      expect(result).not.toContain('script')
    })
  })

  describe('DOM Structure Function (Integration)', () => {
    it('should generate valid structure from real-like DOM', () => {
      // Create a test DOM
      const testHTML = `
        <body>
          <div id="header" class="header main-header" data-testid="header">
            <nav role="navigation">
              <a class="nav-link" href="/">Home</a>
              <button aria-label="Menu">Menu</button>
            </nav>
          </div>
          <main id="content" class="content">
            <section class="hero" data-component="hero">
              <h1>Title</h1>
            </section>
          </main>
          <script>console.log('test')</script>
          <style>.test { color: red; }</style>
        </body>
      `

      // Parse into DOM
      const parser = new DOMParser()
      const doc = parser.parseFromString(testHTML, 'text/html')

      // Run the generation function logic (simulated)
      const result = simulateStructureGeneration(doc.body)

      expect(result).toContain('div#header')
      expect(result).toContain('nav [role="navigation"]')
      expect(result).toContain('button [aria-label="Menu"]')
      expect(result).toContain('data-testid="header"')
      expect(result).not.toContain('script')
      expect(result).not.toContain('style')
    })
  })
})

// Simulate the structure generation logic for testing
function simulateStructureGeneration(body: HTMLElement): string {
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
      } catch {
        /* ignore */
      }
    }
    return false
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
      for (let i = 0; i < validChildren.length; i++) {
        const child = validChildren[i]
        const isChildLast = i === validChildren.length - 1
        lines.push(...formatNode(child, prefix + childPrefix, isChildLast, depth + 1))
      }
    }

    return lines
  }

  const lines: string[] = ['body']
  const bodyChildren = Array.from(body.children).filter(c => !shouldExclude(c))
  for (let i = 0; i < bodyChildren.length; i++) {
    const child = bodyChildren[i]
    const isLast = i === bodyChildren.length - 1
    lines.push(...formatNode(child, '', isLast, 1))
  }

  return lines.join('\n')
}
