import React, { useState, useEffect } from 'react'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Badge } from './ui/Badge'
import { NaturalLanguageInput } from './NaturalLanguageInput'
import type { Experiment } from '~src/types/absmartly'
import type { DOMChangeInstruction } from '~src/types/dom'
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

interface ExperimentEditorProps {
  experiment?: Experiment | null
  onSave: (experiment: Partial<Experiment>) => Promise<void>
  onCancel: () => void
  loading?: boolean
  applications?: any[]
  unitTypes?: any[]
  metrics?: any[]
  tags?: any[]
}

interface VariantData {
  name: string
  config: string
  domChanges: DOMChangeInstruction[]
}

export function ExperimentEditor({
  experiment,
  onSave,
  onCancel,
  loading,
  applications = [],
  unitTypes = [],
  metrics = [],
  tags = []
}: ExperimentEditorProps) {
  const [formData, setFormData] = useState({
    name: experiment?.name || '',
    display_name: experiment?.display_name || '',
    state: experiment?.state || 'ready',
    percentage_of_traffic: experiment?.percentage_of_traffic || 100,
    nr_variants: experiment?.nr_variants || 2,
    percentages: experiment?.percentages || '50/50',
    audience_strict: experiment?.audience_strict ?? true,
    audience: experiment?.audience || '',
    unit_type_id: experiment?.unit_type?.unit_type_id || 1,
    primary_metric_id: experiment?.primary_metric?.metric_id || null,
    application_ids: experiment?.applications?.map(a => a.application_id) || [1],
    tag_ids: experiment?.experiment_tags?.map(t => t.experiment_tag_id) || []
  })

  const [variants, setVariants] = useState<VariantData[]>(() => {
    if (experiment?.variants) {
      return experiment.variants.map(v => {
        let domChanges: DOMChangeInstruction[] = []
        try {
          const config = JSON.parse(v.config || '{}')
          if (config.dom_changes) {
            domChanges = config.dom_changes
          }
        } catch (e) {
          debugError('Failed to parse variant config:', e)
        }
        
        return {
          name: v.name || '',
          config: v.config || '{}',
          domChanges
        }
      })
    }
    return [
      { name: 'Control', config: '{}', domChanges: [] },
      { name: 'Variant 1', config: '{}', domChanges: [] }
    ]
  })

  const [showDOMEditor, setShowDOMEditor] = useState<number | null>(null)
  const [importedChanges, setImportedChanges] = useState<string>('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prepare variants with DOM changes
    const preparedVariants = variants.map((v, index) => {
      const config: any = {}
      
      // Include DOM changes if any
      if (v.domChanges.length > 0) {
        config.dom_changes = v.domChanges
      }
      
      return {
        variant: index,
        name: v.name,
        config: JSON.stringify(config)
      }
    })

    const experimentData: any = {
      ...formData,
      unit_type: { unit_type_id: formData.unit_type_id },
      primary_metric: formData.primary_metric_id ? { metric_id: formData.primary_metric_id } : null,
      applications: formData.application_ids.map(id => ({
        application_id: id,
        application_version: "0"
      })),
      experiment_tags: formData.tag_ids.map(id => ({ experiment_tag_id: id })),
      variants: preparedVariants,
      owners: [{ user_id: 3 }], // TODO: Get current user ID
      teams: []
    }

    await onSave(experimentData)
  }

  const addVariant = () => {
    setVariants([...variants, { 
      name: `Variant ${variants.length}`, 
      config: '{}',
      domChanges: []
    }])
    
    // Update percentages
    const count = variants.length + 1
    const percentage = Math.floor(100 / count)
    const remainder = 100 - (percentage * count)
    const percentages = Array(count).fill(percentage)
    percentages[0] += remainder
    
    setFormData({
      ...formData,
      nr_variants: count,
      percentages: percentages.join('/')
    })
  }

  const removeVariant = (index: number) => {
    if (variants.length <= 2) return // Minimum 2 variants
    
    const newVariants = variants.filter((_, i) => i !== index)
    setVariants(newVariants)
    
    // Update percentages
    const count = newVariants.length
    const percentage = Math.floor(100 / count)
    const remainder = 100 - (percentage * count)
    const percentages = Array(count).fill(percentage)
    percentages[0] += remainder
    
    setFormData({
      ...formData,
      nr_variants: count,
      percentages: percentages.join('/')
    })
  }

  const updateVariantDOMChanges = (index: number, changes: DOMChangeInstruction[]) => {
    const newVariants = [...variants]
    newVariants[index].domChanges = changes
    setVariants(newVariants)
  }

  const importDOMChanges = (variantIndex: number) => {
    try {
      const changes = JSON.parse(importedChanges)
      if (Array.isArray(changes)) {
        updateVariantDOMChanges(variantIndex, changes)
        setImportedChanges('')
        setShowDOMEditor(null)
      } else {
        alert('Invalid DOM changes format. Must be an array.')
      }
    } catch (e) {
      alert('Invalid JSON format')
    }
  }

  const getChangesFromContentScript = async (variantIndex: number) => {
    chrome.runtime.sendMessage({ type: "GET_DOM_CHANGES_FROM_TAB" }, (response) => {
      if (response?.changes) {
        updateVariantDOMChanges(variantIndex, response.changes)
      }
    })
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <button
          onClick={onCancel}
          className="flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to experiments
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {experiment ? 'Edit Experiment' : 'Create New Experiment'}
          </h2>
        </div>

        {/* Basic Information */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Experiment Name
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="my_experiment_name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display Name
            </label>
            <Input
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              placeholder="My Experiment"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Traffic Percentage
            </label>
            <Input
              type="number"
              min="0"
              max="100"
              value={formData.percentage_of_traffic}
              onChange={(e) => setFormData({ ...formData, percentage_of_traffic: parseInt(e.target.value) })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit Type
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              value={formData.unit_type_id}
              onChange={(e) => setFormData({ ...formData, unit_type_id: parseInt(e.target.value) })}
            >
              {unitTypes.map(ut => (
                <option key={ut.id} value={ut.id}>{ut.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Primary Metric
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              value={formData.primary_metric_id || ''}
              onChange={(e) => setFormData({ ...formData, primary_metric_id: e.target.value ? parseInt(e.target.value) : null })}
            >
              <option value="">Select a metric</option>
              {metrics.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Variants */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Variants</h3>
            <Button
              type="button"
              onClick={addVariant}
              size="sm"
              variant="secondary"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Variant
            </Button>
          </div>

          <div className="space-y-2">
            {variants.map((variant, index) => (
              <div key={index} className="border border-gray-200 rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <Input
                    value={variant.name}
                    onChange={(e) => {
                      const newVariants = [...variants]
                      newVariants[index].name = e.target.value
                      setVariants(newVariants)
                    }}
                    placeholder={`Variant ${index}`}
                    className="w-48"
                  />
                  <div className="flex items-center gap-2">
                    <Badge variant="info">
                      {variant.domChanges.length} DOM changes
                    </Badge>
                    {variants.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeVariant(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => setShowDOMEditor(index)}
                    size="sm"
                    variant="secondary"
                  >
                    Edit DOM Changes
                  </Button>
                  <Button
                    type="button"
                    onClick={() => getChangesFromContentScript(index)}
                    size="sm"
                    variant="secondary"
                  >
                    Import from Visual Editor
                  </Button>
                </div>

                {showDOMEditor === index && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-md">
                    <div className="space-y-4">
                      <NaturalLanguageInput 
                        onGenerate={(changes) => {
                          updateVariantDOMChanges(index, changes)
                          setShowDOMEditor(null)
                        }}
                      />
                      
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-300" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-2 bg-gray-50 text-gray-500">or edit manually</span>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">DOM Changes JSON</h4>
                        <textarea
                          className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md text-xs font-mono"
                          value={JSON.stringify(variant.domChanges, null, 2)}
                          onChange={(e) => setImportedChanges(e.target.value)}
                          placeholder='[{"selector": ".title", "action": "text", "value": "New Title"}]'
                        />
                        <div className="mt-2 flex gap-2">
                          <Button
                            type="button"
                            onClick={() => importDOMChanges(index)}
                            size="sm"
                          >
                            Apply JSON Changes
                          </Button>
                          <Button
                            type="button"
                            onClick={() => {
                              setShowDOMEditor(null)
                              setImportedChanges('')
                            }}
                            size="sm"
                            variant="secondary"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="pt-4 flex gap-2 border-t">
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
          >
            {experiment ? 'Update Experiment' : 'Create Experiment'}
          </Button>
          <Button
            type="button"
            onClick={onCancel}
            variant="secondary"
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}