import React from 'react'
import { ArrowTopRightOnSquareIcon, PencilSquareIcon } from '@heroicons/react/24/outline'
import { getConfig } from '~src/utils/storage'

interface ExperimentActionsProps {
  experimentId: number
}

export function ExperimentActions({ experimentId }: ExperimentActionsProps) {
  return (
    <>
      {/* Open in ABsmartly */}
      <div className="relative group">
        <button
          onClick={async () => {
            try {
              const config = await getConfig()
              if (config?.apiEndpoint) {
                const baseUrl = config.apiEndpoint.replace(/\/+$/, '').replace(/\/v1$/, '')
                const url = `${baseUrl}/experiments/${experimentId}`
                chrome.tabs.create({ url })
              }
            } catch { /* config unavailable */ }
          }}
          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          aria-label="Open in ABsmartly"
        >
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
        </button>

        <div className="absolute right-0 bottom-full mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
          Open in ABsmartly
          <div className="absolute top-full right-2 w-0 h-0 border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>

      {/* Edit in ABsmartly */}
      <div className="relative group">
        <button
          onClick={async () => {
            try {
              const config = await getConfig()
              if (config?.apiEndpoint) {
                const baseUrl = config.apiEndpoint.replace(/\/+$/, '').replace(/\/v1$/, '')
                const url = `${baseUrl}/experiments/${experimentId}/edit`
                chrome.tabs.create({ url })
              }
            } catch { /* config unavailable */ }
          }}
          className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
          aria-label="Edit in ABsmartly"
        >
          <PencilSquareIcon className="h-4 w-4" />
        </button>

        <div className="absolute right-0 bottom-full mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
          Edit in ABsmartly
          <div className="absolute top-full right-2 w-0 h-0 border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>
    </>
  )
}
