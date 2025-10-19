import React from 'react'
import { Input } from '../ui/Input'

interface SDKInjectionSectionProps {
  injectSDK: boolean
  sdkUrl: string
  onInjectSDKChange: (value: boolean) => void
  onSdkUrlChange: (value: string) => void
}

export const SDKInjectionSection = React.memo(function SDKInjectionSection({
  injectSDK,
  sdkUrl,
  onInjectSDKChange,
  onSdkUrlChange
}: SDKInjectionSectionProps) {
  return (
    <div className="border-t pt-4 mt-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">SDK Injection</h3>

      <div className="flex items-center">
        <input
          id="injectSDK"
          type="checkbox"
          checked={injectSDK}
          onChange={(e) => onInjectSDKChange(e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="injectSDK" className="ml-2 block text-sm text-gray-700">
          Inject ABsmartly SDK if not detected
        </label>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        When enabled, the extension will inject the ABsmartly SDK (including all plugins) on pages where it's not already present.
      </p>

      {injectSDK && (
        <div className="mt-4">
          <Input
            label="Custom SDK URL (Optional)"
            type="url"
            value={sdkUrl}
            onChange={(e) => onSdkUrlChange(e.target.value)}
            placeholder="https://sdk.absmartly.com/sdk.js"
          />
          <p className="mt-1 text-xs text-gray-500">
            Custom URL for the SDK script. Leave empty to use the default SDK URL with current page's query parameters.
          </p>
        </div>
      )}
    </div>
  )
})
