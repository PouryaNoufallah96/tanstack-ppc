# Partial page caching (PPC)

TanStack Start + React Server Components, with a local [**CDN simulator**](cdn-simulator.mjs) (reverse proxy) that mimics CDN caching (`Cache-Control`, `Vary`, `Cache-Tag`) and a **news-site-style** home page ([`src/routes/index.tsx`](src/routes/index.tsx)) for recordings.

Three things you can show on camera:

1. **Page cache vs PPC fragment.** The hero + latest grid are SSR'd in the document HTML; the **trending** sidebar is a separate `GET /_serverFn/<id>` request with its own `Cache-Control` and `Cache-Tag`, so it can be invalidated independently of the page.
2. **Real RSC fragments.** The trending server function returns a `renderServerComponent(...)` renderable, so what flows over the wire is a **React Flight stream**, not JSON. The client embeds the rendered tree directly.
3. **Pay-for-what-you-render JS.** Each trending tile picks `BasicStory` (server-only, no JS) or `InteractiveStory` (`'use client'`, with a button). The InteractiveStory chunk is **only** fetched by the browser when the Flight stream contains at least one interactive tile.

## Quick start

```bash
pnpm install
```

**Local development** (HMR, no proxy):

```bash
pnpm dev
```

App: `http://localhost:3000`

**Production-style demo** (stable caching — use this when filming cache hits/misses):

```bash
pnpm demo
```

This runs, in order: `pnpm build` → Vite preview on **:3000** → [`cdn-simulator.mjs`](cdn-simulator.mjs) on **:8080**. Open the app through the simulator:

- **App:** [http://localhost:8080/](http://localhost:8080/) (PPC home)
- **Cache visualizer:** [http://localhost:8080/__cache/view](http://localhost:8080/__cache/view)

The home route is **server-rendered**: hero and latest news come from the route loader. The **trending** block is a separate **RSC fragment** — [`TrendingClient`](src/components/ppc/TrendingClient.tsx) calls `getTrending` after hydration (`GET /_serverFn/…` in DevTools), and the response is a Flight stream from [`renderServerComponent(<Trending …/>)`](src/server/trending.tsx). Its own `Cache-Control` + `Cache-Tag` make it independently cacheable / purgable. Purge actions in the newsroom panel call the simulator on port 8080 (or same-origin when you are already on `:8080`). Stop both servers with **Ctrl+C**.

**Manual** (same as `pnpm demo`, but two terminals):

```bash
pnpm build
pnpm preview    # :3000
pnpm cdn        # or pnpm proxy — :8080 in another terminal
```

## Scripts

| Command | What it does |
|--------|----------------|
| `pnpm dev` | Vite dev server on port 3000 |
| `pnpm build` | Production build (RSC, client, SSR, Nitro) |
| `pnpm preview` | Serves the built app on port 3000 |
| `pnpm cdn` / `pnpm proxy` | Starts [`cdn-simulator.mjs`](cdn-simulator.mjs) (port 8080 → origin 3000) |
| `pnpm demo` | [`scripts/ppc-demo.mjs`](scripts/ppc-demo.mjs): build + preview + `cdn-simulator` |
| `pnpm add-basic-story "…"` | [`scripts/add-story.mjs`](scripts/add-story.mjs) with `STORY_TYPE=basic`: `POST /publish-trending` adds a `basic` story (rendered server-only by [`BasicStory`](src/components/ppc/BasicStory.tsx) — no JS for that tile). Then **also purges the CDN tag `trending`** on :8080 so the next `GET /_serverFn/<id>` is a MISS. Set `SKIP_EDGE_PURGE=1` to skip the purge — handy for showing stale-edge → manual-purge on camera. `ORIGIN` / `PURGE_ORIGIN` pin URLs. |
| `pnpm add-interactive-story "…"` | Same as above with `STORY_TYPE=interactive`: adds an `interactive` story (rendered by [`InteractiveStory`](src/components/ppc/InteractiveStory.tsx), which is `'use client'` and has a `More info…` button). The browser lazy-loads the InteractiveStory chunk via the RSC Flight stream **only** when at least one story is interactive. `SKIP_EDGE_PURGE=1` is supported here too. |
| `pnpm test` | Vitest (no tests in the repo yet) |

## What’s what

- **[`cdn-simulator.mjs`](cdn-simulator.mjs)** — dependency-free `node:http` **CDN simulator** (reverse proxy). Simulates a **shared edge CDN**: honors `no-store` / `private` / `s-maxage=0`, prefers `s-maxage` and `max-age` when they imply a positive TTL, and when the origin is silent (or only sends `max-age=0` on public HTML) applies **default edge TTLs** (e.g. long for `/assets/…` fingerprints, 300s for HTML). Purge still works with origin + synthetic tags (`edge-cdn`, `html`, `static`, …). Not production-grade.
- **`/`** (home) — page-cached regions (hero + latest) with labeled borders, an **RSC fragment** for trending, and a **newsroom** control panel for publish + CDN purge. Route: [`src/routes/index.tsx`](src/routes/index.tsx). Publish API: [`src/routes/__newsroom/publish-trending.ts`](src/routes/__newsroom/publish-trending.ts) (HTTP path **`POST /publish-trending`**, accepts `{ headline?, type? }`).
- **Trending RSC pipeline** — [`getTrending`](src/server/trending.tsx) is a `GET` server function that calls `renderServerComponent(<Trending …/>)`, sets `Cache-Control: max-age=0, s-maxage=30` and `Cache-Tag: trending, homepage`, and returns the renderable so the framework streams a Flight payload. [`TrendingClient`](src/components/ppc/TrendingClient.tsx) calls it from `useEffect` and embeds the result with `{Trending}` — no `createFromReadableStream` on the client, no separate decoder chunk.
- **Vite** — [`vite.config.ts`](vite.config.ts) enables TanStack Start with `@vitejs/plugin-rsc` and `tanstackStart({ rsc: { enabled: true } })`.

### Trending stories: basic vs interactive

Each entry in the trending list has a `type` field:

- **`basic`** → renders with [`BasicStory`](src/components/ppc/BasicStory.tsx). No `'use client'`, no JS shipped to the browser for that tile.
- **`interactive`** → renders with [`InteractiveStory`](src/components/ppc/InteractiveStory.tsx). `'use client'`, with a `More info…` button. Its chunk is **only** fetched by the browser when the Flight stream contains at least one interactive tile.

Seed stories are `basic`; `pnpm add-interactive-story "…"` produces `interactive` stories. With seed-only data, no `trending-*.js` chunk is fetched. After publishing one interactive story, the chunk shows up in DevTools → Network alongside the next `GET /_serverFn/<id>` request — and stays out of the bundle for pages that don't need it.

### Cache invalidation flow

- `getTrending` sets `Cache-Tag: trending, homepage`.
- `pnpm add-{basic,interactive}-story "…"` calls `POST /publish-trending` (mutates the in-memory list) and then `POST /__cache/purge` with `{ tag: 'trending' }` against the simulator. Set `SKIP_EDGE_PURGE=1` to skip the purge.
- The in-app **Newsroom** panel exposes the same actions: a **publish** button (always `interactive`) and **Purge "trending" tag** / **Purge all** against the simulator.
- After a purge, the **next** `GET /_serverFn/<id>` is a `MISS` (returns the new list). Subsequent reloads HIT for ≤ 30s (`s-maxage`), then expire and MISS again. That's the whole demo.

## Project layout

```
src/routes/                       File-based routes (__root, index, __newsroom/publish-trending)
src/components/ppc/               News UI + region frames
  Trending.tsx                    Picks BasicStory or InteractiveStory per `story.type`
  BasicStory.tsx                  Server-only tile (no JS in the client bundle)
  InteractiveStory.tsx            'use client' tile with the `More info…` button
  TrendingClient.tsx              Calls getTrending() and embeds the renderable
  PageCacheRegion / PPCFragmentRegion / ControlRegion / CacheLegend / Newsroom
src/data/                         Static article seed (HERO_ARTICLE, LATEST_ARTICLES)
src/server/trending.tsx           Trending state + `getTrending` (renderServerComponent + Cache-Tag)
src/styles/ppc.css                PPC border variables (imported from styles.css)
cdn-simulator.mjs                 Local CDN simulator (port 8080)
scripts/ppc-demo.mjs              One-command build + preview + cdn-simulator
scripts/add-story.mjs             POSTs /publish-trending with STORY_TYPE, then purges the edge
```

Generated: `src/routeTree.gen.ts` (do not edit by hand).

## Styling

[Tailwind CSS v4](https://tailwindcss.com/) via `@tailwindcss/vite`. Global styles: [`src/styles.css`](src/styles.css), including [`src/styles/ppc.css`](src/styles/ppc.css) for PPC demo frames.

## Testing

[Vitest](https://vitest.dev/) is configured; there are no `*.test`/`*.spec` files yet. `pnpm test` will exit with “no test files” until you add some.

## Learn more

- [TanStack Start](https://tanstack.com/start)
- [TanStack Router](https://tanstack.com/router)
- [TanStack Start — Server components](https://tanstack.com/start/latest/docs/framework/react/guide/server-components)
- [TanStack Start — Server functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
