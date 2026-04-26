import { createFileRoute } from '@tanstack/react-router'
import { ArticleGrid } from '#/components/ppc/ArticleGrid'
import { CacheLegend } from '#/components/ppc/CacheLegend'
import { ControlRegion } from '#/components/ppc/ControlRegion'
import { HeroArticle } from '#/components/ppc/HeroArticle'
import { Newsroom } from '#/components/ppc/Newsroom'
import { PageCacheRegion } from '#/components/ppc/PageCacheRegion'
import { PPCFragmentRegion } from '#/components/ppc/PPCFragmentRegion'
import { TrendingClient } from '#/components/ppc/TrendingClient'
import { HERO_ARTICLE, LATEST_ARTICLES } from '#/data/articles'

export const Route = createFileRoute('/')({
  loader: () => ({
    hero: HERO_ARTICLE,
    latest: LATEST_ARTICLES,
  }),
  component: PpcNewsHome,
})

function PpcNewsHome() {
  const { hero, latest } = Route.useLoaderData()
  return (
    <main className="page-wrap w-full max-w-7xl px-4 pb-10 pt-8 sm:px-5">
      <p className="m-0 mb-6 text-center text-xs font-semibold tracking-[0.18em] text-[var(--kicker)] sm:text-left">
        Partial page caching (demo)
      </p>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,20rem)] lg:items-start lg:gap-10">
        <div className="min-w-0">
          <PageCacheRegion>
            <HeroArticle article={hero} />
          </PageCacheRegion>

          <PageCacheRegion>
            <h2 className="m-0 mb-4 text-xl font-bold text-[var(--sea-ink)]">Latest news</h2>
            <ArticleGrid articles={latest} />
          </PageCacheRegion>

          <ControlRegion>
            <Newsroom />
          </ControlRegion>

          <CacheLegend />
        </div>

        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <PPCFragmentRegion>
            <TrendingClient />
          </PPCFragmentRegion>
        </aside>
      </div>
    </main>
  )
}
