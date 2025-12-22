import {
  generateDOMStructure,
  formatDOMStructureAsText,
  getHTMLChunk,
  type DOMStructure
} from '../dom-structure'

describe('DOM Structure Generator', () => {
  describe('generateDOMStructure', () => {
    it('should generate structure from simple HTML', () => {
      const html = `
        <html>
          <body>
            <header id="main-header">Header</header>
            <main id="content">
              <section class="hero">Hero Section</section>
              <section class="features">Features</section>
            </main>
            <footer>Footer</footer>
          </body>
        </html>
      `

      const structure = generateDOMStructure(html)

      expect(structure.root.tag).toBe('body')
      expect(structure.totalElements).toBeGreaterThan(0)
      expect(structure.maxDepth).toBeGreaterThan(0)
    })

    it('should generate correct selectors for elements with IDs', () => {
      const html = `
        <html>
          <body>
            <div id="unique-id">Content</div>
          </body>
        </html>
      `

      const structure = generateDOMStructure(html)
      const divNode = structure.root.children?.find(c => c.id === 'unique-id')

      expect(divNode).toBeDefined()
      expect(divNode?.selector).toBe('#unique-id')
    })

    it('should generate class-based selectors for elements without IDs', () => {
      const html = `
        <html>
          <body>
            <div class="hero-section main">Content</div>
          </body>
        </html>
      `

      const structure = generateDOMStructure(html)
      const divNode = structure.root.children?.find(c => c.classes?.includes('hero-section'))

      expect(divNode).toBeDefined()
      expect(divNode?.selector).toContain('div.hero-section')
    })

    it('should respect maxDepth option', () => {
      const html = `
        <html>
          <body>
            <div>
              <div>
                <div>
                  <div>
                    <div>Deep</div>
                  </div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `

      const structure = generateDOMStructure(html, { maxDepth: 2 })

      expect(structure.maxDepth).toBeLessThanOrEqual(2)
    })

    it('should include text preview for leaf nodes', () => {
      const html = `
        <html>
          <body>
            <p>This is some text content</p>
          </body>
        </html>
      `

      const structure = generateDOMStructure(html, { includeTextPreview: true })
      const pNode = structure.root.children?.find(c => c.tag === 'p')

      expect(pNode?.textPreview).toBe('This is some text content')
    })

    it('should truncate long text previews', () => {
      const longText = 'A'.repeat(100)
      const html = `
        <html>
          <body>
            <p>${longText}</p>
          </body>
        </html>
      `

      const structure = generateDOMStructure(html, { includeTextPreview: true })
      const pNode = structure.root.children?.find(c => c.tag === 'p')

      expect(pNode?.textPreview).toContain('...')
      expect(pNode?.textPreview?.length).toBeLessThanOrEqual(53)
    })

    it('should exclude Plasmo elements by default', () => {
      const html = `
        <html>
          <body>
            <div id="content">Real content</div>
            <div id="__plasmo">Plasmo extension</div>
            <div id="__plasmo-loading__">Loading</div>
          </body>
        </html>
      `

      const structure = generateDOMStructure(html)
      const plasmoNode = structure.root.children?.find(c => c.id === '__plasmo')
      const plasmoLoadingNode = structure.root.children?.find(c => c.id === '__plasmo-loading__')
      const contentNode = structure.root.children?.find(c => c.id === 'content')

      expect(plasmoNode).toBeUndefined()
      expect(plasmoLoadingNode).toBeUndefined()
      expect(contentNode).toBeDefined()
    })

    it('should exclude script and style elements', () => {
      const html = `
        <html>
          <body>
            <div id="content">Content</div>
            <script>console.log('test')</script>
            <style>.test { color: red; }</style>
          </body>
        </html>
      `

      const structure = generateDOMStructure(html)
      const scriptNode = structure.root.children?.find(c => c.tag === 'script')
      const styleNode = structure.root.children?.find(c => c.tag === 'style')

      expect(scriptNode).toBeUndefined()
      expect(styleNode).toBeUndefined()
    })

    it('should track childCount for nodes beyond maxDepth', () => {
      const html = `
        <html>
          <body>
            <div>
              <span>1</span>
              <span>2</span>
              <span>3</span>
            </div>
          </body>
        </html>
      `

      const structure = generateDOMStructure(html, { maxDepth: 1 })
      const divNode = structure.root.children?.find(c => c.tag === 'div')

      expect(divNode?.childCount).toBe(3)
      expect(divNode?.children).toBeUndefined()
    })
  })

  describe('formatDOMStructureAsText', () => {
    it('should format structure as tree text', () => {
      const structure: DOMStructure = {
        root: {
          tag: 'body',
          selector: 'body',
          childCount: 2,
          children: [
            {
              tag: 'header',
              id: 'main-header',
              selector: '#main-header',
              childCount: 0
            },
            {
              tag: 'main',
              id: 'content',
              selector: '#content',
              childCount: 2,
              children: [
                {
                  tag: 'section',
                  classes: ['hero'],
                  selector: 'section.hero',
                  childCount: 0
                },
                {
                  tag: 'section',
                  classes: ['features'],
                  selector: 'section.features',
                  childCount: 0
                }
              ]
            }
          ]
        },
        totalElements: 5,
        maxDepth: 2
      }

      const text = formatDOMStructureAsText(structure)

      expect(text).toContain('body')
      expect(text).toContain('header#main-header')
      expect(text).toContain('main#content')
      expect(text).toContain('section.hero')
      expect(text).toContain('section.features')
      expect(text).toContain('├──')
      expect(text).toContain('└──')
    })

    it('should show child count for unexpanded nodes', () => {
      const structure: DOMStructure = {
        root: {
          tag: 'body',
          selector: 'body',
          childCount: 1,
          children: [
            {
              tag: 'div',
              selector: 'div',
              childCount: 5
            }
          ]
        },
        totalElements: 6,
        maxDepth: 1
      }

      const text = formatDOMStructureAsText(structure)

      expect(text).toContain('(5 children)')
    })

    it('should include text preview in output', () => {
      const structure: DOMStructure = {
        root: {
          tag: 'body',
          selector: 'body',
          childCount: 1,
          children: [
            {
              tag: 'p',
              selector: 'p',
              childCount: 0,
              textPreview: 'Hello world'
            }
          ]
        },
        totalElements: 2,
        maxDepth: 1
      }

      const text = formatDOMStructureAsText(structure)

      expect(text).toContain('"Hello world"')
    })
  })

  describe('getHTMLChunk', () => {
    const testHTML = `
      <html>
        <body>
          <header id="main-header">
            <nav class="navbar">
              <a href="/">Home</a>
              <a href="/about">About</a>
            </nav>
          </header>
          <main id="content">
            <section class="hero">
              <h1>Welcome</h1>
              <p>Hero description</p>
            </section>
            <section class="features">
              <div class="feature">Feature 1</div>
              <div class="feature">Feature 2</div>
            </section>
          </main>
          <footer id="footer">Footer content</footer>
        </body>
      </html>
    `

    it('should extract element by ID selector', () => {
      const result = getHTMLChunk(testHTML, '#main-header')

      expect(result.found).toBe(true)
      expect(result.html).toContain('<header id="main-header">')
      expect(result.html).toContain('<nav class="navbar">')
    })

    it('should extract element by class selector', () => {
      const result = getHTMLChunk(testHTML, '.hero')

      expect(result.found).toBe(true)
      expect(result.html).toContain('<section class="hero">')
      expect(result.html).toContain('<h1>Welcome</h1>')
    })

    it('should extract element by tag selector', () => {
      const result = getHTMLChunk(testHTML, 'footer')

      expect(result.found).toBe(true)
      expect(result.html).toContain('<footer id="footer">')
      expect(result.html).toContain('Footer content')
    })

    it('should extract element by complex selector', () => {
      const result = getHTMLChunk(testHTML, '#content .features .feature')

      expect(result.found).toBe(true)
      expect(result.html).toContain('Feature 1')
    })

    it('should return error for non-existent selector', () => {
      const result = getHTMLChunk(testHTML, '#non-existent')

      expect(result.found).toBe(false)
      expect(result.error).toContain('Element not found')
    })

    it('should handle invalid selector syntax', () => {
      const result = getHTMLChunk(testHTML, '[invalid[[')

      expect(result.found).toBe(false)
      expect(result.error).toBeDefined()
    })
  })
})
