import React from 'react'
import { debugWarn } from '~src/utils/debug'
import type { Experiment } from '~src/types/absmartly'
import type { ExperimentOverrides } from '~src/utils/overrides'
import type { VariantAssignments } from "~src/utils/sdk-bridge"
import { ChevronRightIcon, StarIcon, ClockIcon, ArrowTopRightOnSquareIcon, PencilSquareIcon, BeakerIcon } from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'
import { formatDuration } from '~src/utils/duration'
import { getExperimentStateLabel, getExperimentStateClasses } from '~src/utils/experiment-state'
import { ExperimentAvatarStack } from './ExperimentAvatarStack'
import { VariantOverrideButtons } from './VariantOverrideButtons'

interface ExperimentListItemProps {
  experiment: Experiment
  overrides: ExperimentOverrides
  realVariants: VariantAssignments
  experimentsInContext: string[]
  domFieldName: string
  isFavorite: boolean
  onExperimentClick: (experiment: Experiment) => void
  onToggleFavorite: (experimentId: number) => void
  onOverrideChange: (experimentName: string, variantIndex: number, experiment: Experiment) => void
}

export const ExperimentListItem = React.memo(function ExperimentListItem({
  experiment,
  overrides,
  realVariants,
  experimentsInContext,
  domFieldName,
  isFavorite,
  onExperimentClick,
  onToggleFavorite,
  onOverrideChange
}: ExperimentListItemProps) {
  const getDOMChangesCount = (): number => {
    let totalChanges = 0
    experiment.variants.forEach(variant => {
      try {
        if (!variant.config) return
        const config = typeof variant.config === 'string' ? JSON.parse(variant.config) : variant.config
        if (config[domFieldName] && Array.isArray(config[domFieldName])) {
          totalChanges += config[domFieldName].length
        }
      } catch (error) {
        debugWarn(`[ExperimentListItem] Failed to parse variant config for "${variant.name}":`, error)
      }
    })
    return totalChanges
  }

  const duration = formatDuration(experiment.started_at, experiment.stopped_at)
  const status = experiment.state || experiment.status || 'created'
  const domChangesCount = getDOMChangesCount()

  return (
    <div data-testid="experiment-list-item" className="experiment-item px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between border-b border-gray-100">
      <div
        onClick={() => onExperimentClick(experiment)}
        className="flex items-start gap-3 flex-1 min-w-0 text-left cursor-pointer"
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onToggleFavorite(experiment.id)
          }}
          className="flex-shrink-0 p-0.5 text-gray-400 hover:text-yellow-500 rounded transition-colors"
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          {isFavorite ? (
            <StarIconSolid className="h-5 w-5 text-yellow-500" />
          ) : (
            <StarIcon className="h-5 w-5" />
          )}
        </button>

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

            <div className="flex items-center gap-2 flex-shrink-0">
              <ExperimentAvatarStack experiment={experiment} />
            </div>
          </div>

          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <span className={`inline-flex items-center h-[26px] px-3 text-xs font-medium rounded-full ${getExperimentStateClasses(status)}`}>
              {getExperimentStateLabel(status)}
            </span>

            {domChangesCount > 0 && (
              <div className="relative group">
                <span className="inline-flex items-center h-[26px] px-2 text-xs font-medium rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                  <BeakerIcon className="h-3.5 w-3.5" />
                  <span className="ml-1 font-semibold">{domChangesCount}</span>
                </span>
                <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                  {domChangesCount} DOM {domChangesCount === 1 ? 'change' : 'changes'}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            )}

            <VariantOverrideButtons
              experiment={experiment}
              overrides={overrides}
              realVariants={realVariants}
              experimentsInContext={experimentsInContext}
              onOverrideChange={onOverrideChange}
            />

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

      <div className="flex flex-col items-center gap-0.5 ml-2 self-start">
        <div className="relative group">
          <button
            onClick={() => onExperimentClick(experiment)}
            className="p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            aria-label="View experiment details"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>

          <div className="absolute right-0 bottom-full mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
            View details
            <div className="absolute top-full right-2 w-0 h-0 border-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
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

            <div className="absolute right-0 bottom-full mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
              Open in ABsmartly
              <div className="absolute top-full right-2 w-0 h-0 border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>

          <div className="relative group">
            <button
              onClick={(e) => {
                e.stopPropagation()
                const endpoint = localStorage.getItem('absmartly-endpoint') || ''
                const baseUrl = endpoint.replace(/\/+$/, '').replace(/\/v1$/, '')
                const url = `${baseUrl}/experiments/${experiment.id}/edit`
                chrome.tabs.create({ url })
              }}
              className="p-0.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
              aria-label="Edit in ABsmartly"
            >
              <PencilSquareIcon className="h-4 w-4" />
            </button>

            <div className="absolute right-0 bottom-full mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
              Edit in ABsmartly
              <div className="absolute top-full right-2 w-0 h-0 border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
