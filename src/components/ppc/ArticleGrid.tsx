import type { Article } from '#/data/articles'

type Props = { articles: Article[] }

export function ArticleGrid({ articles }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {articles.map((a) => (
        <article
          key={a.id}
          className="overflow-hidden rounded-lg border border-(--line) bg-(--surface-strong) p-3"
        >
          <div
            className="mb-2 flex h-20 items-center justify-center rounded border border-dashed border-(--line) text-center"
            style={{
              background: `linear-gradient(160deg, color-mix(in oklab, var(--ppc-page) 12%, var(--surface)) 0%, var(--surface) 100%)`,
            }}
          >
            <span className="px-1 font-mono text-[10px] font-semibold text-(--sea-ink-soft)">
              {a.category}
            </span>
          </div>
          <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-(--kicker)">
            {a.category}
          </p>
          <h2 className="m-0 mt-1 text-lg font-bold leading-snug text-(--sea-ink)">
            {a.headline}
          </h2>
          <p className="m-0 mt-1 line-clamp-2 text-sm text-(--sea-ink-soft)">{a.dek}</p>
          <p className="m-0 mt-2 text-xs text-(--sea-ink-soft)">
            {a.byline} · {a.minutesAgo} min ago
          </p>
        </article>
      ))}
    </div>
  )
}
