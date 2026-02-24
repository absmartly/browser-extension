import React from 'react'
import { DEFAULT_CONFIG } from '../../config/defaults'
import { Input } from '../ui/Input'
import { Checkbox } from '../ui/Checkbox'

interface QueryStringOverridesSectionProps {
  queryPrefix: string
  persistQueryToCookie: boolean
  onQueryPrefixChange: (value: string) => void
  onPersistQueryToCookieChange: (value: boolean) => void
}

export const QueryStringOverridesSection = React.memo(function QueryStringOverridesSection({
  queryPrefix,
  persistQueryToCookie,
  onQueryPrefixChange,
  onPersistQueryToCookieChange
}: QueryStringOverridesSectionProps) {
  return (
    <div className="border-t pt-4 mt-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Query String Overrides</h3>

      <Input
        label="Query Parameter Prefix"
        type="text"
        value={queryPrefix}
        onChange={(e) => onQueryPrefixChange(e.target.value)}
        placeholder={DEFAULT_CONFIG.queryPrefix}
      />
      <p className="mt-1 text-xs text-gray-500">
        Prefix for query parameters (e.g., ?{DEFAULT_CONFIG.queryPrefix}button_color=1)
      </p>

      <div className="mt-4 flex items-center gap-3">
        <Checkbox
          id="persistQueryToCookie"
          checked={persistQueryToCookie}
          onChange={onPersistQueryToCookieChange}
        />
        <label htmlFor="persistQueryToCookie" className="block text-sm text-gray-700 cursor-pointer">
          Persist query string overrides to cookie
        </label>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        When enabled, query string overrides will be saved to a cookie for persistence across page loads.
      </p>
    </div>
  )
})
