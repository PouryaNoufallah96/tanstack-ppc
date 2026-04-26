import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getTrending } from '#/server/trending'

export function TrendingClient() {
  const [rsc, setRsc] = useState<ReactNode | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    setErr(null)
    getTrending()
      .then(({ Trending }) => {
        if (!cancel) setRsc(Trending as ReactNode)
      })
      .catch((e: unknown) => {
        if (!cancel) {
          setErr(e instanceof Error ? e.message : 'Failed to load trending')
        }
      })
    return () => {
      cancel = true
    }
  }, [])

  if (err) {
    return (
      <p className="m-0 text-sm text-red-600 dark:text-red-400" role="alert">
        {err}
      </p>
    )
  }
  if (!rsc) {
    return (
      <div className="space-y-3 animate-pulse" aria-busy>
        <div className="h-6 w-40 rounded bg-[var(--line)]" />
        <div className="h-4 w-full rounded bg-[var(--line)]" />
        <div className="h-4 w-5/6 rounded bg-[var(--line)]" />
        <div className="h-4 w-full rounded bg-[var(--line)]" />
        <p className="m-0 font-mono text-xs text-[var(--sea-ink-soft)]">
          Loading RSC from <code>getTrending</code> (Flight stream)…
        </p>
      </div>
    )
  }
  return <>{rsc}</>
}
