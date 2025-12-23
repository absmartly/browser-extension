import React from 'react'
import type { Experiment, ExperimentUser } from '~src/types/absmartly'
import { getAvatarColor, getInitials, buildAvatarUrl } from '~src/utils/avatar'

interface AvatarData {
  id: string
  user: ExperimentUser | undefined
  avatar?: string
  name: string
  initials: string
  isTeam?: boolean
  color?: string
}

interface ExperimentAvatarStackProps {
  experiment: Experiment
}

export function ExperimentAvatarStack({ experiment }: ExperimentAvatarStackProps) {
  const getAllAvatars = (experiment: Experiment): AvatarData[] => {
    const avatars: AvatarData[] = []

    if (experiment.created_by) {
      const user = experiment.created_by
      const avatar = buildAvatarUrl(user.avatar)
      const name = user.first_name || user.last_name ?
        `${user.first_name || ''} ${user.last_name || ''}`.trim() :
        user.email || 'Unknown'
      const initials = getInitials(name)

      avatars.push({
        id: `user-${user.user_id || user.id || user.email}`,
        user,
        avatar: avatar || undefined,
        name,
        initials
      })
    }

    if ((experiment as any).owners && Array.isArray((experiment as any).owners)) {
      (experiment as any).owners.forEach((ownerWrapper: any) => {
        const owner = ownerWrapper.user || ownerWrapper

        if (!owner) return

        if (experiment.created_by &&
            ((owner.id && owner.id === experiment.created_by.id) ||
             (owner.user_id && owner.user_id === experiment.created_by.user_id))) {
          return
        }

        const avatar = buildAvatarUrl(owner.avatar)
        const name = owner.first_name || owner.last_name ?
          `${owner.first_name || ''} ${owner.last_name || ''}`.trim() :
          owner.email || 'Unknown'
        const initials = getInitials(name)

        avatars.push({
          id: `owner-${owner.user_id || owner.id || owner.email}`,
          user: owner,
          avatar: avatar || undefined,
          name,
          initials
        })
      })
    }

    if (experiment.teams && Array.isArray(experiment.teams)) {
      experiment.teams.forEach((teamWrapper: any) => {
        const team = teamWrapper.team || teamWrapper
        const name = team.name || `Team ${team.team_id || team.id}`
        const initials = team.initials || getInitials(name)
        const color = team.color

        const avatar = buildAvatarUrl(team.avatar)

        avatars.push({
          id: `team-${team.team_id || team.id || team.name}`,
          user: undefined,
          avatar: avatar || undefined,
          name,
          initials,
          isTeam: true,
          color
        })
      })
    }

    return avatars
  }

  const allAvatars = getAllAvatars(experiment)

  return (
    <div className="flex items-center">
      {allAvatars.slice(0, 3).map((avatarData, idx) => (
        <div
          key={avatarData.id}
          className={`relative group ${idx > 0 ? '-ml-2' : ''}`}
          style={{ zIndex: allAvatars.length - idx }}>
          <div className="relative">
            {avatarData.avatar ? (
              <>
                <img
                  src={avatarData.avatar}
                  alt={avatarData.name}
                  className="h-7 w-7 rounded-full object-cover border-2 border-white shadow-sm"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    const fallbackElement = e.currentTarget.nextElementSibling as HTMLElement
                    if (fallbackElement) {
                      fallbackElement.style.display = 'flex'
                    }
                  }}
                />
                <div
                  className="h-7 w-7 rounded-full items-center justify-center text-[11px] text-white font-semibold border-2 border-white shadow-sm"
                  style={{ display: 'none', backgroundColor: avatarData.color || getAvatarColor(avatarData.name) }}
                >
                  {avatarData.initials}
                </div>
              </>
            ) : (
              <div
                className="flex h-7 w-7 rounded-full items-center justify-center text-[11px] text-white font-semibold border-2 border-white shadow-sm"
                style={{ backgroundColor: avatarData.color || getAvatarColor(avatarData.name) }}
              >
                {avatarData.initials}
              </div>
            )}
          </div>

          <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
            {avatarData.name}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      ))}
      {allAvatars.length > 3 && (
        <div className="relative group -ml-2" style={{ zIndex: 0 }}>
          <div className="flex h-7 w-7 rounded-full bg-gray-200 items-center justify-center text-[11px] text-gray-600 font-semibold border-2 border-white shadow-sm">
            +{allAvatars.length - 3}
          </div>
          <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
            {allAvatars.slice(3).map(a => a.name).join(', ')}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      )}
    </div>
  )
}
