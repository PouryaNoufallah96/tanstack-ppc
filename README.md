# Partial page caching (PPC)

TanStack Start + React Server Components, with a local [**CDN simulator**](cdn-simulator.mjs) (reverse proxy) that mimics CDN caching (`Cache-Control`, `Vary`, `Cache-Tag`) and a **news-site-style** home page ([`src/routes/index.tsx`](src/routes/index.tsx)) for recordings. `/ppc-demo` **redirects** to `/` for old links.

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
- **Cache visualizer:** [http://localhost:8080/__cache/view](http://localhost:8080/__cache/view) (send header `X-Purge-Token: demo`)

The home route is **server-rendered**: hero and latest news come from the route loader. The **trending** block is **client-only** — it fetches with the `getTrending` GET server function after hydration (`GET /_serverFn/…` in DevTools), with its own `Cache-Control` + `Cache-Tag`. Purge actions in the newsroom panel call the simulator on port 8080 (or same-origin when you are already on `:8080`). Stop both servers with **Ctrl+C**.

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
| `pnpm add-story "…"` | [`scripts/add-story.mjs`](scripts/add-story.mjs): `POST /publish-trending` with a custom headline, then (unless `SKIP_EDGE_PURGE=1`) purges the CDN tag **`trending`** on :8080 so `getTrending` / `/_serverFn/…` is not left stale. Tries the same app bases as before; set `ORIGIN` / `PURGE_ORIGIN` to pin URLs. `PURGE_TOKEN` matches [`cdn-simulator.mjs`](cdn-simulator.mjs) (default `demo`). |
| `pnpm test` | Vitest (no tests in the repo yet) |

## What’s what

- **[`cdn-simulator.mjs`](cdn-simulator.mjs)** — dependency-free `node:http` **CDN simulator** (reverse proxy). Simulates a **shared edge CDN**: honors `no-store` / `private` / `s-maxage=0`, prefers `s-maxage` and `max-age` when they imply a positive TTL, and when the origin is silent (or only sends `max-age=0` on public HTML) applies **default edge TTLs** (e.g. long for `/assets/…` fingerprints, 300s for HTML). Purge still works with origin + synthetic tags (`edge-cdn`, `html`, `static`, …). Not production-grade.
- **`/`** (home) — same news **page-cached regions** (hero + latest) with labeled borders, **`getTrending`** (client call) for trending (JSON + `generatedAt` for HIT/MISS proof), and **newsroom** publish + CDN-simulator purge. Route: [`src/routes/index.tsx`](src/routes/index.tsx). Publish API: [`src/routes/__newsroom/publish-trending.ts`](src/routes/__newsroom/publish-trending.ts) (HTTP path **`POST /publish-trending`**). [`src/routes/ppc-demo.tsx`](src/routes/ppc-demo.tsx) only redirects to `/`.
- **Vite** — [`vite.config.ts`](vite.config.ts) enables TanStack Start with `@vitejs/plugin-rsc` and `tanstackStart({ rsc: { enabled: true } })`.

## Project layout

```
src/routes/           File-based routes (__root, index, about, ppc-demo, __newsroom/…)
src/components/       Header, Footer, ThemeToggle, ppc/* (news UI + region frames)
src/data/             Static article seed data
src/server/           getTrending + in-memory trending store
src/styles/ppc.css    PPC border variables (imported from styles.css)
cdn-simulator.mjs     Local CDN simulator (port 8080)
scripts/ppc-demo.mjs  One-command build + preview + cdn-simulator
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
