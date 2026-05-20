import type { Standup } from '../../types/database'
import { formatStandupDate, formatStandupTime } from '../../lib/standupDates'
import { LoadingSpinner } from './LoadingSpinner'

type StandupHistoryListProps = {
  history: Standup[]
  loading: boolean
  error: string | null
  selectedId: string | null
  onSelect: (standup: Standup) => void
  onRetry: () => void
}

function previewText(standup: Standup): string {
  const text =
    standup.summary?.trim() ||
    standup.today?.trim() ||
    standup.yesterday?.trim() ||
    standup.raw_notes?.trim() ||
    'Standup'
  return text.length > 80 ? `${text.slice(0, 80)}…` : text
}

export function StandupHistoryList({
  history,
  loading,
  error,
  selectedId,
  onSelect,
  onRetry,
}: StandupHistoryListProps) {
  if (loading) {
    return <LoadingSpinner label="Loading your standups…" className="py-12" />
  }

  if (error) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
        >
          Try again
        </button>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          No saved standups yet
        </p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Click <span className="font-medium">Generate Standup</span> on the
          dashboard. Each successful save appears here automatically.
        </p>
        <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
          Standups created before the database was set up were not saved.
        </p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-zinc-200 bg-white pb-6 dark:divide-zinc-700 dark:bg-zinc-900">
      {history.map((item) => {
        const active = selectedId === item.id
        return (
          <li key={item.id} className="list-none">
            <button
              type="button"
              onClick={() => onSelect(item)}
              className={`block w-full cursor-pointer px-4 py-4 text-left transition ${
                active
                  ? 'bg-violet-100 dark:bg-violet-950/50'
                  : 'bg-white hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatStandupDate(item.created_at)}
                </span>
                <span className="shrink-0 text-xs text-zinc-400">
                  {formatStandupTime(item.created_at)}
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-snug text-zinc-700 dark:text-zinc-300">
                {previewText(item)}
              </p>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
