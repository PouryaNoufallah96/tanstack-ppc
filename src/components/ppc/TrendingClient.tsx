import { useEffect, useState } from 'react'
import { getTrending, type TrendingStory } from '#/server/trending'
import { Trending } from './Trending'

type TrendingData = { stories: TrendingStory[]; generatedAt: string }

export function TrendingClient() {
  const [data, setData] = useState<TrendingData | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    setErr(null)
    getTrending()
      .then((t) => {
        if (!cancel) setData(t)
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
  if (!data) {
    return (
      <div className="space-y-3 animate-pulse" aria-busy>
        <div className="h-6 w-40 rounded bg-[var(--line)]" />
        <div className="h-4 w-full rounded bg-[var(--line)]" />
        <div className="h-4 w-5/6 rounded bg-[var(--line)]" />
        <div className="h-4 w-full rounded bg-[var(--line)]" />
        <p className="m-0 font-mono text-xs text-[var(--sea-ink-soft)]">
          Loading from <code>getTrending</code> (client)…
        </p>
      </div>
    )
  }
  return <Trending stories={data.stories} generatedAt={data.generatedAt} />
}
