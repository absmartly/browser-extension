import React, { useState, useRef, useEffect } from "react"
import { PlusCircleIcon, MagnifyingGlassIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline"
import { useABsmartly } from "~src/hooks/useABsmartly"
import { fetchAuthenticatedImage } from "~src/utils/auth"

interface CreateExperimentDropdownProps {
  onCreateFromScratch: () => void
  onCreateFromTemplate?: (templateId: number) => void
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

interface Template {
  id: number
  name: string
  created_at: string
  updated_at: string
  created_by?: {
    first_name?: string
    last_name?: string
    email?: string
    avatar?: {
      base_url?: string
    }
  }
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  }

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit)
    if (interval >= 1) {
      return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`
    }
  }

  return 'just now'
}

function getInitials(user: Template['created_by']): string {
  if (!user) return '?'
  if (user.first_name && user.last_name) {
    return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
  }
  if (user.first_name) return user.first_name[0].toUpperCase()
  if (user.last_name) return user.last_name[0].toUpperCase()
  if (user.email) return user.email[0].toUpperCase()
  return '?'
}

interface CreateExperimentDropdownPanelProps {
  isOpen: boolean
  templates: Template[]
  loading: boolean
  searchQuery: string
  onSearchChange: (query: string) => void
  onCreateFromScratch: () => void
  onTemplateSelect: (id: number) => void
  config: any
}

export function CreateExperimentDropdownPanel({
  isOpen,
  templates,
  loading,
  searchQuery,
  onSearchChange,
  onCreateFromScratch,
  onTemplateSelect,
  config
}: CreateExperimentDropdownPanelProps) {
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())
  const [avatarBlobUrls, setAvatarBlobUrls] = useState<Map<string, string>>(new Map())

  // Fetch authenticated avatar images and convert to blob URLs
  useEffect(() => {
    if (!isOpen || !config) return

    const fetchAvatars = async () => {
      for (const template of templates) {
        const user = template.created_by
        if (!user?.avatar?.base_url) continue

        const baseUrl = config.apiEndpoint.replace(/\/+$/, '').replace(/\/v1$/, '')
        const avatarUrl = `${baseUrl}${user.avatar.base_url}/crop/32x32.webp`

        // Skip if already fetched or failed
        if (avatarBlobUrls.has(avatarUrl) || failedImages.has(avatarUrl)) continue

        const blobUrl = await fetchAuthenticatedImage(avatarUrl, config)

        if (blobUrl) {
          setAvatarBlobUrls(prev => new Map(prev).set(avatarUrl, blobUrl))
        } else {
          setFailedImages(prev => new Set(prev).add(avatarUrl))
        }
      }
    }

    fetchAvatars()

    // Cleanup blob URLs when component unmounts
    return () => {
      avatarBlobUrls.forEach(blobUrl => URL.revokeObjectURL(blobUrl))
    }
  }, [isOpen, templates, config])

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getAvatarUrl = (user: Template['created_by']) => {
    if (!user?.avatar?.base_url || !config?.apiEndpoint) return null

    const baseUrl = config.apiEndpoint.replace(/\/+$/, '').replace(/\/v1$/, '')
    const avatarUrl = `${baseUrl}${user.avatar.base_url}/crop/32x32.webp`

    // Return blob URL if we have it, otherwise null (will show initials)
    return avatarBlobUrls.get(avatarUrl) || null
  }

  const getUserName = (user: Template['created_by']) => {
    if (!user) return 'Unknown'
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim()
    }
    return user.email || 'Unknown'
  }

  if (!isOpen) return null

  return (
    <div className="absolute left-0 right-0 top-[60px] bg-white border border-gray-200 shadow-lg z-50">
      {/* Warning message */}
      <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-100 flex items-start gap-2">
        <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-yellow-800">
          Loading a new template will overwrite the current experiment fields.
        </p>
      </div>

      <button
        id="from-scratch-button"
        onClick={onCreateFromScratch}
        className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-center gap-3 text-sm font-medium text-blue-600 border-b border-gray-200"
        role="menuitem"
      >
        <PlusCircleIcon className="h-5 w-5" />
        Create from scratch
      </button>

      {/* Templates list */}
      <div className="max-h-[calc(100vh-180px)] overflow-y-auto">
        {loading ? (
          <div className="px-4 py-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-xs text-gray-500 mt-2">Loading templates...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-500">No templates found</p>
          </div>
        ) : (
          <div className="py-2 space-y-1">
            {filteredTemplates.map((template) => {
              const avatarBlobUrl = getAvatarUrl(template.created_by)
              const initials = getInitials(template.created_by)
              const userName = getUserName(template.created_by)

              return (
                <div
                  key={template.id}
                  className="px-4 py-2 hover:bg-gray-50 flex items-center gap-3"
                >
                  {avatarBlobUrl ? (
                    <img
                      src={avatarBlobUrl}
                      alt={userName}
                      className="h-10 w-10 rounded-full"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-sm">
                      {initials}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {template.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      Saved {timeAgo(template.updated_at || template.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => onTemplateSelect(template.id)}
                    className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  >
                    Load
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export function CreateExperimentDropdown({
  onCreateFromScratch,
  onCreateFromTemplate,
  isOpen: externalIsOpen,
  onOpenChange
}: CreateExperimentDropdownProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen
  const setIsOpen = (value: boolean) => {
    if (onOpenChange) {
      onOpenChange(value)
    } else {
      setInternalIsOpen(value)
    }
  }
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { getTemplates, config } = useABsmartly()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => {
        document.removeEventListener("mousedown", handleClickOutside)
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && templates.length === 0) {
      loadTemplates()
    }
  }, [isOpen])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const data = await getTemplates('test_template')
      console.log('Templates loaded:', data)
      setTemplates(data)
    } catch (error) {
      console.error('Failed to load templates:', error)
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreateFromScratch = () => {
    setIsOpen(false)
    onCreateFromScratch()
  }

  const handleTemplateSelect = (templateId: number) => {
    setIsOpen(false)
    if (onCreateFromTemplate) {
      onCreateFromTemplate(templateId)
    }
  }

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getAvatarUrl = (user: Template['created_by']) => {
    if (!user?.avatar?.base_url || !config?.apiEndpoint) return null
    const baseUrl = config.apiEndpoint.replace(/\/+$/, '').replace(/\/v1$/, '')
    return `${baseUrl}${user.avatar.base_url}/crop/32x32.webp`
  }

  const getUserName = (user: Template['created_by']) => {
    if (!user) return 'Unknown'
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim()
    }
    return user.email || 'Unknown'
  }

  return (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className="p-2 hover:bg-gray-100 rounded-md transition-colors"
      aria-label="Create Experiment"
      title="Create New Experiment"
    >
      <svg
        className="h-5 w-5 text-gray-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4v16m8-8H4"
        />
      </svg>
    </button>
  )
}
