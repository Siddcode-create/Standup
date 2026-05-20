import { useEffect, useRef } from 'react'

type DashboardSettingsProps = {
  open: boolean
  onClose: () => void
  autoFetchGitHub: boolean
  onAutoFetchGitHubChange: (enabled: boolean) => void
}

export function DashboardSettings({
  open,
  onClose,
  autoFetchGitHub,
  onAutoFetchGitHubChange,
}: DashboardSettingsProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('[data-settings-trigger]')
      ) {
        onClose()
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-zinc-200/90 bg-white p-4 shadow-lg ring-1 ring-zinc-950/5 dark:border-zinc-700 dark:bg-zinc-900 dark:ring-white/5"
      role="dialog"
      aria-label="Settings"
    >
      <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Settings
      </h3>

      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className="text-sm leading-snug text-zinc-600 dark:text-zinc-300">
          Auto-fetch GitHub commits
          <span className="mt-0.5 block text-xs font-normal text-zinc-400">
            Uses real commit dates — yesterday vs today are kept separate
          </span>
        </span>
        <span className="relative inline-flex h-6 w-11 shrink-0">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={autoFetchGitHub}
            onChange={(e) => onAutoFetchGitHubChange(e.target.checked)}
          />
          <span
            className="absolute inset-0 rounded-full bg-zinc-200 transition-colors peer-checked:bg-violet-600 peer-focus-visible:ring-2 peer-focus-visible:ring-violet-500 peer-focus-visible:ring-offset-2 dark:bg-zinc-700 dark:peer-checked:bg-violet-500 dark:peer-focus-visible:ring-offset-zinc-900"
            aria-hidden="true"
          />
          <span
            className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"
            aria-hidden="true"
          />
        </span>
      </label>
    </div>
  )
}
