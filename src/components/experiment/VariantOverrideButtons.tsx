import React, { useCallback } from 'react'
import type { Experiment, Variant } from '~src/types/absmartly'
import type { ExperimentOverrides, OverrideValue } from '~src/utils/overrides'
import type { VariantAssignments } from '~src/utils/sdk-bridge'

interface VariantOverrideButtonsProps {
  experiment: Experiment
  overrides: ExperimentOverrides
  realVariants: VariantAssignments
  experimentsInContext: string[]
  onOverrideChange: (experimentName: string, variantIndex: number, experiment: Experiment) => void
}

export function VariantOverrideButtons({
  experiment,
  overrides,
  realVariants,
  experimentsInContext,
  onOverrideChange
}: VariantOverrideButtonsProps) {
  const getVariantLabel = useCallback((index: number): string => {
    return String.fromCharCode(65 + index)
  }, [])

  if (experiment.variants.length === 0) {
    return null
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <div className="inline-flex rounded-md shadow-sm" role="group">
        {experiment.variants.map((variant, idx) => {
          const overrideValue = overrides[experiment.name]
          const overriddenVariant = typeof overrideValue === 'number' ? overrideValue : overrideValue?.variant
          const isOverridden = overriddenVariant === idx
          const isRealVariant = realVariants[experiment.name] === idx
          const hasRealVariant = realVariants[experiment.name] !== undefined
          const experimentInContext = experimentsInContext.includes(experiment.name)
          const label = getVariantLabel(idx)
          const variantName = variant.name || `Variant ${label}`

          let buttonClass = 'px-2.5 py-1 text-xs font-medium transition-colors '
          if (idx === 0) buttonClass += 'rounded-l-md '
          if (idx === experiment.variants.length - 1) buttonClass += 'rounded-r-md '
          if (idx > 0) buttonClass += 'border-l '

          if (isOverridden) {
            buttonClass += 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 '
          } else if (isRealVariant && !overrides[experiment.name] && hasRealVariant && experimentInContext) {
            buttonClass += 'bg-green-600 text-white border-green-600 hover:bg-green-700 '
          } else if (isRealVariant && !overrides[experiment.name] && hasRealVariant && !experimentInContext) {
            buttonClass += 'bg-gray-400 text-white border-gray-400 hover:bg-gray-500 '
          } else if (isRealVariant && overrides[experiment.name] !== undefined) {
            buttonClass += 'bg-gray-200 text-gray-500 border-gray-300 hover:bg-gray-300 '
          } else {
            buttonClass += 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 '
          }

          buttonClass += 'border-t border-b '
          if (idx === 0) buttonClass += 'border-l '
          if (idx === experiment.variants.length - 1) buttonClass += 'border-r '

          return (
            <div key={variant.id || idx} className="relative group">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (isRealVariant && overrides[experiment.name] !== undefined) {
                    onOverrideChange(experiment.name, -1, experiment)
                  } else if (!isOverridden) {
                    onOverrideChange(experiment.name, idx, experiment)
                  } else {
                    onOverrideChange(experiment.name, -1, experiment)
                  }
                }}
                className={buttonClass}
              >
                {label}
              </button>
              <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                {variantName}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>
          )
        })}
      </div>

      {overrides[experiment.name] !== undefined && (
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
          overridden
        </span>
      )}
    </div>
  )
}
