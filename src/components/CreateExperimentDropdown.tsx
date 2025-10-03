import { useState, useRef, useEffect } from "react"
import { PlusCircleIcon } from "@heroicons/react/24/outline"

interface CreateExperimentDropdownProps {
  onCreateFromScratch: () => void
  onCreateFromTemplate?: (templateId?: number) => void
}

export function CreateExperimentDropdown({
  onCreateFromScratch,
  onCreateFromTemplate
}: CreateExperimentDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  const handleCreateFromScratch = () => {
    setIsOpen(false)
    onCreateFromScratch()
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
          className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
          role="menu"
        >
          <button
            onClick={handleCreateFromScratch}
            className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-center gap-3 text-sm font-medium text-blue-600"
            role="menuitem"
          >
            <PlusCircleIcon className="h-5 w-5" />
            Create from scratch
          </button>

          {onCreateFromTemplate && (
            <>
              <div className="border-t border-gray-200 my-2" />
              <div className="px-4 py-2">
                <p className="text-xs text-gray-500 mb-2">Templates</p>
                <p className="text-xs text-gray-400 italic">No templates available</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
