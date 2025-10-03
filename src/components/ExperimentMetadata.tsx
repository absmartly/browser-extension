import React, { useMemo, useCallback } from 'react'
import { Input } from './ui/Input'
import { Select } from './ui/Select'
import { MultiSelect, type MultiSelectOption } from './ui/MultiSelect'

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
  applications?: any[]
  unitTypes?: any[]
  owners?: any[]
  teams?: any[]
  tags?: any[]
}

// Separate memoized component for Owners field - only re-renders when owners/teams/IDs change
const OwnersField = React.memo(function OwnersField({
  ownerIds,
  teamIds,
  owners,
  teams,
  loading,
  canEdit,
  onChange
}: {
  ownerIds: number[]
  teamIds: number[]
  owners: any[]
  teams: any[]
  loading: boolean
  canEdit: boolean
  onChange: (ownerIds: number[], teamIds: number[]) => void
}) {
  const ownerOptions = useMemo(() => owners.map(owner => ({
    id: `user-${owner.user_id || owner.id}`,
    name: `${owner.first_name || ''} ${owner.last_name || ''}`.trim() || owner.email || `User ${owner.user_id || owner.id}`,
    display_name: `${owner.first_name || ''} ${owner.last_name || ''}`.trim() || owner.email,
    type: 'user' as const
  })), [owners])

  const teamOptions = useMemo(() => teams.map(team => ({
    id: `team-${team.team_id || team.id}`,
    name: team.display_name || team.name || `Team ${team.team_id || team.id}`,
    display_name: team.display_name || team.name,
    type: 'team' as const
  })), [teams])

  const ownersOptions = useMemo(() => [...teamOptions, ...ownerOptions], [ownerOptions, teamOptions])

  const ownersSelectedIds = useMemo(
    () => [
      ...(teamIds || []).map(id => `team-${id}`),
      ...(ownerIds || []).map(id => `user-${id}`)
    ],
    [ownerIds, teamIds]
  )

  const handleOwnersChange = useCallback((selectedIds: (number | string)[]) => {
    const newOwnerIds = selectedIds
      .filter(id => typeof id === 'string' && id.startsWith('user-'))
      .map(id => parseInt((id as string).replace('user-', '')))
    const newTeamIds = selectedIds
      .filter(id => typeof id === 'string' && id.startsWith('team-'))
      .map(id => parseInt((id as string).replace('team-', '')))
    onChange(newOwnerIds, newTeamIds)
  }, [onChange])

  return (
    <MultiSelect
      label="Owners"
      options={ownersOptions}
      selectedIds={ownersSelectedIds}
      onChange={handleOwnersChange}
      placeholder="Select owners and teams"
      loading={loading}
      disabled={!canEdit || loading}
    />
  )
})

export const ExperimentMetadata = React.memo(function ExperimentMetadata({
  data,
  onChange,
  canEdit = true,
  applications = [],
  unitTypes = [],
  owners = [],
  teams = [],
  tags = []
}: ExperimentMetadataProps) {
  const loading = applications.length === 0 || unitTypes.length === 0
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

  const handleTagChange = (tagIds: number[]) => {
    onChange({
      ...data,
      tag_ids: tagIds
    })
  }

  const applicationOptions = useMemo(() => applications.map(app => ({
    id: app.application_id || app.id,
    name: app.name || app.display_name || `Application ${app.application_id || app.id}`,
    display_name: app.display_name || app.name
  })), [applications])

  const tagOptions = useMemo(() => tags.map(tag => ({
    id: tag.experiment_tag_id || tag.id || (tag.experiment_tag?.id),
    name: tag.tag || tag.name || tag.experiment_tag?.tag || tag.experiment_tag?.name || `Tag ${tag.experiment_tag_id || tag.id}`,
    display_name: tag.tag || tag.name || tag.experiment_tag?.tag || tag.experiment_tag?.name
  })), [tags])

  // Handler for owners field - updates both owner_ids and team_ids
  const handleOwnersChange = useCallback((ownerIds: number[], teamIds: number[]) => {
    onChange({
      ...data,
      owner_ids: ownerIds,
      team_ids: teamIds
    })
  }, [data, onChange])

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

      <OwnersField
        ownerIds={data.owner_ids}
        teamIds={data.team_ids}
        owners={owners}
        teams={teams}
        loading={loading}
        canEdit={canEdit}
        onChange={handleOwnersChange}
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
})
