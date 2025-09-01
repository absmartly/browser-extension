import React, { useState, useEffect } from 'react'
import { Button } from './ui/Button'
import { PencilIcon } from '@heroicons/react/24/outline'
import { getCustomCode, setCustomCode } from '~src/utils/storage'
import type { CustomCodeSection } from '~src/types/absmartly'
import { CustomCodeEditor } from './CustomCodeEditor'

interface CustomCodeSettingsProps {
  onSave?: () => void
}

export function CustomCodeSettings({ onSave }: CustomCodeSettingsProps) {
  const [customCode, setCustomCodeState] = useState({
    headStart: '',
    headEnd: '',
    bodyStart: '',
    bodyEnd: '',
    styleTag: ''
  })
  const [loading, setLoading] = useState(true)
  const [editingSection, setEditingSection] = useState<CustomCodeSection | null>(null)
  const [tempValue, setTempValue] = useState('')

  useEffect(() => {
    loadCustomCode()
  }, [])

  const loadCustomCode = async () => {
    try {
      const code = await getCustomCode()
      if (code) {
        setCustomCodeState(code)
      }
    } catch (error) {
      console.error('Failed to load custom code:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSectionClick = (section: CustomCodeSection) => {
    setEditingSection(section)
    setTempValue(customCode[section] || '')
  }

  const handleSaveSection = async () => {
    if (editingSection) {
      console.log('Saving section:', editingSection, 'with value:', tempValue)
      const updatedCode = {
        ...customCode,
        [editingSection]: tempValue
      }
      console.log('Updated custom code:', updatedCode)
      setCustomCodeState(updatedCode)
      await setCustomCode(updatedCode)
      console.log('Custom code saved to storage')
      setEditingSection(null)
      setTempValue('')
      onSave?.()
    }
  }

  const handleCloseDialog = () => {
    setEditingSection(null)
    setTempValue('')
  }

  const hasCode = (section: CustomCodeSection) => {
    return customCode[section] && customCode[section].trim().length > 0
  }

  const getCodePreview = (code: string) => {
    if (!code) return 'Click to add code'
    const lines = code.trim().split('\n')
    const preview = lines.slice(0, 2).join('\n')
    return lines.length > 2 ? `${preview}...` : preview
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <div role="status" aria-label="Loading custom code settings">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    )
  }

  const sections = [
    { key: 'headStart' as CustomCodeSection, title: 'Start of <head> tag', icon: '📝' },
    { key: 'headEnd' as CustomCodeSection, title: 'End of <head> tag', icon: '📄' },
    { key: 'bodyStart' as CustomCodeSection, title: 'Start of <body> tag', icon: '🎯' },
    { key: 'bodyEnd' as CustomCodeSection, title: 'End of <body> tag', icon: '🏁' },
    { key: 'styleTag' as CustomCodeSection, title: 'CSS Styles', icon: '🎨' }
  ]

  return (
    <div className="space-y-4">
      <div className="space-y-3 border-t pt-4 mt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">Custom Code Injection</h3>
          <a 
            href="#"
            onClick={(e) => {
              e.preventDefault()
              // TODO: Add link to documentation
            }}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            Learn More
          </a>
        </div>
        
        <p className="text-xs text-gray-500">
          Add custom HTML, JavaScript, or CSS that will be injected into the page by the SDK plugin.
        </p>

        <div className="space-y-2">
          {sections.map((section) => (
            <div
              key={section.key}
              onClick={() => handleSectionClick(section.key)}
              className="border rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{section.icon}</span>
                    <span className="text-sm font-medium text-gray-700">{section.title}</span>
                    {hasCode(section.key) && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        Has code
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 font-mono bg-gray-100 p-2 rounded mt-2">
                    <pre className="whitespace-pre-wrap break-all">
                      {getCodePreview(customCode[section.key])}
                    </pre>
                  </div>
                </div>
                <PencilIcon className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Code Editor - Renders in main page via content script */}
      <CustomCodeEditor
        isOpen={editingSection !== null}
        onClose={handleCloseDialog}
        section={editingSection as CustomCodeSection}
        value={tempValue}
        onChange={setTempValue}
        onSave={handleSaveSection}
      />
    </div>
  )
}