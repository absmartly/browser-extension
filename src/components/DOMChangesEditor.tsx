import React, { useState, useEffect } from 'react'
import { Storage } from '@plasmohq/storage'
import { Button } from './ui/Button'
import { Checkbox } from './ui/Checkbox'
import type { DOMChange } from '~src/types/dom-changes'
import { PencilIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline'
import { DOMChangeModal } from './DOMChangeModal'

interface DOMChangesEditorProps {
  variantName: string
  changes: DOMChange[]
  onChange: (changes: DOMChange[]) => void
  previewEnabled: boolean
  onPreviewToggle: (enabled: boolean) => void
  readOnly?: boolean
}

export function DOMChangesEditor({ 
  variantName, 
  changes, 
  onChange, 
  previewEnabled,
  onPreviewToggle,
  readOnly = false
}: DOMChangesEditorProps) {
  const [editingChange, setEditingChange] = useState<DOMChange | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  // Restore modal state when component mounts
  useEffect(() => {
    const storage = new Storage({ area: "session" })
    storage.get('domChangesEditorState').then(result => {
      if (result && result.variantName === variantName) {
        console.log('Restoring DOM Changes Editor state:', result)
        if (result.showAddModal) {
          setShowAddModal(true)
        }
        if (result.editingChange) {
          setEditingChange(result.editingChange)
          setEditingIndex(result.editingIndex)
        }
        // Clear the state after using it
        storage.remove('domChangesEditorState')
      }
    })
  }, [variantName])

  // Save state when modal opens
  const handleOpenAddModal = () => {
    const storage = new Storage({ area: "session" })
    storage.set('domChangesEditorState', {
      variantName,
      showAddModal: true,
      editingChange: null,
      editingIndex: null
    })
    setShowAddModal(true)
  }

  // Save state when editing
  const handleEditChange = (index: number) => {
    const change = changes[index]
    const storage = new Storage({ area: "session" })
    storage.set('domChangesEditorState', {
      variantName,
      showAddModal: false,
      editingChange: change,
      editingIndex: index
    })
    setEditingChange(change)
    setEditingIndex(index)
  }

  const handleToggleChange = (index: number) => {
    const newChanges = [...changes]
    newChanges[index] = { ...newChanges[index], enabled: !newChanges[index].enabled }
    onChange(newChanges)
  }


  const handleDeleteChange = (index: number) => {
    const newChanges = changes.filter((_, i) => i !== index)
    onChange(newChanges)
  }

  const handleSaveChange = (change: DOMChange) => {
    if (editingIndex !== null) {
      const newChanges = [...changes]
      newChanges[editingIndex] = change
      onChange(newChanges)
    } else {
      onChange([...changes, change])
    }
    setEditingChange(null)
    setEditingIndex(null)
    setShowAddModal(false)
    // Clear stored state
    const storage = new Storage({ area: "session" })
    storage.remove('domChangesEditorState')
  }

  const getChangeDescription = (change: DOMChange): string => {
    switch (change.type) {
      case 'text':
        return `"${change.value}"`
      case 'style':
        return Object.entries(change.value).map(([k, v]) => `${k}: ${v}`).join(', ')
      case 'class':
        const parts = []
        if (change.add?.length) parts.push(`+${change.add.join(', ')}`)
        if (change.remove?.length) parts.push(`-${change.remove.join(', ')}`)
        return parts.join(' ')
      case 'attribute':
        return Object.entries(change.value).map(([k, v]) => `${k}="${v}"`).join(', ')
      case 'html':
        return 'HTML content'
      case 'javascript':
        return 'JavaScript code'
      default:
        return 'Unknown change'
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">DOM Changes for {variantName}</h4>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <span>Preview:</span>
            <button
              type="button"
              onClick={() => onPreviewToggle(!previewEnabled)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                previewEnabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  previewEnabled ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      <div className="border border-gray-200 rounded-md divide-y divide-gray-200">
        {changes.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            No DOM changes configured
          </div>
        ) : (
          changes.map((change, index) => (
            <div key={index} className="p-3 flex items-center gap-3">
              <Checkbox
                checked={change.enabled !== false}
                onChange={readOnly ? undefined : () => handleToggleChange(index)}
                disabled={readOnly}
              />
              <div className="flex-1 text-sm">
                <span className="font-mono text-gray-900">{change.selector}</span>
                <span className="mx-2 text-gray-400">|</span>
                <span className="text-gray-700">{change.type}</span>
                <span className="mx-2 text-gray-400">|</span>
                <span className="text-gray-600">{getChangeDescription(change)}</span>
              </div>
              {!readOnly && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleEditChange(index)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Edit"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteChange(index)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {!readOnly && (
        <Button
          type="button"
          onClick={handleOpenAddModal}
          size="sm"
          variant="secondary"
          className="w-full"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Add DOM Change
        </Button>
      )}

      {(showAddModal || editingChange) && (
        <DOMChangeModal
          change={editingChange}
          onSave={handleSaveChange}
          onClose={() => {
            setShowAddModal(false)
            setEditingChange(null)
            setEditingIndex(null)
            // Clear stored state
            const storage = new Storage({ area: "session" })
            storage.remove('domChangesEditorState')
          }}
        />
      )}
    </div>
  )
}