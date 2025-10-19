import React from 'react'
import { Input } from '../ui/Input'

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
        placeholder="_exp_"
      />
      <p className="mt-1 text-xs text-gray-500">
        Prefix for query parameters (e.g., ?_exp_button_color=1)
      </p>

      <div className="mt-4 flex items-center">
        <input
          id="persistQueryToCookie"
          type="checkbox"
          checked={persistQueryToCookie}
          onChange={(e) => onPersistQueryToCookieChange(e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="persistQueryToCookie" className="ml-2 block text-sm text-gray-700">
          Persist query string overrides to cookie
        </label>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        When enabled, query string overrides will be saved to a cookie for persistence across page loads.
      </p>
    </div>
  )
})
