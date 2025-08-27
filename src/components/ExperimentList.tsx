import React from 'react'
import { Badge } from './ui/Badge'
import type { Experiment } from '~src/types/absmartly'
import { ChevronRightIcon, UserCircleIcon, UsersIcon, ClockIcon, ArrowTopRightOnSquareIcon, StarIcon } from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'

interface ExperimentListProps {
  experiments: Experiment[]
  onExperimentClick: (experiment: Experiment) => void
  loading?: boolean
  favoriteExperiments?: Set<number>
  onToggleFavorite?: (experimentId: number) => void
}

export function ExperimentList({ experiments, onExperimentClick, loading, favoriteExperiments = new Set(), onToggleFavorite }: ExperimentListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div role="status" aria-label="Loading experiments">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    )
  }

  if (experiments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No experiments found
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
      case 'running_not_full_on':
        return 'bg-orange-500 text-white'  // warning color
      case 'full_on':
        return 'bg-green-500 text-white'  // success color
      case 'stopped':
        return 'bg-gray-400 text-white'  // muted color
      case 'scheduled':
        return 'bg-indigo-500 text-white'  // unknown color
      case 'archived':
        return 'bg-slate-200 text-gray-900'
      case 'development':
        return 'bg-white text-cyan-600 border border-cyan-600'
      case 'ready':
        return 'bg-green-800 text-white'  // moss-green-800
      case 'draft':
      case 'created':
        return 'bg-white text-slate-700 border border-slate-700'
      default:
        return 'bg-gray-300 text-gray-700'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'running':
        return 'Running'
      case 'running_not_full_on':
        return 'Running'
      case 'full_on':
        return 'Full On'
      case 'stopped':
        return 'Stopped'
      case 'scheduled':
        return 'Scheduled'
      case 'archived':
        return 'Archived'
      case 'development':
        return 'Development'
      case 'draft':
        return 'Draft'
      case 'created':
        return 'Draft'  // Match ABsmartly UI - "created" state shows as "Draft"
      case 'ready':
        return 'Ready'
      default:
        return status
    }
  }

  const formatDuration = (startedAt?: string, stoppedAt?: string) => {
    if (!startedAt) return null
    
    const start = new Date(startedAt)
    const end = stoppedAt ? new Date(stoppedAt) : new Date()
    const diff = end.getTime() - start.getTime()
    
    const weeks = Math.floor(diff / (1000 * 60 * 60 * 24 * 7))
    const days = Math.floor((diff % (1000 * 60 * 60 * 24 * 7)) / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    const parts = []
    if (weeks > 0) parts.push(`${weeks}w`)
    if (days > 0) parts.push(`${days}d`)
    if (hours > 0 && weeks === 0) parts.push(`${hours}h`)
    if (minutes > 0 && weeks === 0 && days === 0) parts.push(`${minutes}m`)
    
    return parts.length > 0 ? parts.join(', ') : 'Just started'
  }

  const getOwnerAvatar = (experiment: Experiment) => {
    const owner = experiment.owner || experiment.created_by
    if (!owner) return null
    
    // Check if we have avatar data
    if (experiment.owner?.avatar?.base_url) {
      // Get base endpoint from storage or use a default
      const baseUrl = localStorage.getItem('absmartly-endpoint') || ''
      const cleanEndpoint = baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '')
      return `${cleanEndpoint}${experiment.owner.avatar.base_url}/crop/32x32.webp`
    }
    
    return null
  }

  const getOwnerName = (experiment: Experiment) => {
    const owner = experiment.owner || experiment.created_by
    if (!owner) return 'Unknown'
    
    if (owner.first_name || owner.last_name) {
      return `${owner.first_name || ''} ${owner.last_name || ''}`.trim()
    }
    
    return owner.email || 'Unknown'
  }

  return (
    <div className="divide-y divide-gray-200">
      {experiments.map((experiment) => {
        const ownerAvatar = getOwnerAvatar(experiment)
        const ownerName = getOwnerName(experiment)
        const duration = formatDuration(experiment.started_at, experiment.stopped_at)
        const status = experiment.state || experiment.status || 'created'
        
        return (
          <div
            key={experiment.id}
            className="px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between border-b border-gray-100"
          >
            <button
              onClick={() => onExperimentClick(experiment)}
              className="flex items-start gap-3 flex-1 min-w-0 text-left"
            >
              {/* Favorite Star Icon */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  onToggleFavorite?.(experiment.id)
                }}
                className="flex-shrink-0 p-0.5 text-gray-400 hover:text-yellow-500 rounded transition-colors"
                aria-label={favoriteExperiments.has(experiment.id) ? "Remove from favorites" : "Add to favorites"}
              >
                {favoriteExperiments.has(experiment.id) ? (
                  <StarIconSolid className="h-5 w-5 text-yellow-500" />
                ) : (
                  <StarIcon className="h-5 w-5" />
                )}
              </button>
              
              {/* Experiment Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {experiment.display_name || experiment.name}
                    </h3>
                    <p className="text-xs text-gray-500 truncate">
                      {experiment.name}
                    </p>
                  </div>
                  
                  {/* Owner Avatar and Team */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {experiment.team && (
                      <div className="flex items-center gap-1">
                        <UsersIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-xs text-gray-600">{experiment.team}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center" title={ownerName}>
                      {ownerAvatar ? (
                        <img 
                          src={ownerAvatar} 
                          alt={ownerName}
                          className="h-6 w-6 rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            e.currentTarget.nextElementSibling?.classList.remove('hidden')
                          }}
                        />
                      ) : null}
                      <UserCircleIcon 
                        className={`h-6 w-6 text-gray-400 ${ownerAvatar ? 'hidden' : ''}`}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Status and Metrics Row */}
                <div className="mt-2 flex items-center gap-3 flex-wrap">
                  <span className={`inline-flex items-center h-[26px] px-3 text-xs font-medium rounded-full ${getStatusColor(status)}`}>
                    {getStatusLabel(status)}
                  </span>
                  
                  {experiment.type && (
                    <span className="text-xs text-gray-500">
                      {experiment.type === 'group_sequential' ? 'Group sequential' : 'Fixed horizon'}
                    </span>
                  )}
                  
                  {experiment.exposures !== undefined && (
                    <span className="text-xs text-gray-500">
                      {experiment.exposures.toLocaleString()} exposures
                    </span>
                  )}
                  
                  {duration && (
                    <div className="flex items-center gap-1">
                      <ClockIcon className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-500">{duration}</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
            
            {/* Action buttons stacked vertically, aligned to top */}
            <div className="flex flex-col items-center gap-0.5 ml-2 self-start">
              <ChevronRightIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
              
              <div className="relative group">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const endpoint = localStorage.getItem('absmartly-endpoint') || ''
                    const baseUrl = endpoint.replace(/\/+$/, '').replace(/\/v1$/, '')
                    const url = `${baseUrl}/experiments/${experiment.id}`
                    chrome.tabs.create({ url })
                  }}
                  className="p-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  aria-label="Open in ABsmartly"
                >
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                </button>
                
                {/* Tooltip */}
                <div className="absolute right-0 bottom-full mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  Open in ABsmartly
                  <div className="absolute top-full right-2 w-0 h-0 border-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}