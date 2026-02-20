#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Read both prompt files
const basePromptPath = path.join(__dirname, '../src/prompts/ai-dom-generation-system-prompt.ts')
const chunkPromptPath = path.join(__dirname, '../src/lib/ai-providers/chunk-retrieval-prompts.ts')

const baseContent = fs.readFileSync(basePromptPath, 'utf8')
const chunkContent = fs.readFileSync(chunkPromptPath, 'utf8')

const baseMatch = baseContent.match(/export const AI_DOM_GENERATION_SYSTEM_PROMPT = `([\s\S]*?)`\s*$/m)
const chunkMatch = chunkContent.match(/export const API_CHUNK_RETRIEVAL_PROMPT = `([\s\S]*?)`\s*(?:export|$)/m)

if (!baseMatch || !chunkMatch) {
  console.error('Could not find prompts')
  process.exit(1)
}

const fullPrompt = baseMatch[1].replace('{{CHUNK_RETRIEVAL_DOCUMENTATION}}', chunkMatch[1])

console.log('Full system prompt length:', fullPrompt.length)
console.log('================================================================')

// Strip emojis - SAME FUNCTION AS openrouter.ts
function stripEmojis(text) {
  return text
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/[\uD800-\uDFFF]/g, '')
    .replace(/[\uFE00-\uFE0F]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[━─│┌┐└┘├┤┬┴┼]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .trim()
}

const stripped = stripEmojis(fullPrompt)

console.log('Stripped prompt length:', stripped.length)
console.log('================================================================')

// Check for surrogates
const surrogateRegex = /[\uD800-\uDFFF]/g
const surrogates = []
let match

while ((match = surrogateRegex.exec(stripped)) !== null) {
  surrogates.push({
    position: match.index,
    charCode: stripped.charCodeAt(match.index),
    context: stripped.substring(Math.max(0, match.index - 30), match.index + 30)
  })
}

if (surrogates.length > 0) {
  console.error('FOUND', surrogates.length, 'SURROGATE(S) AFTER STRIPPING:')
  console.error('================================================================')
  surrogates.slice(0, 10).forEach((s, i) => {
    console.error(`${i + 1}. Position ${s.position}: 0x${s.charCode.toString(16)} (${s.charCode})`)
    console.error('   Context:', JSON.stringify(s.context))
  })
  console.error('================================================================')
  process.exit(1)
} else {
  console.log('✅ SUCCESS: No surrogates found!')
  console.log('Characters removed:', fullPrompt.length - stripped.length)
  console.log('================================================================')
  process.exit(0)
}
