import React, { useState, useEffect } from 'react'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { debugLog, debugError } from '~src/utils/debug'
import { useABsmartly } from '~src/hooks/useABsmartly'

export interface ExperimentMetadataData {
  percentage_of_traffic: number
  unit_type_id: number | null
  application_ids: number[]
}

interface ExperimentMetadataProps {
  data: ExperimentMetadataData
  onChange: (data: ExperimentMetadataData) => void
  canEdit?: boolean
}

export function ExperimentMetadata({
  data,
  onChange,
  canEdit = true
}: ExperimentMetadataProps) {
  const { getApplications, getUnitTypes } = useABsmartly()
  const [unitTypes, setUnitTypes] = useState<any[]>([])
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Fetch unit types and applications using the hook
        const [fetchedUnitTypes, fetchedApplications] = await Promise.all([
          getUnitTypes(),
          getApplications()
        ])

        setUnitTypes(fetchedUnitTypes || [])
        setApplications(fetchedApplications || [])

        debugLog('📦 Loaded unit types:', fetchedUnitTypes)
        debugLog('📦 Loaded applications:', fetchedApplications)
      } catch (error) {
        debugError('Failed to fetch metadata:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [getApplications, getUnitTypes])
  const handleTrafficChange = (value: number) => {
    onChange({
      ...data,
      percentage_of_traffic: value
    })
  }

  const handleUnitTypeChange = (unitTypeId: number | null) => {
    onChange({
      ...data,
      unit_type_id: unitTypeId
    })
  }

  const handleApplicationChange = (applicationIds: number[]) => {
    onChange({
      ...data,
      application_ids: applicationIds
    })
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-gray-500">Loading metadata...</div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Traffic Percentage
        </label>
        <Input
          type="number"
          min="0"
          max="100"
          value={data.percentage_of_traffic}
          onChange={(e) => handleTrafficChange(parseInt(e.target.value) || 0)}
          disabled={!canEdit}
        />
      </div>

      <Select
        label="Unit Type"
        value={data.unit_type_id || ''}
        onChange={(e) => handleUnitTypeChange(e.target.value ? parseInt(e.target.value) : null)}
        placeholder="Select a unit type"
        required
        disabled={!canEdit}
      >
        {unitTypes.map(ut => (
          <option key={ut.unit_type_id || ut.id} value={ut.unit_type_id || ut.id}>
            {ut.name || ut.display_name || `Unit Type ${ut.unit_type_id || ut.id}`}
          </option>
        ))}
      </Select>

      <Select
        label="Applications"
        value={data.application_ids[0] || ''}
        onChange={(e) => handleApplicationChange(e.target.value ? [parseInt(e.target.value)] : [])}
        placeholder="Select an application"
        disabled={!canEdit}
      >
        {applications.map(app => (
          <option key={app.application_id || app.id} value={app.application_id || app.id}>
            {app.name || app.display_name || `Application ${app.application_id || app.id}`}
          </option>
        ))}
      </Select>
    </div>
  )
}
