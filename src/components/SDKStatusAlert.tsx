import React from 'react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface SDKStatusAlertProps {
  sdkDetected: boolean
}

export function SDKStatusAlert({ sdkDetected }: SDKStatusAlertProps) {
  if (sdkDetected) {
    return null
  }

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
        </div>
        <div className="ml-3">
          <p className="text-sm text-yellow-700">
            <strong>ABsmartly DOM changes plugin not installed on this page.</strong>
          </p>
          <p className="text-xs text-yellow-600 mt-1">
            You can use all the extension features to create and edit experiments, but the DOM changes plugin is required to run visual experiments on this page.
          </p>
        </div>
      </div>
    </div>
  )
}
