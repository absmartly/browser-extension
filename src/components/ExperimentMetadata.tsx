import React, { useState, useEffect } from 'react'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { debugLog, debugError } from '~src/utils/debug'

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
  const [unitTypes, setUnitTypes] = useState<any[]>([])
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Fetch unit types and applications from background script
        const unitTypesResponse = await chrome.runtime.sendMessage({
          type: 'FETCH_UNIT_TYPES'
        })

        const applicationsResponse = await chrome.runtime.sendMessage({
          type: 'FETCH_APPLICATIONS'
        })

        if (unitTypesResponse?.unitTypes) {
          setUnitTypes(unitTypesResponse.unitTypes)
          debugLog('📦 Loaded unit types:', unitTypesResponse.unitTypes)
        }

        if (applicationsResponse?.applications) {
          setApplications(applicationsResponse.applications)
          debugLog('📦 Loaded applications:', applicationsResponse.applications)
        }
      } catch (error) {
        debugError('Failed to fetch metadata:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])
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
