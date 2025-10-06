/**
 * Utility functions for experiment state display and mapping
 */

import type { BadgeVariant } from '~src/components/ui/Badge'

/**
 * Get the display label for an experiment state
 * Maps internal state values to user-friendly display names
 *
 * @example
 * getExperimentStateLabel('created') // Returns 'Draft'
 * getExperimentStateLabel('running') // Returns 'Running'
 */
export function getExperimentStateLabel(state: string): string {
  switch (state) {
    case 'running':
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
      return state
  }
}

/**
 * Get the Badge variant for an experiment state
 * Used for consistent badge styling across the application
 *
 * @example
 * getExperimentStateBadgeVariant('running') // Returns 'success'
 * getExperimentStateBadgeVariant('created') // Returns 'default'
 */
export function getExperimentStateBadgeVariant(state: string): BadgeVariant {
  switch (state) {
    case 'running':
    case 'full_on':
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

/**
 * Get custom CSS classes for experiment state styling in ExperimentList
 * This is for the custom-styled badges in the list view
 *
 * @example
 * getExperimentStateClasses('running') // Returns 'bg-green-700 text-white'
 * getExperimentStateClasses('created') // Returns 'bg-white text-slate-700 border border-slate-700'
 */
export function getExperimentStateClasses(state: string): string {
  switch (state) {
    case 'running':
      return 'bg-green-700 text-white'  // green-700
    case 'full_on':
      return 'bg-green-800 text-white'  // moss-green-800
    case 'stopped':
      return 'bg-yellow-600 text-white'
    case 'scheduled':
      return 'bg-blue-600 text-white'
    case 'archived':
      return 'bg-red-600 text-white'
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
