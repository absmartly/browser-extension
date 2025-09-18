/**
 * Simple bundler for visual editor injection script
 * This creates a self-contained script that can be injected via chrome.scripting.executeScript
 */

const fs = require('fs')
const path = require('path')

const sourceDir = path.join(__dirname, '../src/injected')
const buildDir = path.join(sourceDir, 'build')
const outputFile = path.join(buildDir, 'visual-editor-bundle.js')

// Ensure build directory exists
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true })
}

// Read the existing selector generator
const selectorGeneratorPath = path.join(__dirname, '../src/utils/selector-generator.ts')
const selectorGenerator = fs.readFileSync(selectorGeneratorPath, 'utf8')

// For now, create a simplified bundle with placeholder for full implementation
const bundledCode = `
// ABsmartly Visual Editor Bundle
// Generated from modular source code

// Selector Generator (simplified for injection)
${extractSelectorGeneratorCode(selectorGenerator)}

// Visual Editor Modules (placeholder - to be implemented with proper bundling)
// For now, fallback to a basic implementation

function initVisualEditor(variantName, experimentName, logoUrl, initialChanges) {
  console.log('[ABSmartly] Visual Editor Bundle - Basic Implementation')
  console.log('Variant:', variantName, 'Experiment:', experimentName)

  // Check if already active
  if (window.__absmartlyVisualEditorActive) {
    console.log('[ABSmartly] Visual editor already active')
    return { already: true }
  }

  window.__absmartlyVisualEditorActive = true

  // Hide preview header
  const previewHeader = document.getElementById('absmartly-preview-header')
  if (previewHeader) {
    previewHeader.style.display = 'none'
  }

  // Create basic visual editor banner
  createBasicBanner(experimentName, variantName)

  // Add basic styles
  addBasicStyles()

  // Add basic event listeners for element selection
  addBasicEventListeners()

  console.log('[ABSmartly] Basic visual editor active - Full modular version coming soon!')
  return { success: true }
}

function createBasicBanner(experimentName, variantName) {
  const banner = document.createElement('div')
  banner.id = 'absmartly-visual-editor-banner'
  banner.style.cssText = \`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(90deg, #3b82f6, #10b981);
    color: white;
    padding: 10px 20px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    z-index: 2147483647;
    text-align: center;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  \`
  banner.innerHTML = \`
    Visual Editor - \${experimentName} • Variant: \${variantName}
    <span style="float: right; cursor: pointer;" onclick="this.parentElement.remove(); window.__absmartlyVisualEditorActive = false;">✕</span>
  \`
  document.body.appendChild(banner)
}

function addBasicStyles() {
  const style = document.createElement('style')
  style.dataset.absmartly = 'true'
  style.textContent = \`
    .absmartly-hover {
      outline: 2px solid #3b82f6 !important;
      outline-offset: 2px !important;
    }
    .absmartly-selected {
      outline: 3px solid #10b981 !important;
      outline-offset: 2px !important;
    }
  \`
  document.head.appendChild(style)
}

function addBasicEventListeners() {
  let selectedElement = null

  const handleMouseOver = (e) => {
    const target = e.target
    if (target.id !== 'absmartly-visual-editor-banner' &&
        !target.closest('#absmartly-visual-editor-banner')) {
      target.classList.add('absmartly-hover')
    }
  }

  const handleMouseOut = (e) => {
    e.target.classList.remove('absmartly-hover')
  }

  const handleClick = (e) => {
    const target = e.target
    if (target.id === 'absmartly-visual-editor-banner' ||
        target.closest('#absmartly-visual-editor-banner')) {
      return
    }

    e.preventDefault()
    e.stopPropagation()

    if (selectedElement) {
      selectedElement.classList.remove('absmartly-selected')
    }

    selectedElement = target
    target.classList.remove('absmartly-hover')
    target.classList.add('absmartly-selected')

    console.log('[ABSmartly] Selected element:', target)
    console.log('[ABSmartly] Selector:', generateRobustSelector(target))
  }

  document.addEventListener('mouseover', handleMouseOver, true)
  document.addEventListener('mouseout', handleMouseOut, true)
  document.addEventListener('click', handleClick, true)
}

// Make globally available
window.initVisualEditor = initVisualEditor;
`

// Write the bundle
fs.writeFileSync(outputFile, bundledCode)
console.log(`Visual editor bundle created: ${outputFile}`)

function extractSelectorGeneratorCode(code) {
  // Extract the essential parts of the selector generator for injection
  // This is a simplified approach - a full bundler would properly handle imports/exports
  return `
// Simplified selector generator for injection
${code.replace(/export\s+/g, '').replace(/import.*?;/g, '')}
  `
}