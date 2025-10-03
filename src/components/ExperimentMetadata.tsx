import React, { useState, useEffect } from 'react'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { MultiSelect, type MultiSelectOption } from './ui/MultiSelect'
import { debugLog, debugError } from '~src/utils/debug'
import { useABsmartly } from '~src/hooks/useABsmartly'

export interface ExperimentMetadataData {
  percentage_of_traffic: number
  unit_type_id: number | null
  application_ids: number[]
  owner_ids: number[]
  team_ids: number[]
  tag_ids: number[]
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
  const { getApplications, getUnitTypes, getOwners, getTeams, getExperimentTags } = useABsmartly()
  const [unitTypes, setUnitTypes] = useState<any[]>([])
  const [applications, setApplications] = useState<any[]>([])
  const [owners, setOwners] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [tags, setTags] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        const [fetchedUnitTypes, fetchedApplications, fetchedOwners, fetchedTeams, fetchedTags] = await Promise.all([
          getUnitTypes(),
          getApplications(),
          getOwners(),
          getTeams(),
          getExperimentTags()
        ])

        setUnitTypes(fetchedUnitTypes || [])
        setApplications(fetchedApplications || [])
        setOwners(fetchedOwners || [])
        setTeams(fetchedTeams || [])
        setTags(fetchedTags || [])

        debugLog('📦 Loaded unit types:', fetchedUnitTypes)
        debugLog('📦 Loaded applications:', fetchedApplications)
        debugLog('📦 Loaded owners:', fetchedOwners)
        debugLog('📦 Loaded teams:', fetchedTeams)
        debugLog('📦 Loaded tags:', fetchedTags)
      } catch (error) {
        debugError('Failed to fetch metadata:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [getApplications, getUnitTypes, getOwners, getTeams, getExperimentTags])
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

  const handleOwnerChange = (ownerIds: number[]) => {
    onChange({
      ...data,
      owner_ids: ownerIds
    })
  }

  const handleTeamChange = (teamIds: number[]) => {
    onChange({
      ...data,
      team_ids: teamIds
    })
  }

  const handleTagChange = (tagIds: number[]) => {
    onChange({
      ...data,
      tag_ids: tagIds
    })
  }

  const applicationOptions: MultiSelectOption[] = applications.map(app => ({
    id: app.application_id || app.id,
    name: app.name || app.display_name || `Application ${app.application_id || app.id}`,
    display_name: app.display_name || app.name
  }))

  const ownerOptions: MultiSelectOption[] = owners.map(owner => ({
    id: owner.user_id || owner.id,
    name: `${owner.first_name || ''} ${owner.last_name || ''}`.trim() || owner.email || `User ${owner.user_id || owner.id}`,
    display_name: `${owner.first_name || ''} ${owner.last_name || ''}`.trim() || owner.email,
    type: 'user' as const
  }))

  const teamOptions: MultiSelectOption[] = teams.map(team => ({
    id: team.team_id || team.id,
    name: team.display_name || team.name || `Team ${team.team_id || team.id}`,
    display_name: team.display_name || team.name,
    type: 'team' as const
  }))

  const tagOptions: MultiSelectOption[] = tags.map(tag => ({
    id: tag.experiment_tag_id || tag.id || (tag.experiment_tag?.id),
    name: tag.tag || tag.name || tag.experiment_tag?.tag || tag.experiment_tag?.name || `Tag ${tag.experiment_tag_id || tag.id}`,
    display_name: tag.tag || tag.name || tag.experiment_tag?.tag || tag.experiment_tag?.name
  }))

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
        placeholder={loading ? "Loading..." : "Select a unit type"}
        required
        disabled={!canEdit || loading}
      >
        {unitTypes.map(ut => (
          <option key={ut.unit_type_id || ut.id} value={ut.unit_type_id || ut.id}>
            {ut.name || ut.display_name || `Unit Type ${ut.unit_type_id || ut.id}`}
          </option>
        ))}
      </Select>

      <MultiSelect
        label="Applications"
        options={applicationOptions}
        selectedIds={data.application_ids}
        onChange={handleApplicationChange}
        placeholder="Select applications"
        loading={loading}
        disabled={!canEdit || loading}
      />

      <MultiSelect
        label="Owners"
        options={[...ownerOptions, ...teamOptions]}
        selectedIds={[...data.owner_ids, ...data.team_ids]}
        onChange={(selectedIds) => {
          const ownerIds = selectedIds.filter(id => ownerOptions.some(o => o.id === id))
          const teamIds = selectedIds.filter(id => teamOptions.some(t => t.id === id))
          onChange({
            ...data,
            owner_ids: ownerIds,
            team_ids: teamIds
          })
        }}
        placeholder="Select owners and teams"
        loading={loading}
        disabled={!canEdit || loading}
      />

      <MultiSelect
        label="Tags (optional)"
        options={tagOptions}
        selectedIds={data.tag_ids}
        onChange={handleTagChange}
        placeholder="Type tags"
        loading={loading}
        disabled={!canEdit || loading}
      />
    </div>
  )
}
