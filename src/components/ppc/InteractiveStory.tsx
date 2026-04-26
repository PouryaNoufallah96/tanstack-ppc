"use client";

import type { TrendingStory } from "#/server/trending";

type Props = {
  story: TrendingStory;
  rank: number;
};

export function InteractiveStory({ story, rank }: Props) {
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
        <button
          type="button"
          onClick={() => alert("clicked")}
          className="mt-2 rounded border border-(--line) bg-(--chip-bg) px-2 py-0.5 font-mono text-[10px] text-(--sea-ink) hover:bg-(--link-bg-hover)"
        >
          More info...
        </button>
      </div>
    </li>
  );
}
