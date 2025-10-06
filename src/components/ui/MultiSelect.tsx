import React from 'react'
import { SearchableSelect, type SearchableSelectOption } from './SearchableSelect'

// Re-export the option type for backward compatibility
export type MultiSelectOption = SearchableSelectOption

interface MultiSelectProps {
  label: string
  options: MultiSelectOption[]
  selectedIds: (number | string)[]
  onChange: (selectedIds: (number | string)[]) => void
  placeholder?: string
  loading?: boolean
  disabled?: boolean
  renderOption?: (option: MultiSelectOption, isSelected: boolean, onSelect: () => void) => React.ReactNode
  renderSelectedOption?: (option: MultiSelectOption, onRemove?: (e: React.MouseEvent) => void) => React.ReactNode
  showSearch?: boolean
}

export function MultiSelect({
  label,
  options,
  selectedIds,
  onChange,
  placeholder,
  loading,
  disabled,
  renderOption,
  renderSelectedOption,
  showSearch
}: MultiSelectProps) {
  return (
    <SearchableSelect
      mode="multi"
      label={label}
      options={options}
      selectedIds={selectedIds}
      onChange={onChange}
      placeholder={placeholder}
      loading={loading}
      disabled={disabled}
      renderOption={renderOption}
      renderSelectedOption={renderSelectedOption}
      showSearch={showSearch}
    />
  )
}
