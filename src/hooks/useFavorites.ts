import { useState, useCallback } from 'react'
import { debugError } from '~src/utils/debug'

interface UseFavoritesParams {
  getFavorites: () => Promise<number[]>
  setExperimentFavorite: (experimentId: number, isFavorite: boolean) => Promise<void>
  requestPermissionsIfNeeded: (forceRequest: boolean) => Promise<boolean>
  onError: (message: string) => void
}

export function useFavorites({
  getFavorites,
  setExperimentFavorite,
  requestPermissionsIfNeeded,
  onError
}: UseFavoritesParams) {
  const [favoriteExperiments, setFavoriteExperiments] = useState<Set<number>>(new Set())

  const loadFavorites = useCallback(async () => {
    try {
      const favoriteIds = await getFavorites()
      setFavoriteExperiments(new Set(favoriteIds))
    } catch (err: unknown) {
      const error = err as { isAuthError?: boolean; message?: string }
      if (error.isAuthError || error.message === 'AUTH_EXPIRED') {
        console.log('[loadFavorites] AUTH_EXPIRED error detected')
        const permissionsGranted = await requestPermissionsIfNeeded(true)
        if (permissionsGranted) {
          console.log('[loadFavorites] Retrying after permissions granted...')
          setTimeout(() => loadFavorites(), 500)
        }
      }
      debugError('Failed to load favorites:', error)
    }
  }, [getFavorites, requestPermissionsIfNeeded])

  const handleToggleFavorite = useCallback(async (experimentId: number) => {
    const isFavorite = favoriteExperiments.has(experimentId)
    const newFavorite = !isFavorite

    const newFavorites = new Set(favoriteExperiments)
    if (newFavorite) {
      newFavorites.add(experimentId)
    } else {
      newFavorites.delete(experimentId)
    }
    setFavoriteExperiments(newFavorites)

    try {
      await setExperimentFavorite(experimentId, newFavorite)
    } catch (error) {
      debugError('Failed to update favorite:', error)
      const revertedFavorites = new Set(favoriteExperiments)
      if (isFavorite) {
        revertedFavorites.add(experimentId)
      } else {
        revertedFavorites.delete(experimentId)
      }
      setFavoriteExperiments(revertedFavorites)
      onError('Failed to update favorite')
    }
  }, [favoriteExperiments, setExperimentFavorite, onError])

  return {
    favoriteExperiments,
    loadFavorites,
    handleToggleFavorite
  }
}
