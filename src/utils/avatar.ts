/**
 * Avatar color generation utilities matching ABsmartly platform
 * Deterministically derives avatar background colors from user names
 */

// ABsmartly theme colors for avatars
const AVATAR_COLORS = [
  '#D8B2E9', // color-extra-01
  '#8BCECE', // color-extra-02
  '#C5D98C', // color-extra-03
  '#F08989', // color-extra-04
  '#B7B3EA', // color-extra-05
  '#F2BC7D', // color-extra-06
  '#87C2E7', // color-extra-07
  '#95DC94', // color-extra-08
  '#F3AA9F', // color-extra-09
  '#82BFD4', // color-extra-10
  '#F0D976', // color-extra-11
  '#8BD3B8', // color-extra-12
  '#A7BCE4', // color-extra-13
]

/**
 * Hash a name to a stable integer using FNV-1a algorithm
 * This ensures the same name always gets the same color
 */
export function hashName(name: string): number {
  let hash = 0x811c9dc5
  const prime = 0x01000193

  const len = name.length ?? 0
  for (let i = 0; i < len; ++i) {
    hash ^= name.charCodeAt(i)
    hash += Math.imul(hash, prime)
  }
  return hash >>> 0
}

/**
 * Get avatar background color for a user name
 * Returns a hex color string from the theme palette
 */
export function getAvatarColor(name: string): string {
  const hash = hashName(name)
  const colorIndex = hash % 13
  return AVATAR_COLORS[colorIndex]
}

/**
 * Generate initials from a name
 */
export function getInitials(name: string): string {
  if (!name) return '?'

  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) {
    // Single word - use first two letters
    return parts[0].substring(0, 2).toUpperCase()
  } else {
    // Multiple words - use first letter of first two words
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
  }
}