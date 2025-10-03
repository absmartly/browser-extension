import { useState, useRef, useEffect } from "react"
import { PlusCircleIcon, MagnifyingGlassIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline"
import { useABsmartly } from "~src/hooks/useABsmartly"

interface CreateExperimentDropdownProps {
  onCreateFromScratch: () => void
  onCreateFromTemplate?: (templateId: number) => void
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

export function CreateExperimentDropdown({
  onCreateFromScratch,
  onCreateFromTemplate
}: CreateExperimentDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
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
      setTemplates(data)
    } catch (error) {
      console.error('Failed to load templates:', error)
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
    <div className="relative" ref={dropdownRef}>
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

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 max-h-[500px] flex flex-col"
          role="menu"
        >
          {/* Warning message */}
          <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-100 flex items-start gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-800">
              Loading a new template will overwrite the current experiment fields.
            </p>
          </div>

          <button
            onClick={handleCreateFromScratch}
            className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-center gap-3 text-sm font-medium text-blue-600 border-b border-gray-200"
            role="menuitem"
          >
            <PlusCircleIcon className="h-5 w-5" />
            Create from scratch
          </button>

          {/* Search box */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="relative">
              <input
                type="text"
                placeholder="Search templates"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading || templates.length === 0}
              />
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute right-3 top-2.5" />
            </div>
          </div>

          {/* Templates list */}
          <div className="overflow-y-auto flex-1">
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
                  const avatarUrl = getAvatarUrl(template.created_by)
                  const initials = getInitials(template.created_by)
                  const userName = getUserName(template.created_by)

                  return (
                    <div
                      key={template.id}
                      className="px-4 py-2 hover:bg-gray-50 flex items-center gap-3"
                    >
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
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
                        onClick={() => handleTemplateSelect(template.id)}
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
      )}
    </div>
  )
}
