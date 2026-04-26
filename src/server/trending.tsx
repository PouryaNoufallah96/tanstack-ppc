import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
import { setResponseHeader } from '@tanstack/react-start/server'

import { Trending } from '#/components/ppc/Trending'

/**
 * `'basic'` renders with a server-only `BasicStory` (no JS shipped to the
 * client for that tile). `'interactive'` renders with a `'use client'`
 * `InteractiveStory`; its chunk only loads in the browser when the Flight
 * stream references it (i.e. at least one story has this type).
 */
export type TrendingStoryType = 'basic' | 'interactive'

export type TrendingStory = {
  id: string
  headline: string
  byline: string
  minutesAgo: number
  type: TrendingStoryType
}

const seed: TrendingStory[] = [
  {
    id: 't-1',
    headline: 'Shippers brace for a busy week at major ports',
    byline: 'Elena Park',
    minutesAgo: 8,
    type: 'basic',
  },
  {
    id: 't-2',
    headline: 'City council to revisit zoning near transit hubs',
    byline: 'Omar Haddad',
    minutesAgo: 12,
    type: 'basic',
  },
  {
    id: 't-3',
    headline: 'Analysts trim forecasts after surprise inventory data',
    byline: 'Nina Voss',
    minutesAgo: 19,
    type: 'basic',
  },
  {
    id: 't-4',
    headline: 'League issues guidance on new injury protocols',
    byline: 'Cam Weber',
    minutesAgo: 24,
    type: 'basic',
  },
  {
    id: 't-5',
    headline: 'Lab showcases a low-power display prototype',
    byline: 'Priya Iyer',
    minutesAgo: 31,
    type: 'basic',
  },
]

/** Shared across duplicate Nitro/RSC+SSR bundle copies of this module. */
const TRENDING_STATE = Symbol.for('ppc.trendingState.v2')
type TrendingState = { list: TrendingStory[]; publishCounter: number }

function getTrendingState(): TrendingState {
  const w = globalThis as typeof globalThis & { [k: symbol]: TrendingState | undefined }
  if (!w[TRENDING_STATE]) {
    const list = [...seed]
    w[TRENDING_STATE] = { list, publishCounter: list.length }
  }
  return w[TRENDING_STATE]!
}

const MAX_HEADLINE_LEN = 500

export function publishTrendingStory(
  input?: { headline?: string | null; type?: TrendingStoryType | null },
): { story: TrendingStory; number: number } {
  const s = getTrendingState()
  s.publishCounter += 1
  const t = new Date()
  const hh = String(t.getHours()).padStart(2, '0')
  const mm = String(t.getMinutes()).padStart(2, '0')
  const ss = String(t.getSeconds()).padStart(2, '0')
  const custom = input?.headline?.trim()
  const headline =
    custom && custom.length > 0
      ? custom.slice(0, MAX_HEADLINE_LEN)
      : `Breaking: Story #${s.publishCounter} at ${hh}:${mm}:${ss}`
  const type: TrendingStoryType = input?.type === 'basic' ? 'basic' : 'interactive'
  const story: TrendingStory = {
    id: `t-${Date.now()}`,
    headline,
    byline: 'Wire Desk',
    minutesAgo: 0,
    type,
  }
  s.list = [story, ...s.list]
  return { story, number: s.publishCounter }
}

/**
 * Returns an RSC renderable for {@link Trending}. The TanStack Start serializer
 * carries the Flight payload from server to client; the route component embeds
 * the renderable directly with `{Trending}` — no client-side decode helper.
 */
export const getTrending = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'max-age=0, s-maxage=30')
  setResponseHeader('Cache-Tag', 'trending, homepage')
  const generatedAt = new Date().toISOString()
  return {
    Trending: await renderServerComponent(
      <Trending stories={getTrendingState().list} generatedAt={generatedAt} />,
    ),
  }
})
