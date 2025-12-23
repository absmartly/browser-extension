export function formatDuration(startedAt?: string, stoppedAt?: string): string | null {
  if (!startedAt) return null

  const start = new Date(startedAt)
  const end = stoppedAt ? new Date(stoppedAt) : new Date()
  const diff = end.getTime() - start.getTime()

  const weeks = Math.floor(diff / (1000 * 60 * 60 * 24 * 7))
  const days = Math.floor((diff % (1000 * 60 * 60 * 24 * 7)) / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  const parts = []
  if (weeks > 0) parts.push(`${weeks}w`)
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0 && weeks === 0) parts.push(`${hours}h`)
  if (minutes > 0 && weeks === 0 && days === 0) parts.push(`${minutes}m`)

  return parts.length > 0 ? parts.join(', ') : 'Just started'
}
