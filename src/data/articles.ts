export type Article = {
  id: string
  category: string
  headline: string
  dek: string
  byline: string
  minutesAgo: number
}

/** Hero + one column of latest; minutesAgo is fixed in seed (not Date.now) per demo spec */
export const HERO_ARTICLE: Article = {
  id: 'hero-1',
  category: 'World',
  headline: 'Leaders open summit with climate framework vote',
  dek:
    'Diplomats are weighing a new outline that could set targets for the next review cycle, even as key details stay unresolved.',
  byline: 'Morgan Ellis',
  minutesAgo: 18,
}

export const LATEST_ARTICLES: Article[] = [
  {
    id: 'lat-1',
    category: 'Markets',
    headline: 'Energy futures tick higher on supply data',
    dek: 'Traders are parsing weekly inventories and forward curves.',
    byline: 'Dana Cho',
    minutesAgo: 26,
  },
  {
    id: 'lat-2',
    category: 'Tech',
    headline: 'Chipmakers post mixed outlooks in earnings wave',
    dek: 'Analysts focus on data-center demand and export rules.',
    byline: 'Iris Nkrumah',
    minutesAgo: 32,
  },
  {
    id: 'lat-3',
    category: 'Health',
    headline: 'Trial readout spurs questions on long-term use',
    dek: 'Primary endpoint met, but safety monitoring will continue.',
    byline: 'Sofia Peralta',
    minutesAgo: 41,
  },
  {
    id: 'lat-4',
    category: 'Sports',
    headline: 'Late goal sends tiebreaker to a packed stadium',
    dek: 'Coaches call it a “character win” in post-match pressers.',
    byline: 'Jules Okonkwo',
    minutesAgo: 55,
  },
  {
    id: 'lat-5',
    category: 'Design',
    headline: 'City unveils a waterfront promenade pilot',
    dek: 'Planners will measure foot traffic and stormwater capture.',
    byline: 'Ava Lindstrom',
    minutesAgo: 63,
  },
  {
    id: 'lat-6',
    category: 'Space',
    headline: 'Agency names next crew for station rotation',
    dek: 'Training timelines shift slightly after a hardware swap.',
    byline: 'Ravi Menon',
    minutesAgo: 71,
  },
]
