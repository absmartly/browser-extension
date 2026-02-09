import { useState, useMemo } from 'react'
import { debugError } from '~src/utils/debug'
import type { Experiment } from '~src/types/absmartly'
import { safeParseVariantConfig } from '~src/lib/validation-schemas'

export interface VariantConfig {
  [key: string]: unknown
}

export interface VariantData {
  name: string
  config: VariantConfig
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
    { name: 'Control', config: {} },
    { name: 'Variant 1', config: {} }
  ]
}: UseExperimentVariantsOptions = {}) {

  const initialVariants = useMemo<VariantData[]>(() => {
    if (experiment?.variants) {
      return experiment.variants.map(v => {
        let config: VariantConfig = {}

        const configStr = v.config || '{}'
        const parseResult = safeParseVariantConfig(configStr)

        if (parseResult.success) {
          config = parseResult.data as VariantConfig
        } else {
          debugError('Failed to parse variant config:', (parseResult as { success: false; error: string }).error)
          config = {}
        }

        return {
          name: v.name || `Variant ${v.variant}`,
          config
        }
      })
    }
    return defaultVariants
  }, [experiment, domFieldName, defaultVariants])

  const [currentVariants, setCurrentVariants] = useState<VariantData[]>(initialVariants)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const handleVariantsChange = (variants: VariantData[], hasChanges?: boolean) => {
    setCurrentVariants(variants)

    if (hasChanges !== undefined) {
      setHasUnsavedChanges(hasChanges)
    }
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
