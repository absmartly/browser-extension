import type { DOMChange, AIDOMGenerationResult } from '~src/types/dom-changes'

export function applyDOMChangeAction(
  currentChanges: DOMChange[],
  result: AIDOMGenerationResult
): DOMChange[] {
  const { domChanges, action, targetSelectors } = result

  switch (action) {
    case 'append':
      return [...currentChanges, ...domChanges]

    case 'replace_all':
      return domChanges

    case 'replace_specific': {
      if (!targetSelectors || targetSelectors.length === 0) {
        throw new Error('replace_specific action requires targetSelectors array')
      }

      const withoutTargets = currentChanges.filter(
        (change) => !targetSelectors.includes(change.selector)
      )

      return [...withoutTargets, ...domChanges]
    }

    case 'remove_specific': {
      if (!targetSelectors || targetSelectors.length === 0) {
        throw new Error('remove_specific action requires targetSelectors array')
      }

      return currentChanges.filter(
        (change) => !targetSelectors.includes(change.selector)
      )
    }

    case 'none':
      return currentChanges

    default: {
      const exhaustiveCheck: never = action
      throw new Error(`Unknown action type: ${exhaustiveCheck}`)
    }
  }
}
