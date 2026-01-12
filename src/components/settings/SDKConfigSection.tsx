import React from 'react'
import { Input } from '../ui/Input'

interface SDKConfigSectionProps {
  sdkWindowProperty: string
  onSdkWindowPropertyChange: (value: string) => void
}

export const SDKConfigSection = React.memo(function SDKConfigSection({
  sdkWindowProperty,
  onSdkWindowPropertyChange
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
    </div>
  )
})
