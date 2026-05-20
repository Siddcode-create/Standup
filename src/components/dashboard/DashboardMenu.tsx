import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon, HistoryIcon, MenuIcon } from './icons'
import { StandupHistoryList } from './StandupHistoryList'
import type { Standup } from '../../types/database'

type DashboardMenuProps = {
  open: boolean
  onOpen: () => void
  onClose: () => void
  history: Standup[]
  historyLoading: boolean
  historyError: string | null
  selectedHistoryId: string | null
  onSelectStandup: (standup: Standup) => void
  onRetryHistory: () => void
}

export function DashboardMenu({
  open,
  onOpen,
  onClose,
  history,
  historyLoading,
  historyError,
  selectedHistoryId,
  onSelectStandup,
  onRetryHistory,
}: DashboardMenuProps) {
  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  function handleSelect(standup: Standup) {
    onSelectStandup(standup)
    onClose()
  }

  const countLabel =
    !historyLoading && !historyError
      ? history.length === 0
        ? 'No saved standups yet'
        : `${history.length} saved`
      : null

  const drawer =
    open &&
    createPortal(
      <div className="fixed inset-0 z-[9999]">
        <button
          type="button"
          className="absolute inset-0 bg-black/40"
          aria-label="Close history"
          onClick={onClose}
        />

        <aside
          className="absolute top-0 left-0 bottom-0 z-10 flex w-[min(100%,20rem)] max-w-[85vw] flex-col bg-white shadow-2xl sm:max-w-sm dark:bg-zinc-900"
          role="dialog"
          aria-modal="true"
          aria-label="Standup history"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="shrink-0 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
                <span className="flex size-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                  <HistoryIcon className="size-5" />
                </span>
                Standup history
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Close"
              >
                <CloseIcon />
              </button>
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {countLabel ?? 'Loading…'} · Tap an entry to open it on the dashboard
            </p>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto bg-white dark:bg-zinc-900">
            <StandupHistoryList
              history={history}
              loading={historyLoading}
              error={historyError}
              selectedId={selectedHistoryId}
              onSelect={handleSelect}
              onRetry={onRetryHistory}
            />
          </div>
        </aside>
      </div>,
      document.body,
    )

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200/90 bg-white text-zinc-600 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        aria-label="Open standup history"
        aria-expanded={open}
      >
        <MenuIcon />
      </button>
      {drawer}
    </>
  )
}
