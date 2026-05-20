export function formatStandupDate(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const startToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  )
  const startDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  )
  const diffDays = Math.round(
    (startToday.getTime() - startDate.getTime()) / 86_400_000,
  )

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

export function formatStandupTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}
