import { describe, it, expect } from '@jest/globals'

const mockDuplicateResponse = `I'll help you transform the page to match the design in the image. Let me first read the current session context and then analyze what changes are needed.Now let me analyze the mockup and create the DOM changes to transform the page:

{"domChanges":[{"selector":"body","type":"styleRules","states":{"normal":{"background":"linear-gradient(135deg, #FFA726 0%, #FFB74D 50%, #FFCC80 100%)","min-height":"100vh"}},"important":true,"enabled":true}],"response":"I've analyzed the mockup and created a design transformation for the ABsmartly homepage.","action":"append"}Now let me analyze the mockup and create the DOM changes to transform the page:

{"domChanges":[{"selector":"body","type":"styleRules","states":{"normal":{"background":"linear-gradient(135deg, #FFA726 0%, #FFB74D 50%, #FFCC80 100%)","min-height":"100vh"}},"important":true,"enabled":true}],"response":"I've analyzed the mockup and created a design transformation for the ABsmartly homepage.","action":"append"}`

describe('AI Response Parsing', () => {
  it('should extract the LAST JSON object when multiple are present', () => {
    const allMatches: Array<{ json: string; start: number; end: number }> = []

    // Find all potential JSON objects by matching balanced braces
    let pos = 0
    while (pos < mockDuplicateResponse.length) {
      const startPos = mockDuplicateResponse.indexOf('{', pos)
      if (startPos === -1) break

      // Find matching closing brace
      let depth = 1
      let endPos = startPos + 1
      while (endPos < mockDuplicateResponse.length && depth > 0) {
        if (mockDuplicateResponse[endPos] === '{') depth++
        if (mockDuplicateResponse[endPos] === '}') depth--
        endPos++
      }

      if (depth === 0) {
        const potentialJson = mockDuplicateResponse.substring(startPos, endPos)
        if (potentialJson.includes('"domChanges"') &&
            potentialJson.includes('"response"') &&
            potentialJson.includes('"action"')) {
          allMatches.push({
            json: potentialJson,
            start: startPos,
            end: endPos
          })
        }
      }

      pos = endPos > startPos ? endPos : startPos + 1
    }

    expect(allMatches.length).toBeGreaterThanOrEqual(1)

    const lastMatch = allMatches[allMatches.length - 1]
    const parsed = JSON.parse(lastMatch.json)

    expect(parsed.domChanges).toBeDefined()
    expect(Array.isArray(parsed.domChanges)).toBe(true)
    expect(parsed.response).toBeDefined()
    expect(parsed.action).toBe('append')
  })

  it('should extract text before the last JSON', () => {
    const allMatches: Array<{ json: string; start: number; end: number }> = []

    // Find all potential JSON objects by matching balanced braces
    let pos = 0
    while (pos < mockDuplicateResponse.length) {
      const startPos = mockDuplicateResponse.indexOf('{', pos)
      if (startPos === -1) break

      // Find matching closing brace
      let depth = 1
      let endPos = startPos + 1
      while (endPos < mockDuplicateResponse.length && depth > 0) {
        if (mockDuplicateResponse[endPos] === '{') depth++
        if (mockDuplicateResponse[endPos] === '}') depth--
        endPos++
      }

      if (depth === 0) {
        const potentialJson = mockDuplicateResponse.substring(startPos, endPos)
        if (potentialJson.includes('"domChanges"') &&
            potentialJson.includes('"response"') &&
            potentialJson.includes('"action"')) {
          allMatches.push({
            json: potentialJson,
            start: startPos,
            end: endPos
          })
        }
      }

      pos = endPos > startPos ? endPos : startPos + 1
    }

    expect(allMatches.length).toBeGreaterThanOrEqual(1)

    const lastMatch = allMatches[allMatches.length - 1]
    const textBefore = mockDuplicateResponse.substring(0, lastMatch.start).trim()

    expect(textBefore).toContain("I'll help you transform the page")
  })

  it('should handle single JSON response correctly', () => {
    const singleResponse = `{"domChanges":[],"response":"Test response","action":"none"}`

    const jsonRegex = /\{[\s\S]*?\}/g
    const allMatches: Array<{ json: string; start: number; end: number }> = []

    let match: RegExpExecArray | null
    while ((match = jsonRegex.exec(singleResponse)) !== null) {
      const potentialJson = match[0]
      if (potentialJson.includes('"domChanges"') &&
          potentialJson.includes('"response"') &&
          potentialJson.includes('"action"')) {
        allMatches.push({
          json: potentialJson,
          start: match.index,
          end: match.index + potentialJson.length
        })
      }
    }

    expect(allMatches.length).toBe(1)

    const parsed = JSON.parse(allMatches[0].json)
    expect(parsed.response).toBe('Test response')
    expect(parsed.action).toBe('none')
  })

  it('should handle JSON with text before and after', () => {
    const response = `Some text before {"domChanges":[],"response":"Middle","action":"none"} Some text after`

    const jsonRegex = /\{[\s\S]*?\}/g
    const allMatches: Array<{ json: string; start: number; end: number }> = []

    let match: RegExpExecArray | null
    while ((match = jsonRegex.exec(response)) !== null) {
      const potentialJson = match[0]
      if (potentialJson.includes('"domChanges"') &&
          potentialJson.includes('"response"') &&
          potentialJson.includes('"action"')) {
        allMatches.push({
          json: potentialJson,
          start: match.index,
          end: match.index + potentialJson.length
        })
      }
    }

    expect(allMatches.length).toBe(1)

    const singleMatch = allMatches[0]
    const textBefore = response.substring(0, singleMatch.start).trim()
    const textAfter = response.substring(singleMatch.end).trim()

    expect(textBefore).toBe('Some text before')
    expect(textAfter).toBe('Some text after')
  })
})
