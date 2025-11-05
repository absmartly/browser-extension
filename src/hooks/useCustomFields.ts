import { useState, useEffect, useCallback } from 'react'
import { BackgroundAPIClient } from '~src/lib/background-api-client'
import { debugLog, debugError } from '~src/utils/debug'
import type { ExperimentCustomSectionField } from '~src/types/absmartly'

export function useCustomFields() {
  const [customFields, setCustomFields] = useState<ExperimentCustomSectionField[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const client = new BackgroundAPIClient()

  const fetchCustomFields = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      debugLog('[useCustomFields] Fetching custom section fields...')
      const fields = await client.getCustomSectionFields()
      debugLog('[useCustomFields] Fetched custom section fields:', fields)
      setCustomFields(fields)
    } catch (err) {
      debugError('[useCustomFields] Failed to fetch custom fields:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch custom fields')
      setCustomFields([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCustomFields()
  }, [fetchCustomFields])

  return {
    customFields,
    loading,
    error,
    refetch: fetchCustomFields
  }
}
