import React from 'react'
import { Input } from '../ui/Input'

interface SDKConfigSectionProps {
  sdkWindowProperty: string
  sdkEndpoint: string
  onSdkWindowPropertyChange: (value: string) => void
  onSdkEndpointChange: (value: string) => void
}

export const SDKConfigSection = React.memo(function SDKConfigSection({
  sdkWindowProperty,
  sdkEndpoint,
  onSdkWindowPropertyChange,
  onSdkEndpointChange
}: SDKConfigSectionProps) {
  return (
    <div className="border-t pt-4 mt-4">
      <Input
        label="SDK Window Property (Optional)"
        type="text"
        value={sdkWindowProperty}
        onChange={(e) => onSdkWindowPropertyChange(e.target.value)}
        placeholder="e.g., ABsmartlyContext or sdk.context"
      />
      <p className="mt-1 text-xs text-gray-500">
        The window property where the ABsmartly SDK context is stored. Leave empty to use automatic detection.
      </p>

      <div className="mt-4">
        <Input
          label="SDK Endpoint (Optional)"
          type="url"
          value={sdkEndpoint}
          onChange={(e) => onSdkEndpointChange(e.target.value)}
          placeholder="e.g., https://demo.absmartly.io"
        />
        <p className="mt-1 text-xs text-gray-500">
          SDK collector endpoint for fetching development experiments. Defaults to API endpoint with .io domain.
        </p>
      </div>
    </div>
  )
})
