import {
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent,
} from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getAuthErrorMessage } from '../lib/authErrors'
import { generateStandup } from '../lib/generateStandup'
import { formatStandupDisplay } from '../lib/formatStandup'
import {
  fetchStandupHistory,
  getStandupSaveErrorMessage,
  saveStandup,
} from '../lib/standups'
import { DashboardMenu } from '../components/dashboard/DashboardMenu'
import { DashboardSettings } from '../components/dashboard/DashboardSettings'
import { LogOutIcon, SettingsIcon } from '../components/dashboard/icons'
import { LoadingSpinner } from '../components/dashboard/LoadingSpinner'
import type { Standup } from '../types/database'
import type { GenerateStandupResponse } from '../types/standup'

const iconBtn =
  'inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200/90 bg-white text-zinc-600 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'

const card =
  'rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm ring-1 ring-zinc-950/5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900 dark:ring-white/5'

function standupToFormatted(record: Standup): string {
  return formatStandupDisplay({
    summary: record.summary ?? '',
    yesterday: record.yesterday ?? '',
    today: record.today ?? '',
    blockers: record.blockers ?? '',
  })
}

export function Dashboard() {
  const { session, signOut } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  const [notes, setNotes] = useState('')
  const [generatedStandup, setGeneratedStandup] = useState<string | null>(null)
  const [generateMeta, setGenerateMeta] = useState<
    GenerateStandupResponse['meta'] | null
  >(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [saveWarning, setSaveWarning] = useState<string | null>(null)

  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [autoFetchGitHub, setAutoFetchGitHub] = useState(false)

  const [history, setHistory] = useState<Standup[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(
    null,
  )

  const loadHistory = useCallback(async () => {
    const token = session?.access_token
    if (!token) return
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const rows = await fetchStandupHistory(token)
      setHistory(rows)
    } catch (err) {
      setHistoryError(
        err instanceof Error ? err.message : 'Could not load standup history.',
      )
    } finally {
      setHistoryLoading(false)
    }
  }, [session?.access_token])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  async function handleSignOut() {
    setError(null)
    setSigningOut(true)
    try {
      await signOut()
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setSigningOut(false)
    }
  }

  function handleSelectHistory(record: Standup) {
    setSelectedHistoryId(record.id)
    setGeneratedStandup(standupToFormatted(record))
    setGenerateMeta(null)
    setGenerateError(null)
    setSaveWarning(null)
    if (record.raw_notes) setNotes(record.raw_notes)
  }

  function openMenu() {
    setMenuOpen(true)
    setSettingsOpen(false)
    loadHistory()
  }

  function handleGoHome() {
    setNotes('')
    setGeneratedStandup(null)
    setGenerateMeta(null)
    setGenerateError(null)
    setSaveWarning(null)
    setSelectedHistoryId(null)
    setMenuOpen(false)
    setSettingsOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    requestAnimationFrame(() => {
      document.getElementById('standup-notes')?.focus()
    })
  }

  const handleGenerateStandup = useCallback(async () => {
    const token = session?.access_token
    if (!token) {
      setGenerateError('You must be signed in to generate a standup.')
      return
    }

    setGenerateError(null)
    setSaveWarning(null)
    setIsGenerating(true)
    setGeneratedStandup(null)
    setGenerateMeta(null)
    setSelectedHistoryId(null)

    try {
      const result = await generateStandup(notes, {
        autoFetchGitHub,
        accessToken: token,
      })

      setGeneratedStandup(result.formatted)
      setGenerateMeta(result.meta)

      if (result.saved) {
        setSelectedHistoryId(result.saved.id)
        await loadHistory()
      } else if (result.saveError) {
        setSaveWarning(
          `Standup generated, but it could not be saved to history. ${result.saveError}`,
        )
        if (session?.access_token) {
          try {
            const saved = await saveStandup(
              session.access_token,
              notes,
              result.standup,
            )
            setSelectedHistoryId(saved.id)
            setSaveWarning(null)
            await loadHistory()
          } catch (saveErr) {
            setSaveWarning(
              `Standup generated, but it could not be saved to history. ${getStandupSaveErrorMessage(saveErr)}`,
            )
          }
        }
      }
    } catch (err) {
      setGeneratedStandup(null)
      setGenerateMeta(null)
      setGenerateError(
        err instanceof Error
          ? err.message
          : 'Could not generate standup. Please try again.',
      )
    } finally {
      setIsGenerating(false)
    }
  }, [session?.access_token, notes, autoFetchGitHub, loadHistory])

  function handleNotesKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    if (isGenerating) return
    void handleGenerateStandup()
  }

  return (
    <div className="flex min-h-svh flex-col bg-gradient-to-b from-zinc-100 via-zinc-50 to-zinc-100 text-zinc-800 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900 dark:text-zinc-200">
      <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/95 pt-[env(safe-area-inset-top)] shadow-sm backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto grid w-full max-w-3xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 px-3 py-3 sm:gap-x-3 sm:px-6">
          <DashboardMenu
            open={menuOpen}
            onOpen={openMenu}
            onClose={() => setMenuOpen(false)}
            history={history}
            historyLoading={historyLoading}
            historyError={historyError}
            selectedHistoryId={selectedHistoryId}
            onSelectStandup={handleSelectHistory}
            onRetryHistory={loadHistory}
          />

          <button
            type="button"
            onClick={handleGoHome}
            className="flex min-w-0 cursor-pointer items-center justify-center gap-2 rounded-xl px-1.5 py-1 transition hover:bg-zinc-100/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 active:scale-[0.98] sm:justify-start sm:px-2 dark:hover:bg-zinc-800/80"
            aria-label="Smart Daily Standup — start a new standup"
            title="New standup"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-violet-700 text-sm font-bold text-white shadow-sm sm:size-9">
              S
            </span>
            <span className="hidden max-w-[10rem] truncate text-xs font-semibold tracking-tight text-zinc-900 min-[360px]:inline sm:max-w-none sm:text-sm dark:text-zinc-100">
              Smart Daily Standup
            </span>
          </button>

          <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
            <div className="relative">
              <button
                type="button"
                data-settings-trigger
                onClick={() => {
                  setSettingsOpen((open) => !open)
                  setMenuOpen(false)
                }}
                className={iconBtn}
                aria-label="Settings"
                aria-expanded={settingsOpen}
              >
                <SettingsIcon />
              </button>
              <DashboardSettings
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                autoFetchGitHub={autoFetchGitHub}
                onAutoFetchGitHubChange={setAutoFetchGitHub}
              />
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200/90 bg-white px-2.5 text-xs font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-50 sm:gap-2 sm:px-3.5 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
            >
              <LogOutIcon className="size-3.5 sm:size-4" />
              {signingOut ? 'Signing out…' : 'Log out'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-3 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:space-y-6 sm:px-6 sm:py-8">
        {error && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
            role="alert"
          >
            {error}
          </div>
        )}

        <section className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Your standup hub
          </h1>
          <p className="max-w-prose text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-base">
            Write what you did and what you plan next. Enable GitHub in Settings
            for commit-backed standups, or open History to revisit past entries.
          </p>
        </section>

        <section className={card}>
          <label
            htmlFor="standup-notes"
            className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Daily notes
          </label>
          <textarea
            id="standup-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onKeyDown={handleNotesKeyDown}
            placeholder="What did you work on today?"
            rows={6}
            disabled={isGenerating}
            aria-busy={isGenerating}
            className="mb-4 min-h-[160px] w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-base leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none disabled:opacity-60 sm:min-h-[220px] sm:px-4 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-violet-400"
          />
          <button
            type="button"
            onClick={() => void handleGenerateStandup()}
            disabled={isGenerating}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-violet-700 px-4 py-3 text-sm font-semibold leading-normal text-white shadow-md shadow-violet-600/25 transition hover:from-violet-700 hover:to-violet-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[3rem] sm:w-auto sm:min-w-[240px] sm:text-base"
          >
            {isGenerating && (
              <span
                className="size-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white"
                aria-hidden="true"
              />
            )}
            {isGenerating ? 'Generating standup…' : 'Generate Standup'}
          </button>
        </section>

        <section className={card}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
            <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              AI-generated standup
            </h2>
            {generateMeta?.usedGitHub && (
              <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                GitHub · {generateMeta.githubCommitCount} commit
                {generateMeta.githubCommitCount === 1 ? '' : 's'} (
                {generateMeta.githubFetchReason === 'auto-toggle'
                  ? 'auto'
                  : 'keywords'}
                )
              </span>
            )}
          </div>

          {generateError && (
            <div
              className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
              role="alert"
            >
              {generateError}
            </div>
          )}

          {saveWarning && (
            <div
              className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
              role="status"
            >
              {saveWarning}
            </div>
          )}

          {generateMeta?.aiWarning && (
            <div
              className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
              role="status"
            >
              {generateMeta.aiWarning}
            </div>
          )}

          {isGenerating ? (
            <LoadingSpinner label="Generating your standup…" />
          ) : generatedStandup ? (
            <pre className="overflow-x-auto rounded-xl border border-zinc-100 bg-zinc-50/80 p-4 font-sans text-sm leading-relaxed break-words whitespace-pre-wrap text-zinc-800 sm:p-5 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-200">
              {generatedStandup}
            </pre>
          ) : (
            <p className="rounded-xl border border-dashed border-zinc-200/90 bg-zinc-50/60 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-400">
              Your generated standup will appear here after you click{' '}
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                Generate Standup
              </span>
              .
            </p>
          )}
        </section>

      </main>
    </div>
  )
}
