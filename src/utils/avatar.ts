const AVATAR_COLORS = [
  '#D8B2E9',
  '#8BCECE',
  '#C5D98C',
  '#F08989',
  '#B7B3EA',
  '#F2BC7D',
  '#87C2E7',
  '#95DC94',
  '#F3AA9F',
  '#82BFD4',
  '#F0D976',
  '#8BD3B8',
  '#A7BCE4',
]

export interface Avatar {
  base_url?: string
}

function hashName(name: string): number {
  let hash = 0x811c9dc5
  const prime = 0x01000193

  const len = name.length ?? 0
  for (let i = 0; i < len; ++i) {
    hash ^= name.charCodeAt(i)
    hash += Math.imul(hash, prime)
  }
  return hash >>> 0
}

export function getAvatarColor(name: string): string {
  const hash = hashName(name)
  const colorIndex = hash % 13
  return AVATAR_COLORS[colorIndex]
}

export function getInitials(name: string): string {
  if (!name) return '?'

  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase()
  } else {
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
  }
}

export function buildAvatarUrl(avatar: Avatar | undefined | null, size: number = 32): string | null {
  if (!avatar?.base_url) {
    return null
  }

  const endpoint = localStorage.getItem('absmartly-endpoint')
  if (!endpoint) {
    return null
  }

  const baseUrl = endpoint.replace(/\/+$/, '').replace(/\/v1$/, '')
  return `${baseUrl}${avatar.base_url}/crop/${size}x${size}.webp`
}
