import type { DOMChange, DOMChangesData, DOMChangesConfig } from '~src/types/dom-changes'

export type VariantConfig = Record<string, unknown>

export function getDOMChangesFromConfig(config: VariantConfig | undefined, domFieldName: string = '__dom_changes'): DOMChangesData {
  if (!config) return []
  const domData = config[domFieldName]
  if (!domData) return []
  if (Array.isArray(domData)) return domData
  return domData as DOMChangesConfig
}

export function setDOMChangesInConfig(config: VariantConfig, domChanges: DOMChangesData, domFieldName: string = '__dom_changes'): VariantConfig {
  const newConfig = { ...config }

  if (Array.isArray(domChanges)) {
    if (domChanges.length > 0) {
      newConfig[domFieldName] = domChanges
    } else {
      delete newConfig[domFieldName]
    }
  } else {
    if (domChanges.changes && domChanges.changes.length > 0) {
      newConfig[domFieldName] = domChanges
    } else {
      delete newConfig[domFieldName]
    }
  }
  return newConfig
}

export function getVariablesForDisplay(config: VariantConfig, domFieldName: string, fieldsToExclude: string[] = ['__inject_html']): VariantConfig {
  const filtered = { ...config }
  const allExclusions = [...fieldsToExclude, domFieldName]
  allExclusions.forEach(field => delete filtered[field])
  return filtered
}

export function getChangesArray(data: DOMChangesData): DOMChange[] {
  return Array.isArray(data) ? data : data.changes
}

export function getChangesConfig(data: DOMChangesData): DOMChangesConfig {
  if (Array.isArray(data)) {
    return { changes: data }
  }
  return data
}
