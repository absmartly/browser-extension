import React, { useState } from 'react'
import { debugLog, debugError } from '~src/utils/debug'
import type { DOMChange, DOMChangeType, DOMChangeStyleRules } from '~src/types/dom-changes'
import { Checkbox } from '../ui/Checkbox'
import {
  PencilIcon,
  TrashIcon,
  DocumentTextIcon,
  PaintBrushIcon,
  HashtagIcon,
  CubeIcon,
  CodeBracketIcon,
  CommandLineIcon,
  ArrowsUpDownIcon,
  PlusCircleIcon,
  CursorArrowRaysIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'

interface DOMChangeListProps {
  changes: DOMChange[]
  onEdit: (index: number) => void
  onDelete: (index: number) => void
  onToggle: (index: number) => void
  onReorder: (changes: DOMChange[]) => void
  editingIndex: number | null
}

export function DOMChangeList({
  changes,
  onEdit,
  onDelete,
  onToggle,
  onReorder,
  editingIndex
}: DOMChangeListProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const getChangeIcon = (type: DOMChangeType) => {
    switch (type) {
      case 'text':
        return DocumentTextIcon
      case 'style':
        return PaintBrushIcon
      case 'styleRules':
        return SparklesIcon
      case 'class':
        return HashtagIcon
      case 'attribute':
        return CubeIcon
      case 'html':
        return CodeBracketIcon
      case 'javascript':
        return CommandLineIcon
      case 'move':
        return ArrowsUpDownIcon
      case 'remove':
        return TrashIcon
      case 'insert':
        return PlusCircleIcon
      case 'create':
        return PlusCircleIcon
      default:
        return CursorArrowRaysIcon
    }
  }

  const getChangeTypeLabel = (type: DOMChangeType): string => {
    switch (type) {
      case 'text': return 'Text'
      case 'style': return 'Style'
      case 'styleRules': return 'Style Rules'
      case 'class': return 'Class'
      case 'attribute': return 'Attribute'
      case 'html': return 'HTML'
      case 'javascript': return 'JavaScript'
      case 'move': return 'Move/Reorder'
      case 'remove': return 'Remove'
      case 'insert': return 'Insert'
      case 'create': return 'Create'
      default: return type
    }
  }

  const getChangeDescription = (change: DOMChange): React.ReactNode => {
    switch (change.type) {
      case 'text':
        return (
          <span className="text-gray-600">
            <span className="text-gray-500">Set text to:</span> <span className="font-medium text-gray-800">"{change.value}"</span>
          </span>
        )
      case 'style':
        const styleValue = (change as any).css || change.value || {}
        const styles = Object.entries(styleValue)
        return (
          <div className="flex flex-wrap gap-1.5">
            {styles.map(([key, value], i) => (
              <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-xs">
                <span className="text-blue-700 font-medium">{key}:</span>
                <span className="ml-0.5 text-blue-600">{String(value)}</span>
              </span>
            ))}
          </div>
        )
      case 'styleRules':
        const styleRulesChange = change as DOMChangeStyleRules
        const stateCount = Object.entries(styleRulesChange.states || {})
          .filter(([_, styles]) => styles && Object.keys(styles).length > 0)
          .length
        return (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(styleRulesChange.states || {}).map(([state, styles]) => {
              const styleCount = styles ? Object.keys(styles).length : 0
              if (styleCount === 0) return null
              return (
                <span key={state} className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-50 text-xs">
                  <span className="text-purple-700 font-medium">{state}:</span>
                  <span className="ml-0.5 text-purple-600">{styleCount} styles</span>
                </span>
              )
            })}
            {styleRulesChange.important !== false && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-yellow-50 text-xs">
                <span className="text-yellow-700">!important</span>
              </span>
            )}
          </div>
        )
      case 'class':
        if ((!change.add || change.add.length === 0) && (!change.remove || change.remove.length === 0)) {
          return <span className="text-gray-400 text-xs italic">No classes configured</span>
        }

        return (
          <div className="flex flex-wrap gap-1.5">
            {change.add?.map((cls, i) => (
              <span key={`add-${i}`} className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-50 text-xs">
                <span className="text-green-600">+</span>
                <span className="ml-0.5 text-green-700">{cls}</span>
              </span>
            ))}
            {change.remove?.map((cls, i) => (
              <span key={`remove-${i}`} className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 text-xs">
                <span className="text-red-600">−</span>
                <span className="ml-0.5 text-red-700">{cls}</span>
              </span>
            ))}
          </div>
        )
      case 'attribute':
        const attrs = Object.entries(change.value)
        return (
          <div className="flex flex-wrap gap-1.5">
            {attrs.map(([key, value], i) => (
              <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-50 text-xs">
                <span className="text-purple-700 font-medium">{key}=</span>
                <span className="text-purple-600">"{value}"</span>
              </span>
            ))}
          </div>
        )
      case 'html':
        return (
          <span className="text-gray-600">
            <span className="text-gray-500">Replace inner HTML</span>
            {change.value && change.value.length > 50 && (
              <span className="ml-1 text-xs text-gray-400">({change.value.length} chars)</span>
            )}
          </span>
        )
      case 'javascript':
        return (
          <span className="text-gray-600">
            <span className="text-gray-500">Execute JavaScript</span>
            {change.value && change.value.length > 50 && (
              <span className="ml-1 text-xs text-gray-400">({change.value.length} chars)</span>
            )}
          </span>
        )
      case 'move':
        const moveTarget = change.targetSelector || ''
        const movePosition = change.position || 'after'
        const positionText = movePosition === 'before' ? 'before' :
                           movePosition === 'after' ? 'after' :
                           movePosition === 'firstChild' ? 'as first child of' :
                           'as last child of'
        return (
          <span className="text-gray-600">
            <span className="text-gray-500">Move</span>{' '}
            <span className="text-gray-500">{positionText}</span>{' '}
            <code className="text-xs font-mono text-blue-600">{moveTarget}</code>
          </span>
        )
      case 'remove':
        return <span className="text-red-600">Remove element</span>
      case 'insert':
        const insertChange = change as any
        return (
          <span className="text-green-600">
            Insert new element {insertChange.position || 'after'} the selected element
          </span>
        )
      default:
        return <span className="text-gray-500">Unknown change type: {change.type}</span>
    }
  }

  if (changes.length === 0) {
    return (
      <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
        <CursorArrowRaysIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No DOM changes configured</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {changes.map((change, index) => {
        if (editingIndex === index) {
          return null
        }

        const Icon = getChangeIcon(change.type)
        const isDisabled = change.disabled === true

        return (
          <div
            key={index}
            draggable={true}
            title="Drag to reorder or copy to another variant"
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('application/json', JSON.stringify(change))
              e.dataTransfer.setData('source-index', index.toString())
              setDraggedIndex(index)
              e.currentTarget.classList.add('opacity-50')
            }}
            onDragEnd={(e) => {
              setDraggedIndex(null)
              setDragOverIndex(null)
              e.currentTarget.classList.remove('opacity-50')
            }}
            onDragEnter={(e) => {
              if (draggedIndex !== null && draggedIndex !== index) {
                setDragOverIndex(index)
              }
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                if (dragOverIndex === index) {
                  setDragOverIndex(null)
                }
              }
            }}
            onDrop={(e) => {
              e.preventDefault()
              setDragOverIndex(null)

              const sourceIndex = parseInt(e.dataTransfer.getData('source-index'))

              if (!isNaN(sourceIndex) && sourceIndex !== index) {
                const newChanges = [...changes]
                const [removed] = newChanges.splice(sourceIndex, 1)
                newChanges.splice(index, 0, removed)
                onReorder(newChanges)
              }
              setDraggedIndex(null)
            }}
            className={`
              dom-change-card relative border rounded-lg cursor-move hover:shadow-md
              ${isDisabled
                ? 'border-gray-200 bg-gray-50 opacity-60'
                : 'border-gray-300 bg-white hover:border-blue-300 hover:shadow-sm'
              }
              ${draggedIndex === index ? 'opacity-50 scale-95' : ''}
              ${dragOverIndex === index && draggedIndex !== null && draggedIndex !== index
                ? 'border-blue-500 border-2'
                : ''
              }
              transition-all duration-200 ease-in-out
            `}
            style={{
              marginTop: dragOverIndex === index && draggedIndex !== null && draggedIndex > index ? '48px' : '0',
              marginBottom: dragOverIndex === index && draggedIndex !== null && draggedIndex < index ? '48px' : '0',
            }}
          >
            <div className="p-3">
              <div className="flex items-start gap-2">
                <div className="flex flex-col items-center gap-1">
                  <Checkbox
                    id={`dom-change-checkbox-${index}`}
                    checked={!change.disabled}
                    onChange={() => onToggle(index)}
                  />

                  <div className="group relative">
                    <div className={`
                      p-1 rounded
                      ${isDisabled ? 'bg-gray-100' : 'bg-blue-50'}
                    `}>
                      <Icon className={`h-4 w-4 ${isDisabled ? 'text-gray-400' : 'text-blue-600'}`} />
                    </div>
                    <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                      {getChangeTypeLabel(change.type)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDelete(index)}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="mb-1.5">
                    <code
                      className="text-xs font-mono text-gray-700 block truncate"
                      title={change.selector}
                    >
                      {change.selector}
                    </code>
                  </div>

                  <div className="text-sm">
                    {getChangeDescription(change)}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigator.clipboard.writeText(JSON.stringify([change], null, 2))
                      .then(() => {
                        debugLog('✅ DOM change copied to clipboard')
                      })
                      .catch(err => {
                        debugError('Failed to copy change:', err)
                      })
                  }}
                  className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors flex-shrink-0"
                  title="Copy this change"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => onEdit(index)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors flex-shrink-0"
                  title="Edit"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
