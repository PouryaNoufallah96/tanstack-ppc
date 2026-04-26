# Current State

This project is a TanStack Start demo app for **partial page caching** with React Server Components and a local **CDN simulator** ([`cdn-simulator.mjs`](cdn-simulator.mjs)).

## Application

- TanStack Start app with file-based routing in `src/routes`.
- React Server Components are enabled in `vite.config.ts` through `@vitejs/plugin-rsc` and `tanstackStart({ rsc: { enabled: true } })`.
- Main demo route: [`src/routes/index.tsx`](src/routes/index.tsx) — **news-site style** layout (hero, latest grid, trending, newsroom, cache legend) on the home page.
- [`src/routes/ppc-demo.tsx`](src/routes/ppc-demo.tsx) **redirects** to `/` for old bookmarks.
- Global shell lives in `src/routes/__root.tsx`.
- The root shell in `__root.tsx` has **no** top nav; `Header.tsx` is unused. `Footer` includes `ThemeToggle` for light/dark.

## PPC / news demo

- **Page regions (visual, “page cache”)** — hero and latest grid are **SSR** from the home route loader and use [`PageCacheRegion`](src/components/ppc/PageCacheRegion.tsx) with blue dashed borders and `route: / · ttl: 300s` in the metadata strip. Content comes from [`src/data/articles.ts`](src/data/articles.ts) (fixed `minutesAgo` values, not `Date.now()`).
- **Trending (PPC fragment)** — [`getTrending`](src/server/trending.ts) is a `GET` server function that returns `{ stories, generatedAt }`, sets `Cache-Control: max-age=0, s-maxage=30` and `Cache-Tag: trending, homepage`. [`TrendingClient`](src/components/ppc/TrendingClient.tsx) calls it **in the browser** after load (not in the route loader) so the fragment stays an independent `GET /_serverFn/…` request. The UI shows **`Generated at &lt;ISO&gt;`** so a **HIT** keeps the timestamp, a **MISS** refreshes it.
- **Newsroom** — [`Newsroom.tsx`](src/components/ppc/Newsroom.tsx): `POST /publish-trending` appends a story via [`src/routes/__newsroom/publish-trending.ts`](src/routes/__newsroom/publish-trending.ts) (TanStack file routing maps this file to HTTP path **`/publish-trending`**, not `/__newsroom/...`). Purge buttons call the **CDN simulator** at `POST /__cache/purge` with `X-Purge-Token: demo` (same origin on port 8080, or `http://localhost:8080` when the app is opened on port 3000).

## CDN simulator

[`cdn-simulator.mjs`](cdn-simulator.mjs) is a dependency-free `node:http` reverse proxy (CDN behavior):

```text
Browser -> http://localhost:8080 -> http://localhost:3000
```

It implements the demo cache behavior:

- Only caches `GET` responses (with `200`, no `Set-Cookie`, no `Authorization` on the request).
- Honors `Cache-Control` when the origin returns a **positive** TTL: prefers `s-maxage`, then `max-age`. Treats **`s-maxage=0` as not storable** at the edge; `max-age=0` without a positive `s-maxage` causes **heuristic** edge TTLs (CDN-style) instead of BYPASS.
- When `Cache-Control` is missing, applies **heuristic** TTLs: long for fingerprinted assets under `/assets/`, 300s for `text/html` / extensionless app routes, 30s for `/_serverFn/…`, and merges synthetic `Cache-Tag` values such as `edge-cdn`, `html`, `static` for the dashboard / purge.
- Skips `no-store` and `private`.
- Includes `Vary` request header values in cache keys.
- Parses and stores `Cache-Tag`, then strips it from browser responses.
- Adds `X-Cache`, `X-Cache-Key`, `X-Cache-Age`, and `X-Cache-Tags`.
- Supports lazy expiry and a simple oldest-entry eviction guard.
- Logs HIT/MISS/BYPASS/PURGE lines to stdout for recording.

Control endpoints are served by the simulator (port 8080), same process as the forwarded traffic:

- `GET /__cache` returns JSON cache state.
- `POST /__cache/purge` purges by `{ "key" }`, `{ "tag" }`, or `{ "all": true }`.
- `GET /__cache/view` serves the dark-mode visualizer.

All `/__cache` endpoints require `X-Purge-Token: demo`.

## Scripts

Current package scripts:

```bash
pnpm dev       # Vite dev server on :3000
pnpm build     # Production build
pnpm preview   # Built app on :3000
pnpm cdn        # cdn-simulator.mjs on :8080 (alias: pnpm proxy)
pnpm demo      # build + preview + cdn-simulator
pnpm test      # Vitest
```

Use `pnpm demo` for the recording flow. It builds the app, starts preview on port 3000, waits for that port to open, starts `cdn-simulator` on port 8080, and shuts both down on Ctrl+C.

## Demo flow (intended)

1. Open `http://localhost:8080/` and the cache visualizer.
2. Reload — trending `getTrending` should **HIT**; `generatedAt` unchanged.
3. **Publish trending** — server data updates; **without** purging, reload can still show **cached** trending (stale `generatedAt` / old list) until the simulator’s edge entry is purged.
4. **Purge tag `trending`** (or all) — then reload — **MISS** on `getTrending`, new `generatedAt` and updated list.

## Known notes

- Use the production-style demo flow, not Vite dev mode, when filming cache behavior. Dev mode/HMR makes cache output noisy.
- Browser server-function calls include `x-tsr-serverFn: true`; direct `curl` requests to `/_serverFn/...` should include that header if you want the real serialized response body.
- `pnpm test` is configured, but there are currently no test files, so Vitest exits with “No test files found”.
- `src/routeTree.gen.ts` is generated and should not be edited manually.
- The HTML document for `/` may or may not show as **HIT** in the simulator depending on origin `Cache-Control`; the **trending** fragment is the primary on-screen + Network proof for independent caching.
