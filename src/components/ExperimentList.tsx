import React from 'react'
import { Badge } from './ui/Badge'
import type { Experiment } from '~src/types/absmartly'
import { ChevronRightIcon } from '@heroicons/react/24/outline'

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

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'running':
      case 'running_not_full_on':
        return 'success'
      case 'draft':
      case 'created':
      case 'ready':
        return 'default'
      case 'stopped':
      case 'scheduled':
        return 'warning'
      case 'archived':
        return 'danger'
      case 'development':
        return 'info'
      default:
        return 'default'
    }
  }

  return (
    <div className="divide-y divide-gray-200">
      {experiments.map((experiment) => (
        <button
          key={experiment.id}
          onClick={() => onExperimentClick(experiment)}
          className="w-full px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between text-left"
        >
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {experiment.name}
            </h3>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={getStatusVariant(experiment.state || experiment.status || 'created')}>
                {experiment.state || experiment.status || 'created'}
              </Badge>
              {(experiment.percentage_of_traffic !== undefined ? experiment.percentage_of_traffic : experiment.traffic_split) && (
                <span className="text-xs text-gray-500">
                  {experiment.percentage_of_traffic !== undefined ? experiment.percentage_of_traffic : experiment.traffic_split}% traffic
                </span>
              )}
            </div>
          </div>
          <ChevronRightIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
        </button>
      ))}
    </div>
  )
}