import { useState } from 'react'
import { Button } from './ui/Button'
import type { DOMChangeInstruction } from '~src/types/dom'

interface NaturalLanguageInputProps {
  onGenerate: (changes: DOMChangeInstruction[]) => void
  disabled?: boolean
}

export function NaturalLanguageInput({ onGenerate, disabled }: NaturalLanguageInputProps) {
  const [input, setInput] = useState('')
  const [processing, setProcessing] = useState(false)

  const parseNaturalLanguage = (text: string): DOMChangeInstruction[] => {
    const changes: DOMChangeInstruction[] = []
    const lowerText = text.toLowerCase()

    // Button styling patterns
    if (lowerText.includes('button') && lowerText.includes('rounded')) {
      changes.push({
        selector: 'button',
        action: 'style',
        property: 'borderRadius',
        value: '8px'
      })
    }

    if (lowerText.includes('button') && lowerText.includes('blue')) {
      changes.push({
        selector: 'button',
        action: 'style',
        property: 'backgroundColor',
        value: '#007bff'
      })
      changes.push({
        selector: 'button',
        action: 'style',
        property: 'color',
        value: 'white'
      })
    }

    if (lowerText.includes('button') && lowerText.includes('bigger')) {
      changes.push({
        selector: 'button',
        action: 'style',
        property: 'padding',
        value: '15px 30px'
      })
      changes.push({
        selector: 'button',
        action: 'style',
        property: 'fontSize',
        value: '18px'
      })
    }

    // Heading changes
    if (lowerText.includes('heading') && lowerText.includes('red')) {
      changes.push({
        selector: 'h1, h2, h3',
        action: 'style',
        property: 'color',
        value: '#dc3545'
      })
    }

    // Background changes
    if (lowerText.includes('background') && lowerText.includes('dark')) {
      changes.push({
        selector: 'body',
        action: 'style',
        property: 'backgroundColor',
        value: '#1a1a1a'
      })
      changes.push({
        selector: 'body',
        action: 'style',
        property: 'color',
        value: '#ffffff'
      })
    }

    // Link changes
    if (lowerText.includes('link') && lowerText.includes('underline')) {
      changes.push({
        selector: 'a',
        action: 'style',
        property: 'textDecoration',
        value: 'underline'
      })
    }

    // Text changes
    if (lowerText.includes('text') && lowerText.includes('larger')) {
      changes.push({
        selector: 'p, div',
        action: 'style',
        property: 'fontSize',
        value: '1.2em'
      })
    }

    // Shadow effects
    if (lowerText.includes('shadow')) {
      const selector = lowerText.includes('button') ? 'button' : 
                       lowerText.includes('card') ? '.card, .container' : 
                       'div'
      changes.push({
        selector,
        action: 'style',
        property: 'boxShadow',
        value: '0 4px 6px rgba(0, 0, 0, 0.1)'
      })
    }

    return changes
  }

  const handleGenerate = async () => {
    if (!input.trim()) return

    setProcessing(true)
    try {
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const changes = parseNaturalLanguage(input)
      
      if (changes.length === 0) {
        alert('Could not understand the request. Try something like "make all buttons have rounded corners"')
      } else {
        onGenerate(changes)
        setInput('')
      }
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Natural Language Description
      </label>
      <div className="flex gap-2">
        <textarea
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe what you want to change, e.g., 'Make all buttons have rounded corners and a blue background'"
          disabled={disabled || processing}
        />
      </div>
      <Button
        type="button"
        onClick={handleGenerate}
        disabled={disabled || processing || !input.trim()}
        size="sm"
        className="w-full"
      >
        ✨ {processing ? 'Processing...' : 'Generate DOM Changes'}
      </Button>
      <p className="text-xs text-gray-500">
        Examples: "make buttons rounded", "change heading color to red", "add shadows to buttons"
      </p>
    </div>
  )
}