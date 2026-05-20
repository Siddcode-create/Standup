type LoadingSpinnerProps = {
  label?: string
  className?: string
}

export function LoadingSpinner({
  label = 'Loading…',
  className = '',
}: LoadingSpinnerProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-8 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span
        className="size-9 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600 dark:border-violet-900 dark:border-t-violet-400"
        aria-hidden="true"
      />
      <span className="text-sm text-zinc-500 dark:text-zinc-400">{label}</span>
    </div>
  )
}
