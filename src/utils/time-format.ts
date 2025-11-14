export function formatConversationTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()

  const isToday = date.toDateString() === now.toDateString()

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  const isThisYear = date.getFullYear() === now.getFullYear()

  const timeFormat: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }

  const timeString = date.toLocaleTimeString('en-US', timeFormat)

  if (isToday) {
    return `Today, ${timeString}`
  }

  if (isYesterday) {
    return `Yesterday, ${timeString}`
  }

  if (isThisYear) {
    const dateFormat: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric'
    }
    const dateString = date.toLocaleDateString('en-US', dateFormat)
    return `${dateString}, ${timeString}`
  }

  const dateFormat: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }
  const dateString = date.toLocaleDateString('en-US', dateFormat)
  return dateString
}
