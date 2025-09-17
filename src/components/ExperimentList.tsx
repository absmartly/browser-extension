import React, { useState, useEffect } from 'react'
import { debugLog, debugError, debugWarn } from '~src/utils/debug'
import { Badge } from './ui/Badge'
import type { Experiment } from '~src/types/absmartly'
import { ChevronRightIcon, UserCircleIcon, UsersIcon, ClockIcon, ArrowTopRightOnSquareIcon, StarIcon, PencilSquareIcon, BeakerIcon } from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'
import {
  type ExperimentOverrides,
  type OverrideValue,
  ENV_TYPE,
  initializeOverrides,
  saveOverrides,
  reloadPageWithOverrides,
  saveDevelopmentEnvironment,
  getDevelopmentEnvironment
} from '~src/utils/overrides'
import { getCurrentVariantAssignments, type VariantAssignments, type SDKVariantData } from '~src/utils/sdk-bridge'
import { getConfig } from '~src/utils/storage'

interface ExperimentListProps {
  experiments: Experiment[]
  onExperimentClick: (experiment: Experiment) => void
  loading?: boolean
  favoriteExperiments?: Set<number>
  onToggleFavorite?: (experimentId: number) => void
}

export function ExperimentList({ experiments, onExperimentClick, loading, favoriteExperiments = new Set(), onToggleFavorite }: ExperimentListProps) {
  const [overrides, setOverrides] = useState<ExperimentOverrides>({})
  const [showReloadBanner, setShowReloadBanner] = useState(false)
  const [realVariants, setRealVariants] = useState<VariantAssignments>({})
  const [experimentsInContext, setExperimentsInContext] = useState<string[]>([])
  const [developmentEnv, setDevelopmentEnv] = useState<string | null>(null)
  const [domFieldName, setDomFieldName] = useState<string>('__dom_changes')

  // Initialize overrides and fetch environments on mount
  useEffect(() => {
    const init = async () => {
      // Get config for field name
      const config = await getConfig()
      const fieldName = config?.domChangesFieldName || '__dom_changes'
      setDomFieldName(fieldName)

      // Load overrides
      const loadedOverrides = await initializeOverrides()
      setOverrides(loadedOverrides)

      // Check if we have a stored dev environment, if not fetch and store it
      let devEnv = await getDevelopmentEnvironment()
      if (!devEnv) {
        try {
          // Fetch environments from API
          const endpoint = localStorage.getItem('absmartly-endpoint')
          const apiKey = localStorage.getItem('absmartly-apikey')
          const authMethod = localStorage.getItem('absmartly-auth-method') || 'apikey'

          if (endpoint) {
            const { ABsmartlyClient } = await import('~src/lib/absmartly-client')
            const client = new ABsmartlyClient({
              apiEndpoint: endpoint,
              apiKey: apiKey || '',
              authMethod: authMethod as 'apikey' | 'jwt'
            })

            const environments = await client.getEnvironments()
            debugLog('Fetched environments:', environments)

            // Find first development environment
            const firstDevEnv = environments.find(env => env.type === 'development')
            if (firstDevEnv) {
              devEnv = firstDevEnv.name
              await saveDevelopmentEnvironment(firstDevEnv.name)
              debugLog('Saved development environment:', firstDevEnv.name)
            }
          }
        } catch (error) {
          debugWarn('Failed to fetch environments:', error)
        }
      }
      setDevelopmentEnv(devEnv)
    }
    init()
  }, [])
  
  // Get real variant assignments from SDK
  useEffect(() => {
    if (experiments.length > 0) {
      const experimentNames = experiments.map(exp => exp.name)
      getCurrentVariantAssignments(experimentNames).then(data => {
        setRealVariants(data.assignments)
        setExperimentsInContext(data.experimentsInContext)
        debugLog('SDK data:', data)
        
        // Check if any existing overrides differ from real variants
        const hasActiveOverrides = Object.entries(overrides).some(([expName, overrideValue]) => {
          const variant = typeof overrideValue === 'number' ? overrideValue : overrideValue.variant
          return data.assignments[expName] !== variant
        })
        setShowReloadBanner(hasActiveOverrides)
      })
    }
  }, [experiments, overrides])

  const handleOverrideChange = async (experimentName: string, variantIndex: number, experiment: Experiment) => {
    const newOverrides = { ...overrides }
    if (variantIndex === -1) {
      delete newOverrides[experimentName]
    } else {
      // Determine environment type based on experiment status
      const status = experiment.state || experiment.status || 'created'
      let overrideValue: number | OverrideValue = variantIndex
      console.log('[ABsmartly] handleOverrideChange - experiment:', experimentName, 'status:', status, 'variantIndex:', variantIndex)

      if (status === 'development') {
        // Development experiments need env flag and ID
        overrideValue = {
          variant: variantIndex,
          env: ENV_TYPE.DEVELOPMENT,
          id: experiment.id
        }
        console.log('[ABsmartly] Setting development override:', overrideValue)
      } else if (status !== 'running' && status !== 'running_not_full_on' && status !== 'full_on') {
        // Non-running experiments (draft, stopped, etc) need API fetch flag and ID
        overrideValue = {
          variant: variantIndex,
          env: ENV_TYPE.API_FETCH,
          id: experiment.id
        }
        console.log('[ABsmartly] Setting non-running override:', overrideValue)
      }
      // Running experiments just use the variant number (no env or ID needed)

      newOverrides[experimentName] = overrideValue
    }
    console.log('[ABsmartly] New overrides to save:', newOverrides)
    setOverrides(newOverrides)

    // Save to storage and sync to cookie
    await saveOverrides(newOverrides)

    // Check if any overrides differ from real variants
    const hasActiveOverrides = Object.entries(newOverrides).some(([expName, overrideValue]) => {
      const variant = typeof overrideValue === 'number' ? overrideValue : overrideValue.variant
      return realVariants[expName] !== variant
    })

    // Only show reload banner if there are active overrides that differ from real variants
    setShowReloadBanner(hasActiveOverrides)
  }

  const handleReload = async () => {
    await reloadPageWithOverrides()
    setShowReloadBanner(false)
  }

  const getDOMChangesCount = (experiment: Experiment): number => {
    let totalChanges = 0
    experiment.variants.forEach(variant => {
      try {
        if (!variant.config) return
        const config = typeof variant.config === 'string' ? JSON.parse(variant.config) : variant.config
        if (config[domFieldName] && Array.isArray(config[domFieldName])) {
          totalChanges += config[domFieldName].length
        }
      } catch {
        // ignore
      }
    })
    return totalChanges
  }

  const getVariantLabel = (index: number): string => {
    // Convert index to letter: 0->A, 1->B, 2->C, etc.
    return String.fromCharCode(65 + index) // 65 is 'A' in ASCII
  }
  
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

  const getAllAvatars = (experiment: Experiment) => {
    const avatars: Array<{
      user: ExperimentUser | undefined
      avatar?: string
      name: string
      initials: string
    }> = []
    
    // Add created_by as the first avatar
    if (experiment.created_by) {
      const user = experiment.created_by
      const avatar = user.avatar?.base_url ? 
        `${localStorage.getItem('absmartly-endpoint')?.replace(/\/+$/, '').replace(/\/v1$/, '')}${user.avatar.base_url}/crop/32x32.webp` : 
        null
      const name = user.first_name || user.last_name ? 
        `${user.first_name || ''} ${user.last_name || ''}`.trim() : 
        user.email || 'Unknown'
      const initials = user.first_name || user.last_name ?
        ((user.first_name?.[0] || '') + (user.last_name?.[0] || '')).toUpperCase() || user.email?.[0]?.toUpperCase() || '?' :
        user.email?.[0]?.toUpperCase() || '?'
      
      avatars.push({
        user,
        avatar: avatar || undefined,
        name,
        initials
      })
    }
    
    // Add owners if they exist - handle nested structure with owner.user
    if ((experiment as any).owners && Array.isArray((experiment as any).owners)) {
      (experiment as any).owners.forEach((ownerWrapper: any) => {
        // Extract the actual user from the wrapper object
        const owner = ownerWrapper.user || ownerWrapper
        
        // Skip if no user data
        if (!owner) return
        
        // Skip if this owner is the same as created_by
        if (experiment.created_by && 
            ((owner.id && owner.id === experiment.created_by.id) || 
             (owner.user_id && owner.user_id === experiment.created_by.user_id))) {
          return
        }
        
        const avatar = owner.avatar?.base_url ? 
          `${localStorage.getItem('absmartly-endpoint')?.replace(/\/+$/, '').replace(/\/v1$/, '')}${owner.avatar.base_url}/crop/32x32.webp` : 
          null
        const name = owner.first_name || owner.last_name ? 
          `${owner.first_name || ''} ${owner.last_name || ''}`.trim() : 
          owner.email || 'Unknown'
        const initials = owner.first_name || owner.last_name ?
          ((owner.first_name?.[0] || '') + (owner.last_name?.[0] || '')).toUpperCase() || owner.email?.[0]?.toUpperCase() || '?' :
          owner.email?.[0]?.toUpperCase() || '?'
        
        avatars.push({
          user: owner,
          avatar: avatar || undefined,
          name,
          initials
        })
      })
    }
    
    return avatars
  }
  const getOwnerAvatar = (experiment: Experiment) => {
    const avatars = getAllAvatars(experiment)
    return avatars[0]?.avatar || null
  }

  const getOwnerName = (experiment: Experiment) => {
    const avatars = getAllAvatars(experiment)
    return avatars[0]?.name || 'Unknown'
  }

  const getOwnerInitials = (experiment: Experiment) => {
    const avatars = getAllAvatars(experiment)
    return avatars[0]?.initials || '?'
  }

  return (
    <div>
      {/* Reload Banner */}
      {showReloadBanner && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-blue-800">
              Experiment overrides changed. Reload to apply changes.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReload}
              className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            >
              Reload Now
            </button>
            <button
              onClick={() => setShowReloadBanner(false)}
              className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              Later
            </button>
          </div>
        </div>
      )}
      
      <div className="divide-y divide-gray-200">
      {experiments.map((experiment) => {
        // Debug: Check owners structure
        if (experiment.name === 'larger_product_image_size') {
          debugLog('Experiment with owners:', experiment.name, 'Owners:', (experiment as any).owners, 'Created by:', experiment.created_by)
        }
        const allAvatars = getAllAvatars(experiment)
        const duration = formatDuration(experiment.started_at, experiment.stopped_at)
        const status = experiment.state || experiment.status || 'created'
        
        return (
          <div
            key={experiment.id}
            className="px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between border-b border-gray-100"
          >
            <div
              onClick={() => onExperimentClick(experiment)}
              className="flex items-start gap-3 flex-1 min-w-0 text-left cursor-pointer"
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
                    
                    {/* Stacked Avatars with Tooltips */}
                    <div className="flex items-center">
                      {allAvatars.slice(0, 3).map((avatarData, idx) => (
                        <div 
                          key={idx} 
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
                                  className="hidden h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 items-center justify-center text-[11px] text-white font-semibold border-2 border-white shadow-sm"
                                  style={{ display: 'none' }}
                                >
                                  {avatarData.initials}
                                </div>
                              </>
                            ) : (
                              <div className="flex h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 items-center justify-center text-[11px] text-white font-semibold border-2 border-white shadow-sm">
                                {avatarData.initials}
                              </div>
                            )}
                          </div>
                          
                          {/* Tooltip */}
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
                          {/* Tooltip showing remaining names */}
                          <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                            {allAvatars.slice(3).map(a => a.name).join(', ')}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Status, Metrics and Override Row */}
                <div className="mt-2 flex items-center gap-3 flex-wrap">
                  <span className={`inline-flex items-center h-[26px] px-3 text-xs font-medium rounded-full ${getStatusColor(status)}`}>
                    {getStatusLabel(status)}
                  </span>
                  
                  {(() => {
                    const domChangesCount = getDOMChangesCount(experiment)
                    if (domChangesCount > 0) {
                      return (
                        <div className="relative group">
                          <span className="inline-flex items-center h-[26px] px-2 text-xs font-medium rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                            <BeakerIcon className="h-3.5 w-3.5" />
                            <span className="ml-1 font-semibold">{domChangesCount}</span>
                          </span>
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                            {domChangesCount} DOM {domChangesCount === 1 ? 'change' : 'changes'}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}
                  
                  {/* Variant Display with Override Controls */}
                  {experiment.variants.length > 0 && (
                    <>
                      <div className="inline-flex items-center gap-1.5">
                        <div className="inline-flex rounded-md shadow-sm" role="group">
                          {experiment.variants.map((variant, idx) => {
                            const overrideValue = overrides[experiment.name]
                            const overriddenVariant = typeof overrideValue === 'number' ? overrideValue : overrideValue?.variant
                            const isOverridden = overriddenVariant === idx
                            const isRealVariant = realVariants[experiment.name] === idx
                            const hasRealVariant = realVariants[experiment.name] !== undefined
                            const experimentInContext = experimentsInContext.includes(experiment.name)
                            const label = getVariantLabel(idx)
                            const variantName = variant.name || `Variant ${label}`
                            
                            // Determine button state and styling
                            let buttonClass = 'px-2.5 py-1 text-xs font-medium transition-colors '
                            if (idx === 0) buttonClass += 'rounded-l-md '
                            if (idx === experiment.variants.length - 1) buttonClass += 'rounded-r-md '
                            if (idx > 0) buttonClass += 'border-l '
                            
                            // Color based on state
                            if (isOverridden) {
                              // Override is active - blue
                              buttonClass += 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 '
                            } else if (isRealVariant && !overrides[experiment.name] && hasRealVariant && experimentInContext) {
                              // Real variant, no override, AND experiment exists in SDK context - green
                              buttonClass += 'bg-green-600 text-white border-green-600 hover:bg-green-700 '
                            } else if (isRealVariant && !overrides[experiment.name] && hasRealVariant && !experimentInContext) {
                              // Real variant but experiment not in SDK context - gray
                              buttonClass += 'bg-gray-400 text-white border-gray-400 hover:bg-gray-500 '
                            } else if (isRealVariant && overrides[experiment.name] !== undefined) {
                              // Real variant but overridden to something else - gray/muted
                              buttonClass += 'bg-gray-200 text-gray-500 border-gray-300 hover:bg-gray-300 '
                            } else {
                              // Other variants or no SDK data - default
                              buttonClass += 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 '
                            }
                            
                            buttonClass += 'border-t border-b '
                            if (idx === 0) buttonClass += 'border-l '
                            if (idx === experiment.variants.length - 1) buttonClass += 'border-r '
                            
                            return (
                              <div key={variant.id || idx} className="relative group">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    // If clicking the real variant while override exists, remove override
                                    // If clicking any other variant, set override
                                    if (isRealVariant && overrides[experiment.name] !== undefined) {
                                      handleOverrideChange(experiment.name, -1, experiment)
                                    } else if (!isOverridden) {
                                      handleOverrideChange(experiment.name, idx, experiment)
                                    } else {
                                      // Clicking active override removes it
                                      handleOverrideChange(experiment.name, -1, experiment)
                                    }
                                  }}
                                  className={buttonClass}
                                >
                                  {label}
                                </button>
                                {/* Tooltip with variant name */}
                                <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                                  {variantName}
                                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-4 border-transparent border-t-gray-900"></div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        
                        {/* Overridden indicator pill */}
                        {overrides[experiment.name] !== undefined && (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                            overridden
                          </span>
                        )}
                      </div>
                    </>
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
            
            {/* Action buttons stacked vertically, aligned to top */}
            <div className="flex flex-col items-center gap-0.5 ml-2 self-start">
              {/* Chevron button for opening detail view */}
              <div className="relative group">
                <button
                  onClick={() => onExperimentClick(experiment)}
                  className="p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                  aria-label="View experiment details"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
                
                {/* Tooltip */}
                <div className="absolute right-0 bottom-full mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                  View details
                  <div className="absolute top-full right-2 w-0 h-0 border-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
              
              <div className="flex flex-col gap-0.5">
                {/* Open in ABsmartly */}
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
                  
                  {/* Tooltip with high z-index */}
                  <div className="absolute right-0 bottom-full mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                    Open in ABsmartly
                    <div className="absolute top-full right-2 w-0 h-0 border-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
                
                {/* Edit in ABsmartly */}
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
                  
                  {/* Tooltip with high z-index */}
                  <div className="absolute right-0 bottom-full mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                    Edit in ABsmartly
                    <div className="absolute top-full right-2 w-0 h-0 border-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}