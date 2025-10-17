import { useState, useMemo } from 'react'
import { debugError } from '~src/utils/debug'
import type { Experiment } from '~src/types/absmartly'

/**
 * VariantData now stores the FULL config payload as a single object.
 * This includes:
 * - Custom variables (hello: "world", foo: "bar", etc.)
 * - __inject_html: The HTML/JS injection code
 * - __dom_changes: The DOM changes with urlFilter and other metadata
 *
 * The UI will filter out __inject_html and __dom_changes when displaying
 * the Variables section, but they remain in the config for proper storage.
 */
export interface VariantData {
  name: string
  config: Record<string, any>  // Full variables payload including special fields
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
        let config: Record<string, any> = {}

        try {
          config = JSON.parse(v.config || '{}')
        } catch (e) {
          debugError('Failed to parse variant config:', e)
        }

        return {
          name: v.name || `Variant ${v.variant}`,
          config  // Store full config as-is, no splitting
        }
      })
    }
    return defaultVariants
  }, [experiment, domFieldName, defaultVariants])

  const [currentVariants, setCurrentVariants] = useState<VariantData[]>(initialVariants)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const handleVariantsChange = (variants: VariantData[], hasChanges?: boolean) => {
    setCurrentVariants(variants)

    // Only set hasUnsavedChanges if explicitly passed
    // Don't auto-detect - let the caller decide if there are changes
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
