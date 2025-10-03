import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Badge } from './ui/Badge'
import { Select } from './ui/Select'
// Removed - now using VariantList
import type { Experiment } from '~src/types/absmartly'
import type { DOMChange } from '~src/types/dom-changes'
import { ArrowLeftIcon, LockClosedIcon, LockOpenIcon } from '@heroicons/react/24/outline'
import { VariantList } from './VariantList'
import { ExperimentMetadata } from './ExperimentMetadata'
import { getConfig } from '~src/utils/storage'

interface ExperimentEditorProps {
  experiment?: Experiment | null
  onSave: (experiment: Partial<Experiment>) => Promise<void>
  onCancel: () => void
  loading?: boolean
  applications?: any[]
  unitTypes?: any[]
  metrics?: any[]
  tags?: any[]
  owners?: any[]
  teams?: any[]
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
  tags = [],
  owners = [],
  teams = []
}: ExperimentEditorProps) {
  const [domFieldName, setDomFieldName] = useState<string>('__dom_changes')
  const [formData, setFormData] = useState({
    name: experiment?.name || '',
    display_name: experiment?.display_name || '',
    state: experiment?.state || 'created',
    percentage_of_traffic: experiment?.percentage_of_traffic || 100,
    nr_variants: experiment?.nr_variants || 2,
    percentages: experiment?.percentages || '50/50',
    audience_strict: experiment?.audience_strict ?? false,
    audience: experiment?.audience || '{"filter":[{"and":[]}]}',
    unit_type_id: experiment?.unit_type?.unit_type_id || null,
    application_ids: experiment?.applications?.map(a => a.application_id) || [],
    owner_ids: experiment?.owners?.map(o => o.user_id || o.id) || [],
    team_ids: experiment?.teams?.map(t => t.team_id || t.id) || [],
    tag_ids: experiment?.experiment_tags?.map(t => t.experiment_tag_id) || []
  })

  const [initialVariants] = useState<VariantData[]>(() => {
    if (experiment?.variants) {
      return experiment.variants.map(v => {
        let dom_changes: DOMChange[] = []
        let variables: Record<string, any> = {}
        try {
          const config = JSON.parse(v.config || '{}')
          const fieldName = '__dom_changes'
          if (config[fieldName] && Array.isArray(config[fieldName])) {
            dom_changes = config[fieldName]
            const tempConfig = { ...config }
            delete tempConfig[fieldName]
            variables = tempConfig
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

  const [currentVariants, setCurrentVariants] = useState<VariantData[]>(initialVariants)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [namesSynced, setNamesSynced] = useState(!experiment) // Start synced for new experiments, unsynced for existing

  // Load config on mount to get the DOM changes field name
  useEffect(() => {
    const loadConfig = async () => {
      const config = await getConfig()
      const fieldName = config?.domChangesFieldName || '__dom_changes'
      setDomFieldName(fieldName)
    }
    loadConfig()
  }, [])

  // Stable onChange handler for ExperimentMetadata using functional state update
  const handleMetadataChange = useCallback((metadata: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...metadata }))
  }, [])

  // Memoize metadata data object to prevent unnecessary re-renders
  const metadataData = useMemo(() => ({
    percentage_of_traffic: formData.percentage_of_traffic,
    unit_type_id: formData.unit_type_id,
    application_ids: formData.application_ids,
    owner_ids: formData.owner_ids,
    team_ids: formData.team_ids,
    tag_ids: formData.tag_ids
  }), [
    formData.percentage_of_traffic,
    formData.unit_type_id,
    formData.application_ids,
    formData.owner_ids,
    formData.team_ids,
    formData.tag_ids
  ])

  // Helper functions for name conversion
  const snakeToTitle = (snake: string): string => {
    return snake
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  const titleToSnake = (title: string): string => {
    return title
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
  }

  const handleNameChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      name: value,
      ...(namesSynced ? { display_name: snakeToTitle(value) } : {})
    }))
  }

  const handleDisplayNameChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      display_name: value,
      ...(namesSynced ? { name: titleToSnake(value) } : {})
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required fields
    if (!formData.unit_type_id) {
      alert('Please select a unit type')
      return
    }
    
    // Prepare variants with DOM changes
    const preparedVariants = currentVariants.map((v, index) => {
      const config: any = { ...v.variables }
      
      // Include DOM changes only if not empty
      if (v.dom_changes && v.dom_changes.length > 0) {
        config[domFieldName] = v.dom_changes
      }
      
      return {
        variant: index,
        name: v.name,
        config: JSON.stringify(config)
      }
    })

    const experimentData: any = {
      ...formData,
      state: experiment ? formData.state : 'created', // New experiments start as created/draft
      iteration: 1,
      unit_type: { unit_type_id: formData.unit_type_id },
      primary_metric: { metric_id: null },
      secondary_metrics: [],
      applications: formData.application_ids.map(id => ({
        application_id: id,
        application_version: "0"
      })),
      experiment_tags: formData.tag_ids.map(id => ({ experiment_tag_id: id })),
      variants: preparedVariants,
      variant_screenshots: [],
      owners: formData.owner_ids.map(id => ({ user_id: id })),
      teams: formData.team_ids.map(id => ({ team_id: id })),
      // Add analysis type fields for new experiments
      type: 'test',
      analysis_type: 'group_sequential',
      baseline_participants_per_day: '33',
      required_alpha: '0.100',
      required_power: '0.800',
      group_sequential_futility_type: 'binding',
      group_sequential_analysis_count: null,
      group_sequential_min_analysis_interval: '1d',
      group_sequential_first_analysis_interval: '7d',
      minimum_detectable_effect: null,
      group_sequential_max_duration_interval: '6w',
      parent_experiment: null,
      template_permission: {},
      template_name: '',
      template_description: '',
      // Add custom section field values (empty for now)
      custom_section_field_values: {
        "1": { value: "", type: "text", id: 1 },
        "2": { value: "", type: "text", id: 2 },
        "3": { value: "", type: "text", id: 3 },
        "4": { value: "", type: "text", id: 4 },
        "5": { value: "", type: "text", id: 5 },
        "111": { value: "", type: "string", id: 111 }
      }
    }

    await onSave(experimentData)
  }



  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={chrome.runtime.getURL('assets/icon128.png')}
            alt="ABsmartly"
            className="w-6 h-6"
          />
          <h2 className="text-lg font-semibold text-gray-900">
            {experiment ? 'Edit Experiment' : 'Create New Experiment'}
          </h2>
        </div>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          aria-label="Go back"
          title="Go back"
        >
          <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Basic Information */}
        <div className="space-y-3">
          {/* Name fields with sync lock */}
          <div className="flex items-start">
            <div className="flex-1 space-y-3" style={{ paddingRight: '24px' }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Experiment Name
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
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
                  onChange={(e) => handleDisplayNameChange(e.target.value)}
                  placeholder="My Experiment"
                />
              </div>
            </div>
            
            {/* Lock icon with bracket */}
            <div className="relative" style={{ width: '24px', paddingTop: '28px', marginLeft: '-24px' }}>
              {/* Bracket lines */}
              {namesSynced && (
                <svg
                  className="absolute"
                  width="24"
                  height="108"
                  style={{
                    left: '0',
                    top: '28px'
                  }}
                >
                  {/* Top horizontal */}
                  <path
                    d="M 0 20 L 12 20"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    fill="none"
                  />
                  {/* Bottom horizontal */}
                  <path
                    d="M 0 88 L 12 88"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    fill="none"
                  />
                  {/* Vertical connector */}
                  <path
                    d="M 12 20 L 12 88"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    fill="none"
                  />
                </svg>
              )}
              
              {/* Lock button positioned on the vertical line */}
              <button
                type="button"
                onClick={() => setNamesSynced(!namesSynced)}
                className="absolute z-10 p-1 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                style={{
                  left: '12px',
                  top: '82px',
                  transform: 'translate(-50%, -50%)'
                }}
                title={namesSynced ? "Names are synced. Click to unlock" : "Names are not synced. Click to lock"}
              >
                {namesSynced ? (
                  <LockClosedIcon className="h-4 w-4 text-blue-600" />
                ) : (
                  <LockOpenIcon className="h-4 w-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          <ExperimentMetadata
            data={metadataData}
            onChange={handleMetadataChange}
            canEdit={true}
            applications={applications}
            unitTypes={unitTypes}
            owners={owners}
            teams={teams}
            tags={tags}
          />

        </div>

        {/* Variants */}
        <VariantList
          initialVariants={initialVariants}
          experimentId={experiment?.id || 0}
          experimentName={formData.name}
          onVariantsChange={(variants, hasChanges) => {
            setCurrentVariants(variants)
            setHasUnsavedChanges(hasChanges)
            // Update percentages
            const count = variants.length
            const percentage = Math.floor(100 / count)
            const remainder = 100 - (percentage * count)
            const percentages = Array(count).fill(percentage)
            percentages[0] += remainder
            setFormData(prev => ({
              ...prev,
              nr_variants: count,
              percentages: percentages.join('/')
            }))
          }}
          canEdit={true}
          canAddRemove={true}
        />

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