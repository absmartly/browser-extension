import React, { useState, useEffect } from 'react'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Badge } from './ui/Badge'
import { DOMChangesInlineEditor } from './DOMChangesInlineEditor'
import { DOMChangesJSONEditor } from './DOMChangesJSONEditor'
import type { Experiment } from '~src/types/absmartly'
import type { DOMChange } from '~src/types/dom-changes'
import { ArrowLeftIcon, PlusIcon, TrashIcon, CodeBracketIcon, XMarkIcon } from '@heroicons/react/24/outline'

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
  variables: Record<string, any>
  dom_changes: DOMChange[]
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
        let dom_changes: DOMChange[] = []
        let variables: Record<string, any> = {}
        try {
          const config = JSON.parse(v.config || '{}')
          if (config.dom_changes) {
            dom_changes = config.dom_changes
            const { dom_changes: _, ...otherVars } = config
            variables = otherVars
          } else {
            variables = config
          }
        } catch (e) {
          debugError('Failed to parse variant config:', e)
        }
        
        return {
          name: v.name || '',
          variables,
          dom_changes
        }
      })
    }
    return [
      { name: 'Control', variables: {}, dom_changes: [] },
      { name: 'Variant 1', variables: {}, dom_changes: [] }
    ]
  })

  const [jsonEditorOpen, setJsonEditorOpen] = useState(false)
  const [jsonEditorVariant, setJsonEditorVariant] = useState<number | null>(null)
  const [previewEnabled, setPreviewEnabled] = useState(false)
  const [activePreviewVariant, setActivePreviewVariant] = useState<number | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prepare variants with DOM changes
    const preparedVariants = variants.map((v, index) => {
      const config: any = { ...v.variables }
      
      // Include DOM changes if any
      if (v.dom_changes.length > 0) {
        config.dom_changes = v.dom_changes
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
      variables: {},
      dom_changes: []
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

  const updateVariantDOMChanges = (index: number, changes: DOMChange[]) => {
    const newVariants = [...variants]
    newVariants[index].dom_changes = changes
    setVariants(newVariants)
  }

  const updateVariantVariables = (index: number, key: string, value: string) => {
    const newVariants = [...variants]
    newVariants[index].variables[key] = value
    setVariants(newVariants)
  }

  const addVariantVariable = (index: number) => {
    const key = prompt('Enter variable name:')
    if (key) {
      updateVariantVariables(index, key, '')
    }
  }

  const deleteVariantVariable = (index: number, key: string) => {
    const newVariants = [...variants]
    delete newVariants[index].variables[key]
    setVariants(newVariants)
  }

  const handlePreviewToggleForVariant = (enabled: boolean, variantIndex: number) => {
    setPreviewEnabled(enabled)
    setActivePreviewVariant(enabled ? variantIndex : null)
    
    if (enabled && variants[variantIndex]) {
      const changes = variants[variantIndex].dom_changes || []
      const variantName = variants[variantIndex].name
      
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'ABSMARTLY_PREVIEW',
            action: 'apply',
            changes: changes.filter(c => c.enabled !== false),
            experimentName: formData.name,
            variantName: variantName
          })
        }
      })
    } else if (!enabled) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'ABSMARTLY_PREVIEW',
            action: 'remove',
            experimentName: formData.name
          })
        }
      })
    }
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
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Input
                    className="flex-1 font-medium"
                    value={variant.name}
                    onChange={(e) => {
                      const newVariants = [...variants]
                      newVariants[index].name = e.target.value
                      setVariants(newVariants)
                    }}
                    placeholder={`Variant ${index}`}
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      setJsonEditorVariant(index)
                      setJsonEditorOpen(true)
                    }}
                    size="sm"
                    variant="secondary"
                    title="Edit DOM Changes as JSON"
                  >
                    <CodeBracketIcon className="h-4 w-4" />
                    JSON
                  </Button>
                  {variants.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeVariant(index)}
                      className="p-1 text-red-600 hover:text-red-800"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Variables Section */}
                <div className="space-y-3">
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Variables</h5>
                    <div className="space-y-2">
                      {Object.entries(variant.variables).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                          <Input
                            value={key}
                            disabled
                            className="flex-1 text-sm"
                          />
                          <Input
                            value={typeof value === 'object' ? JSON.stringify(value) : value}
                            onChange={(e) => updateVariantVariables(index, key, e.target.value)}
                            className="flex-1 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => deleteVariantVariable(index, key)}
                            className="p-1 text-red-600 hover:text-red-800"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        onClick={() => addVariantVariable(index)}
                        size="sm"
                        variant="secondary"
                        className="w-full"
                      >
                        Add Variable
                      </Button>
                    </div>
                  </div>

                  {/* DOM Changes Section */}
                  <DOMChangesInlineEditor
                    variantName={variant.name}
                    changes={variant.dom_changes}
                    onChange={(changes) => updateVariantDOMChanges(index, changes)}
                    previewEnabled={previewEnabled && activePreviewVariant === index}
                    onPreviewToggle={(enabled) => handlePreviewToggleForVariant(enabled, index)}
                  />
                </div>
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
      
      {/* JSON Editor Modal */}
      {jsonEditorVariant !== null && (
        <DOMChangesJSONEditor
          isOpen={jsonEditorOpen}
          onClose={() => {
            setJsonEditorOpen(false)
            setJsonEditorVariant(null)
          }}
          changes={variants[jsonEditorVariant]?.dom_changes || []}
          onSave={(newChanges) => {
            updateVariantDOMChanges(jsonEditorVariant, newChanges)
            setJsonEditorOpen(false)
            setJsonEditorVariant(null)
          }}
          variantName={variants[jsonEditorVariant]?.name || ''}
        />
      )}
    </div>
  )
}