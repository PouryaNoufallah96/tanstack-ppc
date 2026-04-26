import type { TrendingStory } from '#/server/trending'

type Props = {
  stories: TrendingStory[]
  generatedAt: string
}

export function Trending({ stories, generatedAt }: Props) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="m-0 text-xl font-bold text-[var(--sea-ink)]">Trending</h2>
        <span
          className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--ppc-fragment)]"
          title="“Live” for presentation only"
          aria-hidden
        />
      </div>
      <ol className="m-0 list-none space-y-3 p-0">
        {stories.map((s, i) => (
          <li
            key={s.id}
            className="flex gap-3 border-b border-[var(--line)] border-dotted pb-3 last:border-0"
          >
            <span
              className="mt-0.5 w-6 shrink-0 text-right font-mono text-sm font-bold text-[var(--ppc-fragment)]"
            >
              {i + 1}
            </span>
            <div>
              <p className="m-0 font-semibold text-[var(--sea-ink)]">{s.headline}</p>
              <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
                {s.byline} · {s.minutesAgo} min ago
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mb-0 mt-4 font-mono text-xs font-semibold text-[var(--sea-ink)]">
        Generated at <span className="text-[11px]">{generatedAt}</span>
      </p>
      <p className="m-0 mt-1 text-xs text-[var(--sea-ink-soft)]">
        On a <strong>cache HIT</strong> this time stays the same. After publish + purge, a{' '}
        <strong>MISS</strong> shows a new timestamp and updated rows.
      </p>
    </div>
  )
}
