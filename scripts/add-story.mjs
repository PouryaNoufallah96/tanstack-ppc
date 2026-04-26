#!/usr/bin/env node
/**
 * POSTs a new headline to the running app (in-memory TRENDING + publish counter).
 *
 * Tries several bases by default: Vite often binds ::1 only, so `127.0.0.1:3000`
 * can fail while `localhost:3000` works. With `pnpm demo`, :8080 also forwards POST
 * to the origin.
 *
 * After a successful publish, by default this also purges the **CDN simulator**
 * cache for tag `trending` so the next `getTrending` / `/_serverFn/…` is a MISS
 * (matches `Cache-Tag: trending` on the server function). Set SKIP_EDGE_PURGE=1
 * to skip (e.g. to demo stale cache until manual purge). Override with PURGE_ORIGIN
 * (single base for POST /__cache/purge) or the usual localhost/127.0.0.1/::1 :8080 fallbacks.
 *
 * Set ORIGIN to use a single app URL, e.g. ORIGIN=http://127.0.0.1:3000
 */
import process from 'node:process'

const headline = process.argv.slice(2).join(' ').trim()
if (!headline) {
  console.error('Usage: pnpm add-story "Your headline here"')
  process.exit(1)
}

const timeoutMs = 10_000
const purgeToken = process.env.PURGE_TOKEN || 'demo'

function candidateBases() {
  const o = process.env.ORIGIN?.trim()
  if (o) return [o.replace(/\/$/, '')]
  return [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://[::1]:3000',
    'http://localhost:8080',
  ]
}

function purgeBases() {
  const p = process.env.PURGE_ORIGIN?.trim()
  if (p) return [p.replace(/\/$/, '')]
  return [
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://[::1]:8080',
  ]
}

/**
 * getTrending is cached at the edge with Cache-Tag: trending — purge that tag so
 * /_serverFn/… is not left stale after publish.
 */
async function purgeTrendingAtEdge() {
  if (process.env.SKIP_EDGE_PURGE === '1' || process.env.SKIP_EDGE_PURGE === 'true') {
    return
  }
  const tried = []
  for (const base of purgeBases()) {
    try {
      const res = await fetch(`${base}/__cache/purge`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-purge-token': purgeToken,
        },
        body: JSON.stringify({ tag: 'trending' }),
        signal: AbortSignal.timeout(timeoutMs),
      })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        const n = data?.purged ?? 0
        console.error(
          `Edge: purged ${n} ${n === 1 ? 'entry' : 'entries'} for tag "trending" (${base}) — next getTrending should MISS`,
        )
        return
      }
      tried.push(`${base} → HTTP ${res.status}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      tried.push(`${base} → ${msg}`)
    }
  }
  console.error(
    'Note: could not reach CDN simulator to purge tag "trending". The origin was updated, but /_serverFn/… may still be a cached HIT at :8080 until you purge (Newsroom) or set PURGE_ORIGIN. Tried:',
  )
  for (const t of tried) console.error(`  ${t}`)
}

const bases = candidateBases()
const attempts = []

for (const base of bases) {
  try {
    const res = await fetch(`${base}/publish-trending`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ headline }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const data = await res.json().catch(() => null)
    if (res.ok && data?.ok && data.story) {
      console.log(`#${data.number} — ${data.story.headline}`)
      await purgeTrendingAtEdge()
      process.exit(0)
    }
    attempts.push(`${base} → HTTP ${res.status} ${data ? JSON.stringify(data) : ''}`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    attempts.push(`${base} → ${msg}`)
  }
}

console.error('Could not POST /publish-trending. Tried:')
for (const a of attempts) console.error(`  ${a}`)
console.error(
  'Start the app (pnpm dev, pnpm preview, or pnpm demo). If it runs but this still fails, set ORIGIN explicitly.',
)
process.exit(1)
