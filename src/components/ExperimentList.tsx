import React from 'react'
import { Badge } from './ui/Badge'
import type { Experiment } from '~src/types/absmartly'
import { ChevronRightIcon, UserCircleIcon, UsersIcon, ClockIcon, BeakerIcon } from '@heroicons/react/24/outline'

interface ExperimentListProps {
  experiments: Experiment[]
  onExperimentClick: (experiment: Experiment) => void
  loading?: boolean
}

export function ExperimentList({ experiments, onExperimentClick, loading }: ExperimentListProps) {
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
        return 'bg-orange-500 text-white'
      case 'full_on':
        return 'bg-green-500 text-white'
      case 'stopped':
        return 'bg-gray-500 text-white'
      case 'scheduled':
        return 'bg-blue-500 text-white'
      case 'archived':
        return 'bg-red-500 text-white'
      case 'development':
        return 'bg-purple-500 text-white'
      case 'draft':
      case 'created':
      case 'ready':
        return 'bg-gray-300 text-gray-700'
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
        return 'Created'
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
          <button
            key={experiment.id}
            onClick={() => onExperimentClick(experiment)}
            className="w-full px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between text-left border-b border-gray-100"
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {/* Experiment Icon */}
              <div className="flex-shrink-0">
                <BeakerIcon className="h-5 w-5 text-gray-400" />
              </div>
              
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
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-md ${getStatusColor(status)}`}>
                    {getStatusLabel(status)}
                  </span>
                  
                  {experiment.type && (
                    <span className="text-xs text-gray-500">
                      {experiment.type === 'group_sequential' ? 'Group sequential' : 'Fixed horizon'}
                    </span>
                  )}
                  
                  {(experiment.percentage_of_traffic !== undefined ? experiment.percentage_of_traffic : experiment.traffic_split) !== undefined && (
                    <span className="text-xs text-gray-500">
                      {experiment.percentage_of_traffic !== undefined ? experiment.percentage_of_traffic : experiment.traffic_split}% traffic
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
            </div>
            
            <ChevronRightIcon className="h-5 w-5 text-gray-400 flex-shrink-0 ml-2" />
          </button>
        )
      })}
    </div>
  )
}