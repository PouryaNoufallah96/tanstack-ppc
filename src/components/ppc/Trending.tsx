import type { TrendingStory } from "#/server/trending";
import { BasicStory } from "./BasicStory";
import { InteractiveStory } from "./InteractiveStory";

type Props = {
  stories: TrendingStory[];
  generatedAt: string;
};

export function Trending({ stories, generatedAt }: Props) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="m-0 text-xl font-bold text-(--sea-ink)">Trending</h2>
        <span
          className="inline-block h-2 w-2 animate-pulse rounded-full bg-(--ppc-fragment)"
          title="“Live” for presentation only"
          aria-hidden
        />
      </div>
      <ol className="m-0 list-none space-y-3 p-0">
        {stories.map((s, i) => {
          // Interactive tiles are `'use client'` — the Flight stream only
          // references their chunk when at least one story has type
          // `'interactive'`, so the browser doesn't pay for the JS otherwise.
          const Story =
            s.type === "interactive" ? InteractiveStory : BasicStory;
          return <Story key={s.id} story={s} rank={i + 1} />;
        })}
      </ol>
      <p className="mb-0 mt-4 font-mono text-xs font-semibold text-(--sea-ink)">
        Generated at <span className="text-[11px]">{generatedAt}</span>
      </p>
      <p className="m-0 mt-1 text-xs text-(--sea-ink-soft)">
        On a <strong>cache HIT</strong> this time stays the same. After publish
        + purge, a <strong>MISS</strong> shows a new timestamp and updated rows.
      </p>
    </div>
  );
}
