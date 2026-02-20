// Manual test script for DOM structure generation
// Run this in the browser console to verify the generateDOMStructureInPage function works correctly
// Usage: Copy this entire script and paste into browser console on any webpage

function testDOMStructureGeneration() {
  console.log('🧪 Testing DOM Structure Generation...\n')

  // This is the exact function from html-capture.ts
  function generateDOMStructureInPage() {
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

    function shouldExclude(el) {
      for (const sel of EXCLUDE_SELECTORS) {
        try {
          if (el.matches(sel)) return true
        } catch {
          /* ignore */
        }
      }
      return false
    }

    function getElementSignature(el) {
      let sig = el.tagName.toLowerCase()
      if (el.id) sig += `#${el.id}`
      const classes = Array.from(el.classList)
        .filter(c => !c.startsWith('__') && !c.includes('plasmo'))
        .slice(0, MAX_CLASSES)
      if (classes.length > 0) sig += '.' + classes.join('.')
      return sig
    }

    function formatNode(el, prefix, isLast, depth) {
      if (shouldExclude(el) || depth > MAX_DEPTH) return []

      const lines = []
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

      const dataAttrs = []
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
            // Show compressed format for duplicates
            const childLines = formatNode(child, prefix + childPrefix, false, depth + 1)

            // Modify the first line to add count
            if (childLines.length > 0) {
              const firstLine = childLines[0]
              const indentMatch = firstLine.match(/^(\s*[├└]── )(.+)$/)
              if (indentMatch) {
                childLines[0] = indentMatch[1] + indentMatch[2] + ` (×${count})`
              }
            }

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

    const lines = ['body']
    const bodyChildren = Array.from(document.body.children).filter(c => !shouldExclude(c))
    for (let i = 0; i < bodyChildren.length; i++) {
      const child = bodyChildren[i]
      const isLast = i === bodyChildren.length - 1
      lines.push(...formatNode(child, '', isLast, 1))
    }

    return lines.join('\n')
  }

  // Run the test
  try {
    const result = generateDOMStructureInPage()
    console.log('✅ DOM Structure Generation Successful!\n')
    console.log('📊 Structure Lines:', result.split('\n').length)
    console.log('\n📝 Generated Structure:\n')
    console.log(result)
    console.log('\n✅ Test completed successfully!')

    // Check for key features
    const hasClasses = result.includes('.')
    const hasIds = result.includes('#')
    const hasTreeStructure = result.includes('├──') || result.includes('└──')

    console.log('\n🔍 Feature Check:')
    console.log('  Classes:', hasClasses ? '✅' : '❌')
    console.log('  IDs:', hasIds ? '✅' : '❌')
    console.log('  Tree Structure:', hasTreeStructure ? '✅' : '❌')

    return result
  } catch (error) {
    console.error('❌ Test failed:', error)
    return null
  }
}

// Run the test
testDOMStructureGeneration()
