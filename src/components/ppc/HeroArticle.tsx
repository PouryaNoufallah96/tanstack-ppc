import type { Article } from '#/data/articles'

type Props = { article: Article }

export function HeroArticle({ article }: Props) {
  return (
    <article>
      <p className="m-0 mb-2 text-xs font-bold tracking-[0.2em] text-(--kicker)">
        {article.category.toUpperCase()}
      </p>
      <h1 className="display-title m-0 mb-3 text-[2rem] font-bold leading-tight text-(--sea-ink) sm:text-[32px]">
        {article.headline}
      </h1>
      <p className="m-0 mb-4 text-base text-(--sea-ink-soft)">{article.dek}</p>
      <p className="m-0 mb-5 text-sm text-(--sea-ink-soft)">
        {article.byline} · {article.minutesAgo} min ago
      </p>
      <div
        className="flex h-40 items-center justify-center rounded-lg border border-dashed border-(--line) text-center"
        style={{
          background: `linear-gradient(135deg, color-mix(in oklab, var(--ppc-page) 22%, var(--surface)) 0%, var(--surface-strong) 100%)`,
        }}
      >
        <span
          className="px-2 font-mono text-sm font-bold uppercase text-(--sea-ink-soft)"
        >
          {article.category} · hero placeholder
        </span>
      </div>
    </article>
  )
}
