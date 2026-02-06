import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import type { Experiment } from '~src/types/absmartly'
import type { DOMChange } from '~src/types/dom-changes'
import type { AIDOMGenerationResult } from '~src/lib/ai-dom-generator'
import { LockClosedIcon, LockOpenIcon } from '@heroicons/react/24/outline'
import { Header } from './Header'
import { VariantList } from './VariantList'
import type { Variant } from './VariantList'
import { ExperimentMetadata } from './ExperimentMetadata'
import { getConfig } from '~src/utils/storage'
import { useExperimentVariants } from '~src/hooks/useExperimentVariants'
import { useExperimentSave } from '~src/hooks/useExperimentSave'
import { ExperimentCodeInjection } from './ExperimentCodeInjection'
import type { ExperimentInjectionCode, URLFilter, DOMChangesData } from '~src/types/absmartly'
import { sendToContent } from '~src/lib/messaging'

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
  onNavigateToAI?: (
    variantName: string,
    onGenerate: (prompt: string, images?: string[]) => Promise<AIDOMGenerationResult>,
    currentChanges: DOMChange[],
    onRestoreChanges: (changes: DOMChange[]) => void,
    onPreviewToggle: (enabled: boolean) => void,
    onPreviewRefresh: () => void,
    onPreviewWithChanges: (enabled: boolean, changes: DOMChange[]) => void
  ) => void
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
  teams = [],
  onNavigateToAI
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
    unit_type_id: experiment?.unit_type?.unit_type_id || experiment?.unit_type_id || null,
    application_ids: experiment?.applications?.map(a => a.application_id) || [],
    owner_ids: experiment?.owners?.map(o => o.user_id || (o as any).id) || [],
    team_ids: experiment?.teams?.map(t => t.team_id || (t as any).id) || [],
    tag_ids: experiment?.experiment_tags?.map(t => t.experiment_tag_id) || []
  })

  // Use hooks
  const { initialVariants, currentVariants, setCurrentVariants, handleVariantsChange } = useExperimentVariants({
    experiment,
    domFieldName
  })
  const { save: saveExperiment } = useExperimentSave({ experiment, domFieldName })

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
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const titleToSnake = (title: string): string => {
    return title
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
  }

  const handleDisplayNameChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      display_name: value,
      ...(namesSynced ? { name: titleToSnake(value) } : {})
    }))
  }

  const handleNameChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      name: value,
      ...(namesSynced ? { display_name: snakeToTitle(value) } : {})
    }))
  }

  // Helper functions for code injection
  const extractInjectionCode = (variant: Variant): ExperimentInjectionCode | undefined => {
    if (!variant || !variant.config) return undefined
    const injectHtml = variant.config.__inject_html
    if (!injectHtml) return undefined
    return typeof injectHtml === 'string' ? JSON.parse(injectHtml) : injectHtml
  }

  const extractDomChangesUrlFilter = (variant: Variant): URLFilter | undefined => {
    if (!variant || !variant.config) return undefined
    const domChanges = variant.config[domFieldName] as DOMChangesData
    if (!domChanges || Array.isArray(domChanges)) return undefined
    return domChanges.urlFilter
  }

  const handleInjectionCodeChange = (code: ExperimentInjectionCode) => {
    const updatedVariants = [...currentVariants]
    if (updatedVariants[0]) {
      updatedVariants[0] = {
        ...updatedVariants[0],
        config: {
          ...updatedVariants[0].config,
          __inject_html: code
        }
      }
      setCurrentVariants(updatedVariants)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    if (!formData.unit_type_id) {
      alert('Please select a unit type')
      return
    }

    await saveExperiment(formData, currentVariants, undefined, onSave)
  }

  const handleCancel = async () => {
    // Cleanup function to stop VE and Preview
    try {
      // Stop Visual Editor
      await sendToContent({
        type: 'STOP_VISUAL_EDITOR'
      })

      // Remove Preview (use experiment name if available)
      if (experiment?.name || formData.name) {
        await sendToContent({
          type: 'ABSMARTLY_PREVIEW',
          action: 'remove',
          experimentName: experiment?.name || formData.name
        })
      }
    } catch (error) {
      console.error('Error cleaning up visual editor and preview:', error)
    }

    onCancel()
  }

  return (
    <div className="p-4">
      <Header
        title={experiment?.id ? 'Edit Experiment' : 'Create New Experiment'}
        onBack={handleCancel}
      />

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Basic Information */}
        <div className="space-y-3">
          {/* Name fields with sync lock */}
          <div className="flex items-start">
            <div className="flex-1 space-y-3" style={{ paddingRight: '24px' }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name
                </label>
                <Input
                  id="experiment-name-input"
                  value={formData.display_name}
                  onChange={(e) => handleDisplayNameChange(e.target.value)}
                  placeholder="My Experiment"
                />
              </div>

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
          initialVariants={currentVariants}
          experimentId={experiment?.id || 0}
          experimentName={formData.name}
          onVariantsChange={(variants, hasChanges) => {
            handleVariantsChange(variants, hasChanges)
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
          domFieldName={domFieldName}
          onNavigateToAI={onNavigateToAI}
        />

        {/* Code Injection Section - Only for control variant */}
        {currentVariants.length > 0 && currentVariants[0] && (
          <ExperimentCodeInjection
            experimentId={experiment?.id || 0}
            variantIndex={0}
            initialCode={extractInjectionCode(currentVariants[0])}
            domChangesUrlFilter={extractDomChangesUrlFilter(currentVariants[0])}
            onChange={handleInjectionCodeChange}
            canEdit={true}
          />
        )}

        {/* Submit Buttons */}
        <div className="pt-4 border-t">
          {!experiment?.id && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                💡 This will create a draft experiment. You'll need to finalize the setup in the ABsmartly console before it can be started.
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              id="create-experiment-button"
              type="submit"
              variant="primary"
              disabled={loading}
            >
              {experiment?.id ? 'Update Experiment' : 'Create Experiment Draft'}
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
        </div>
      </form>
    </div>
  )
}
