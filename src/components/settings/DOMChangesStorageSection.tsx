import React from 'react'
import { Input } from '../ui/Input'

interface DOMChangesStorageSectionProps {
  domChangesFieldName: string
  onDomChangesFieldNameChange: (value: string) => void
}

export const DOMChangesStorageSection = React.memo(function DOMChangesStorageSection({
  domChangesFieldName,
  onDomChangesFieldNameChange
}: DOMChangesStorageSectionProps) {
  return (
    <div className="space-y-3 border-t pt-4 mt-4">
      <h3 className="text-sm font-medium text-gray-700">DOM Changes Storage</h3>
      
      <div>
        <Input
          label="Variable Name"
          type="text"
          value={domChangesFieldName}
          onChange={(e) => onDomChangesFieldNameChange(e.target.value)}
          placeholder="__dom_changes"
        />
        <p className="mt-1 text-xs text-gray-500">
          The name of the variable that will store DOM changes in each variant
        </p>
      </div>
    </div>
  )
})
