import { useState, useMemo } from 'react'
import { debugError } from '~src/utils/debug'
import type { Experiment } from '~src/types/absmartly'
import type { DOMChange } from '~src/types/dom-changes'

export interface VariantData {
  name: string
  variables: Record<string, any>
  dom_changes: DOMChange[]
}

interface UseExperimentVariantsOptions {
  experiment?: Experiment | null
  domFieldName?: string
  defaultVariants?: VariantData[]
}

export function useExperimentVariants({
  experiment,
  domFieldName = '__dom_changes',
  defaultVariants = [
    { name: 'Control', variables: {}, dom_changes: [] },
    { name: 'Variant 1', variables: {}, dom_changes: [] }
  ]
}: UseExperimentVariantsOptions = {}) {

  const initialVariants = useMemo<VariantData[]>(() => {
    if (experiment?.variants) {
      return experiment.variants.map(v => {
        let dom_changes: DOMChange[] = []
        let variables: Record<string, any> = {}

        try {
          const config = JSON.parse(v.config || '{}')

          if (config[domFieldName] && Array.isArray(config[domFieldName])) {
            dom_changes = config[domFieldName]
            const tempConfig = { ...config }
            delete tempConfig[domFieldName]
            variables = tempConfig
          } else {
            variables = config
          }
        } catch (e) {
          debugError('Failed to parse variant config:', e)
        }

        return {
          name: v.name || `Variant ${v.variant}`,
          variables,
          dom_changes
        }
      })
    }
    return defaultVariants
  }, [experiment, domFieldName, defaultVariants])

  const [currentVariants, setCurrentVariants] = useState<VariantData[]>(initialVariants)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const handleVariantsChange = (variants: VariantData[], hasChanges: boolean) => {
    setCurrentVariants(variants)
    setHasUnsavedChanges(hasChanges)
  }

  return {
    initialVariants,
    currentVariants,
    setCurrentVariants,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    handleVariantsChange
  }
}
