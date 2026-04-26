import type { TrendingStory } from '#/server/trending'

type Props = {
  story: TrendingStory
  rank: number
}

export function BasicStory({ story, rank }: Props) {
  return (
    <li className="flex gap-3 border-b border-(--line) border-dotted pb-3 last:border-0">
      <span className="mt-0.5 w-6 shrink-0 text-right font-mono text-sm font-bold text-(--ppc-fragment)">
        {rank}
      </span>
      <div>
        <p className="m-0 font-semibold text-(--sea-ink)">{story.headline}</p>
        <p className="m-0 text-sm text-(--sea-ink-soft)">
          {story.byline} · {story.minutesAgo} min ago
        </p>
      </div>
    </li>
  )
}
