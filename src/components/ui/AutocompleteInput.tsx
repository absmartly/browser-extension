import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from "react"

import { debugWarn } from "~src/utils/debug"

interface AutocompleteInputProps {
  id?: string
  "data-testid"?: string
  placeholder?: string
  value: string
  onChange: (next: string) => void
  /**
   * Async callback that returns the list of suggestion strings for the current
   * input. Called on focus and (debounced) on every keystroke. If it throws,
   * the dropdown is hidden and typing still works.
   */
  fetchOptions: (prefix: string) => Promise<string[]>
  /** Debounce delay for `fetchOptions` calls. Defaults to 250ms. */
  debounceMs?: number
  className?: string
  disabled?: boolean
}

/**
 * Small typeahead text input. Renders a controlled `<input>` and a dropdown of
 * suggestions returned by `fetchOptions`. The user can also type free text — we
 * never block the keystrokes, so values that don't appear in the options list
 * still flow up to `onChange`.
 *
 * Modeled after the web app's `AbsJSONLayoutTextField` / `AbsJSONValueSelect`
 * but pared down to the extension's needs: no chips, no multi-select, no
 * Vuetify-specific behaviors.
 */
export function AutocompleteInput({
  id,
  "data-testid": dataTestId,
  placeholder,
  value,
  onChange,
  fetchOptions,
  debounceMs = 250,
  className,
  disabled
}: AutocompleteInputProps) {
  const autoId = useId()
  const inputId = id ?? `autocomplete-${autoId}`
  const listboxId = `${inputId}-listbox`
  const containerRef = useRef<HTMLDivElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFetchedPrefixRef = useRef<string | null>(null)
  const fetchTokenRef = useRef(0)

  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [highlight, setHighlight] = useState(-1)

  const runFetch = useCallback(
    async (prefix: string) => {
      lastFetchedPrefixRef.current = prefix
      const token = ++fetchTokenRef.current
      setLoading(true)
      try {
        const next = await fetchOptions(prefix)
        if (token !== fetchTokenRef.current) return
        // The contract is `string[]`; defensively coerce so a bad call doesn't
        // crash the dropdown render.
        if (!Array.isArray(next)) {
          debugWarn("[AutocompleteInput] fetchOptions returned non-array")
          setOptions([])
          return
        }
        setOptions(next.filter((s) => typeof s === "string"))
        setHighlight(-1)
      } catch (err) {
        if (token !== fetchTokenRef.current) return
        debugWarn("[AutocompleteInput] fetchOptions threw:", err)
        setOptions([])
      } finally {
        if (token === fetchTokenRef.current) setLoading(false)
      }
    },
    [fetchOptions]
  )

  // Schedule a debounced fetch for the current value when the input changes.
  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void runFetch(value)
    }, debounceMs)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value, open, debounceMs, runFetch])

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [open])

  const handleFocus = () => {
    setOpen(true)
    if (lastFetchedPrefixRef.current !== value) {
      void runFetch(value)
    }
  }

  const selectOption = (option: string) => {
    onChange(option)
    setOpen(false)
    setHighlight(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (!open) setOpen(true)
      setHighlight((h) => (options.length ? (h + 1) % options.length : -1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlight((h) =>
        options.length ? (h <= 0 ? options.length - 1 : h - 1) : -1
      )
    } else if (e.key === "Enter") {
      if (open && highlight >= 0 && highlight < options.length) {
        e.preventDefault()
        selectOption(options[highlight])
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault()
        setOpen(false)
      }
    }
  }

  const showDropdown = open && (loading || options.length > 0)
  const dropdownTestId = useMemo(
    () => (dataTestId ? `${dataTestId}-listbox` : `${inputId}-listbox`),
    [dataTestId, inputId]
  )

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <input
        type="text"
        id={inputId}
        data-testid={dataTestId}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        aria-controls={listboxId}
        autoComplete="off"
        className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-white"
      />
      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          data-testid={dropdownTestId}
          className="absolute z-10 mt-1 w-full max-h-60 overflow-auto border border-gray-200 rounded bg-white shadow-md text-sm">
          {loading && options.length === 0 && (
            <li className="px-2 py-1 text-xs text-gray-400 italic">Loading…</li>
          )}
          {options.map((option, index) => (
            <li
              key={`${option}-${index}`}
              role="option"
              aria-selected={index === highlight}
              data-testid={
                dataTestId ? `${dataTestId}-option-${index}` : undefined
              }
              // Use onMouseDown so the click fires before the input's blur.
              onMouseDown={(e) => {
                e.preventDefault()
                selectOption(option)
              }}
              onMouseEnter={() => setHighlight(index)}
              className={`px-2 py-1 cursor-pointer ${
                index === highlight
                  ? "bg-blue-100 text-blue-900"
                  : "hover:bg-gray-100"
              }`}>
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
