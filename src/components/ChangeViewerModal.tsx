import React from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { XMarkIcon, ClipboardIcon } from '@heroicons/react/24/outline'
import type { DOMChange } from '~src/types/dom-changes'
import { renderMarkdown } from '~src/utils/markdown'

interface ChangeViewerModalProps {
  isOpen: boolean
  onClose: () => void
  changes: DOMChange[]
  response: string
  timestamp: number
}

export function ChangeViewerModal({
  isOpen,
  onClose,
  changes,
  response,
  timestamp
}: ChangeViewerModalProps) {
  const [copied, setCopied] = React.useState(false)

  if (!isOpen) return null

  const formattedJSON = JSON.stringify(changes, null, 2)
  const formattedDate = new Date(timestamp).toLocaleString()

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formattedJSON)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              DOM Changes
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {changes.length} change{changes.length !== 1 ? 's' : ''} • {formattedDate}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {response && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <h3 className="text-sm font-medium text-blue-900 mb-2">
                AI Response
              </h3>
              <div
                className="text-sm text-blue-800 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(response) }}
              />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">
                JSON Changes
              </h3>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-3 py-1 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors">
                <ClipboardIcon className="w-4 h-4" />
                {copied ? 'Copied!' : 'Copy JSON'}
              </button>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <CodeMirror
                value={formattedJSON}
                height="400px"
                extensions={[json()]}
                editable={false}
                basicSetup={{
                  lineNumbers: true,
                  highlightActiveLineGutter: false,
                  highlightActiveLine: false,
                  foldGutter: true,
                  dropCursor: false,
                  allowMultipleSelections: false,
                  indentOnInput: false,
                  syntaxHighlighting: true,
                  bracketMatching: true,
                  closeBrackets: false,
                  autocompletion: false,
                  rectangularSelection: false,
                  crosshairCursor: false,
                  highlightSelectionMatches: false,
                  closeBracketsKeymap: false,
                  searchKeymap: true,
                  foldKeymap: true,
                  completionKeymap: false,
                  lintKeymap: false
                }}
                theme="light"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
