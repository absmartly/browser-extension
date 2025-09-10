import React, { useState } from 'react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { STYLE_RULES_TEMPLATES } from '~src/types/dom-changes'
import type { DOMChangeStyleRules } from '~src/types/dom-changes'
import { SparklesIcon } from '@heroicons/react/24/outline'
import { CSSStyleEditor } from './CSSStyleEditor'

interface StyleRulesEditorProps {
  change: Partial<DOMChangeStyleRules>
  onChange: (change: Partial<DOMChangeStyleRules>) => void
}

type StateType = 'normal' | 'hover' | 'active' | 'focus'

const STATE_TABS: { key: StateType; label: string; description: string }[] = [
  { key: 'normal', label: 'Normal', description: 'Default state' },
  { key: 'hover', label: 'Hover', description: 'When hovering' },
  { key: 'active', label: 'Active', description: 'When clicking' },
  { key: 'focus', label: 'Focus', description: 'When focused' }
]

export function StyleRulesEditor({ change, onChange }: StyleRulesEditorProps) {
  const [activeTab, setActiveTab] = useState<StateType>('normal')
  const [showTemplates, setShowTemplates] = useState(false)

  const states = change.states || {
    normal: {},
    hover: {},
    active: {},
    focus: {}
  }

  const handleStyleChange = (state: StateType, properties: Array<{ key: string; value: string }>) => {
    const stateStyles: Record<string, string> = {}
    properties.forEach(({ key, value }) => {
      if (key && value) {
        stateStyles[key] = value
      }
    })

    const updatedStates = {
      ...states,
      [state]: stateStyles
    }

    onChange({
      ...change,
      states: updatedStates
    })
  }

  const handleImportantToggle = (checked: boolean) => {
    onChange({
      ...change,
      important: checked
    })
  }

  const handleWaitForElementToggle = (checked: boolean) => {
    onChange({
      ...change,
      waitForElement: checked
    })
  }

  const handleObserverRootChange = (value: string) => {
    onChange({
      ...change,
      observerRoot: value || undefined
    })
  }

  const applyTemplate = (template: typeof STYLE_RULES_TEMPLATES[0]) => {
    onChange({
      ...change,
      states: template.states,
      important: template.important
    })
    setShowTemplates(false)
  }

  const getCurrentStateProperties = (): Array<{ key: string; value: string }> => {
    const stateStyles = states[activeTab] || {}
    const props = Object.entries(stateStyles).map(([key, value]) => ({ key, value }))
    return props.length > 0 ? props : [{ key: '', value: '' }]
  }

  const formatCSSProperty = (prop: string) => {
    return prop.replace(/([A-Z])/g, '-$1').toLowerCase()
  }

  const generateCSSPreview = () => {
    const rules: string[] = []
    
    Object.entries(states).forEach(([state, styles]) => {
      if (styles && Object.keys(styles).length > 0) {
        const selector = state === 'normal' ? change.selector || '.element' : `${change.selector || '.element'}:${state}`
        const properties = Object.entries(styles)
          .map(([key, value]) => {
            const cssKey = formatCSSProperty(key)
            const importantFlag = change.important !== false ? ' !important' : ''
            return `  ${cssKey}: ${value}${importantFlag};`
          })
          .join('\n')
        rules.push(`${selector} {\n${properties}\n}`)
      }
    })
    
    return rules.join('\n\n')
  }

  return (
    <div className="space-y-4">
      {/* State Tabs - with overflow handling */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="-mb-px flex space-x-2 min-w-max">
          {STATE_TABS.map((tab) => {
            const stateStyles = states[tab.key] || {}
            const styleCount = Object.keys(stateStyles).length
            
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  py-1.5 px-2 border-b-2 font-medium text-xs transition-colors whitespace-nowrap
                  ${activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <span>{tab.label}</span>
                {styleCount > 0 && (
                  <span className="ml-1 px-1.5 py-0 text-xs bg-gray-100 rounded-full">
                    {styleCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Template Button */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          {STATE_TABS.find(t => t.key === activeTab)?.description}
        </div>
        <Button
          onClick={() => setShowTemplates(!showTemplates)}
          size="sm"
          variant="outline"
        >
          <SparklesIcon className="w-4 h-4 mr-1" />
          Templates
        </Button>
      </div>

      {/* Templates Dropdown */}
      {showTemplates && (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
          <div className="grid grid-cols-2 gap-2">
            {STYLE_RULES_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => applyTemplate(template)}
                className="text-left p-2 border border-gray-200 rounded hover:bg-white hover:border-blue-300 transition-colors"
              >
                <div className="font-medium text-sm">{template.name}</div>
                <div className="text-xs text-gray-600">{template.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Style Properties Editor - Using the exact same component as regular style changes */}
      <CSSStyleEditor
        styleProperties={getCurrentStateProperties()}
        onChange={(properties) => handleStyleChange(activeTab, properties)}
        pseudoState={activeTab}
      />

      {/* Options */}
      <div className="space-y-3 border-t pt-3">
        <div className="flex items-start">
          <input
            type="checkbox"
            id="styleRules-important"
            checked={change.important !== false}
            onChange={(e) => handleImportantToggle(e.target.checked)}
            className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="styleRules-important" className="ml-2">
            <span className="text-sm font-medium text-gray-700">Use !important flag</span>
            <p className="text-xs text-gray-500">Ensures styles override existing CSS</p>
          </label>
        </div>
        
        <div className="flex items-start">
          <input
            type="checkbox"
            id="styleRules-waitForElement"
            checked={change.waitForElement === true}
            onChange={(e) => handleWaitForElementToggle(e.target.checked)}
            className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="styleRules-waitForElement" className="ml-2">
            <span className="text-sm font-medium text-gray-700">Wait for element (lazy-loaded)</span>
            <p className="text-xs text-gray-500">Apply change when element appears in DOM</p>
          </label>
        </div>
        
        {change.waitForElement && (
          <div className="ml-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observer Root (optional)
            </label>
            <Input
              type="text"
              value={change.observerRoot || ''}
              onChange={(e) => handleObserverRootChange(e.target.value)}
              placeholder="e.g., .main-content (leave empty for document)"
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Specify a container to watch for better performance
            </p>
          </div>
        )}
      </div>

      {/* CSS Preview */}
      <div className="border-t pt-3">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
          Generated CSS
        </h4>
        <pre className="bg-gray-900 text-gray-100 p-3 rounded-md text-xs font-mono overflow-x-auto">
          <code>{generateCSSPreview() || '/* No styles defined yet */'}</code>
        </pre>
      </div>
    </div>
  )
}