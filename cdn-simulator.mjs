/**
 * cdn-simulator.mjs — local reverse proxy that simulates a shared CDN in front
 * of a content / app site. When the origin is silent or sends only `max-age=0` on
 * public HTML, we still apply edge-style defaults.
 * node:http only, no dependencies.
 */
import http from 'node:http'

const PROXY_PORT = 8080
const ORIGIN_HOST = 'localhost'
const ORIGIN_PORT = 3000
const MAX_ENTRIES = 1000

/** @typedef {'origin' | 'heuristic'} CdnTtlMode */

/** Long TTL for fingerprinted /assets (typical of static CDNs) */
const CDN_TTL_ASSET_S = 31_536_000
/** Shorter for HTML (news home, SPA route shells) */
const CDN_TTL_PAGE_S = 300
/** Icons, generic images with no stricter origin rule */
const CDN_TTL_IMAGE_S = 86_400
/** Fallback for rare 200s that are still cachable (fonts, etc.) */
const CDN_TTL_DEFAULT_S = 3600
/** Matches server-fns with no or zero CC */
const CDN_TTL_SRV_FN_S = 30

/** @type {Map<string, { key: string, body: Buffer, headers: Record<string, string | string[] | number>, status: number, storedAt: number, expiresAt: number, tags: string[], hits: number }>} */
const cache = new Map()

// --- key / cacheability -------------------------------------------------------

/**
 * @param {string} method
 * @param {string} url
 * @param {import('node:http').IncomingMessage} clientReq
 * @param {string | undefined} varyHeader
 */
function buildCanonicalKey(method, url, clientReq, varyHeader) {
  const base = `${method} ${url}`
  if (!varyHeader || !String(varyHeader).trim() || String(varyHeader).trim() === '*') {
    return base
  }
  const names = String(varyHeader)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  let key = base
  for (const name of names) {
    const v = getHeaderValue(clientReq, name)
    key += `|${name}=${v}`
  }
  return key
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {string} nameLower
 */
function getHeaderValue(req, nameLower) {
  const h = req.headers
  const pick =
    h[nameLower] ?? h[Object.keys(h).find((k) => k.toLowerCase() === nameLower) ?? ''] ?? ''
  if (Array.isArray(pick)) return pick.join(', ')
  return String(pick)
}

/**
 * @param {Record<string, string | string[] | undefined>} h
 */
function headerObjLower(h) {
  /** @type {Record<string, string | string[]>} */
  const o = {}
  for (const [k, v] of Object.entries(h)) {
    if (v == null) continue
    o[k.toLowerCase()] = v
  }
  return o
}

/**
 * @param {string | undefined} cc
 */
function parseCacheControlDirectives(cc) {
  if (!cc) return { noStore: false, isPrivate: false, sMaxAge: -1, maxAge: -1 }
  const s = String(cc).toLowerCase()
  const noStore = /\bno-store\b/.test(s)
  const isPrivate = /\bprivate\b/.test(s)
  const sm = s.match(/\bs-maxage=(\d+)\b/)
  const m = s.match(/\bmax-age=(\d+)\b/)
  const sMaxAge = sm ? Number(sm[1]) : -1
  const maxAge = m ? Number(m[1]) : -1
  return { noStore, isPrivate, sMaxAge, maxAge }
}

/**
 * Prefer s-maxage over max-age. Returns null when the origin has no cachable
 * directive and the caller should use CDN heuristics. Returns -1 when the
 * response must not be stored at the edge. Positive = TTL in ms.
 * @param {string | undefined} ccs
 * @returns {number | null}
 */
function originDirectiveTtlMs(ccs) {
  if (ccs == null || !String(ccs).trim()) return null
  const { sMaxAge, maxAge, noStore, isPrivate } = parseCacheControlDirectives(String(ccs))
  if (noStore || isPrivate) return -1
  if (sMaxAge >= 0) {
    if (sMaxAge === 0) return -1
    return sMaxAge * 1000
  }
  if (maxAge >= 0) {
    if (maxAge === 0) return null
    return maxAge * 1000
  }
  return null
}

/**
 * @param {import('node:http').IncomingMessage} res
 * @param {import('node:http').IncomingMessage} clientReq
 * @param {string} pathNoQuery
 * @param {string} contentType
 * @returns {number}
 */
function heuristicCdnTtlMs(res, clientReq, pathNoQuery, contentType) {
  const p = pathNoQuery || '/'
  const ct = String(contentType).toLowerCase()
  if (p.startsWith('/_serverFn/')) {
    return CDN_TTL_SRV_FN_S * 1000
  }
  if (p.startsWith('/assets/')) {
    if (/\.(m?js|css|woff2?|ttf|eot|ico|png|jpe?g|gif|svg|webp|avif|map)(?:$|\?)/i.test(p)) {
      return CDN_TTL_ASSET_S * 1000
    }
  }
  if (p === '/favicon.ico') {
    return CDN_TTL_IMAGE_S * 1000
  }
  if (ct.startsWith('image/')) {
    return CDN_TTL_IMAGE_S * 1000
  }
  if (ct.startsWith('text/html')) {
    return CDN_TTL_PAGE_S * 1000
  }
  if (
    (ct.startsWith('text/css') || ct.startsWith('text/javascript') || ct.includes('javascript')) &&
    p.startsWith('/assets/')
  ) {
    return CDN_TTL_ASSET_S * 1000
  }
  if (p === '/' || !/[.][a-z0-9]{1,8}($|\?)/i.test(p)) {
    if (!p.startsWith('/_') && !p.startsWith('/__')) {
      return CDN_TTL_PAGE_S * 1000
    }
  }
  return CDN_TTL_DEFAULT_S * 1000
}

/**
 * @param {import('node:http').IncomingMessage} res
 * @param {import('node:http').IncomingMessage} clientReq
 * @param {string} pathNoQuery
 * @param {string} contentType
 * @returns {string[]}
 */
function syntheticCdnTagsForHeuristic(pathNoQuery, contentType) {
  const p = pathNoQuery || '/'
  const ct = String(contentType).toLowerCase()
  /** @type {string[]} */
  const tags = ['edge-cdn']
  if (p.startsWith('/_serverFn/')) tags.push('server-fn')
  else if (p.startsWith('/assets/')) tags.push('static', 'assets')
  else if (p === '/favicon.ico' || ct.startsWith('image/')) tags.push('static')
  else if (ct.startsWith('text/html') || p === '/' || !/[.][a-z0-9]{1,8}($|\?)/i.test(p)) {
    if (!p.startsWith('/_') && !p.startsWith('/__')) tags.push('html', 'page')
  }
  return tags
}

/**
 * @param {string | undefined} raw
 * @returns {string[]}
 */
function parseCacheTagHeader(raw) {
  if (!raw) return []
  const parts = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return [...new Set(parts)]
}

/**
 * @param {import('node:http').IncomingMessage} res
 */
function resHeadersToLowerObject(res) {
  return headerObjLower(
    res.headers && typeof res.headers === 'object'
      ? /** @type {Record<string, string | string[] | undefined>} */ (
          res.headers
        )
      : {},
  )
}

/**
 * @param {import('node:http').IncomingMessage} res
 */
function headersObjectForStore(res) {
  return resHeadersToLowerObject(res)
}

/**
 * Shared-cache TTL for a GET 200. Returns null = forward only (BYPASS) — e.g. auth,
 * `Set-Cookie`, `no-store` / `private` / `s-maxage=0`, or unhandled status.
 * @param {import('node:http').IncomingMessage} res
 * @param {import('node:http').IncomingMessage} clientReq
 * @returns {{ ttlMs: number, cdnTtl: CdnTtlMode, pathNoQuery: string, contentType: string } | null}
 */
function getCdnTtlInfo(res, clientReq) {
  if ((clientReq.method || 'GET').toUpperCase() !== 'GET') return null
  if ((res.statusCode || 0) !== 200) return null
  if (getHeaderValue(clientReq, 'authorization').trim() !== '') return null

  const o = resHeadersToLowerObject(res)
  if (o['set-cookie']) return null

  const pathNoQuery = (clientReq.url || '/').split('?')[0] || '/'
  const cts = o['content-type']
  const contentType = cts
    ? Array.isArray(cts)
      ? String(cts[0])
      : String(cts)
    : ''

  const ccs = o['cache-control']
    ? Array.isArray(o['cache-control'])
      ? o['cache-control'].join(', ')
      : String(o['cache-control'])
    : undefined
  const originTtl = originDirectiveTtlMs(ccs)
  if (originTtl === -1) return null
  if (originTtl != null && originTtl > 0) {
    return { ttlMs: originTtl, cdnTtl: 'origin', pathNoQuery, contentType }
  }
  const ctLower = contentType.toLowerCase()
  if (ctLower.startsWith('application/json') && !pathNoQuery.startsWith('/_serverFn/')) {
    return { ttlMs: 60_000, cdnTtl: 'heuristic', pathNoQuery, contentType }
  }
  const h = heuristicCdnTtlMs(res, clientReq, pathNoQuery, contentType)
  if (h <= 0) return null
  return { ttlMs: h, cdnTtl: 'heuristic', pathNoQuery, contentType }
}

/**
 * @param {import('node:http').IncomingMessage} res
 * @param {import('node:http').IncomingMessage} clientReq
 */
function buildStoreKeyForResponse(res, clientReq) {
  const url = clientReq.url ?? '/'
  const o = resHeadersToLowerObject(res)
  const v = o.vary
  const vStr = v ? (Array.isArray(v) ? v.join(',') : String(v)) : undefined
  return buildCanonicalKey('GET', url, clientReq, vStr)
}

/**
 * @param {import('node:http').IncomingMessage} clientReq
 */
function findMatchingCacheEntry(clientReq) {
  if (clientReq.method !== 'GET') return null
  const url = clientReq.url ?? '/'
  const base = `GET ${url}`
  for (const [key, entry] of cache.entries()) {
    if (key !== base && !key.startsWith(base + '|')) continue
    if (Date.now() > entry.expiresAt) {
      cache.delete(key)
      continue
    }
    const v = entry.headers['vary']
    const vStr = v ? (Array.isArray(v) ? v.join(',') : String(v)) : undefined
    const want = buildCanonicalKey('GET', url, clientReq, vStr)
    if (want === key) return { key, entry }
  }
  return null
}

/**
 * @param {string} key
 * @param {{ headers: Record<string, string | string[] | number>, status: number, storedAt: number, expiresAt: number, tags: string[], hits: number }} partial
 * @param {Buffer} body
 */
function setCacheEntry(key, { headers, status, storedAt, expiresAt, tags, hits }, body) {
  if (cache.size >= MAX_ENTRIES) {
    let oldestKey = null
    let oldestT = Infinity
    for (const [k, e] of cache.entries()) {
      if (e.storedAt < oldestT) {
        oldestT = e.storedAt
        oldestKey = k
      }
    }
    if (oldestKey != null) cache.delete(oldestKey)
  }
  cache.set(key, { key, body, headers, status, storedAt, expiresAt, tags, hits })
}

// --- request shaping --------------------------------------------------------

/**
 * @param {import('node:http').IncomingMessage} clientReq
 */
function forwardHeaders(clientReq) {
  /** @type {Record<string, string | string[]>} */
  const h = {}
  for (const [k, v] of Object.entries(clientReq.headers)) {
    if (v == null) continue
    const kl = k.toLowerCase()
    if (
      kl === 'host' ||
      kl === 'connection' ||
      kl === 'proxy-connection' ||
      kl === 'keep-alive' ||
      kl === 'transfer-encoding' ||
      kl === 'content-length' ||
      kl === 'upgrade'
    ) {
      continue
    }
    h[k] = v
  }
  h.host = `${ORIGIN_HOST}:${ORIGIN_PORT}`
  return h
}

// --- control API --------------------------------------------------------------

/**
 * @param {import('node:http').ServerResponse} res
 * @param {object} data
 * @param {number} [code]
 */
function sendJson(res, data, code = 200) {
  res.writeHead(code, { 'content-type': 'application/json' })
  res.end(JSON.stringify(data))
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {string} message
 * @param {number} [code]
 */
function sendText(res, message, code = 500) {
  res.writeHead(code, { 'content-type': 'text/plain; charset=utf-8' })
  res.end(message)
}

function snapshot() {
  const now = Date.now()
  const entries = []
  let totalBytes = 0
  for (const e of cache.values()) {
    const bytes = e.body.length
    totalBytes += bytes
    const ageSeconds = Math.max(0, Math.floor((now - e.storedAt) / 1000))
    const ttlSeconds = Math.max(0, Math.floor((e.expiresAt - e.storedAt) / 1000))
    entries.push({
      key: e.key,
      status: e.status,
      storedAt: e.storedAt,
      expiresAt: e.expiresAt,
      ageSeconds,
      ttlSeconds,
      tags: e.tags,
      hits: e.hits,
      bytes,
    })
  }
  return { entries, totalEntries: entries.length, totalBytes }
}

// --- main proxy ---------------------------------------------------------------

const server = http.createServer((clientReq, clientRes) => {
  const u = clientReq.url || '/'
  const pathname = u.split('?')[0] ?? u

  if (pathname === '/__cache' || u.startsWith('/__cache?')) {
    if (clientReq.method !== 'GET') {
      sendText(clientRes, 'Method Not Allowed', 405)
      return
    }
    sendJson(clientRes, snapshot())
    return
  }

  if (pathname === '/__cache/purge') {
    if (clientReq.method !== 'POST') {
      sendText(clientRes, 'Method Not Allowed', 405)
      return
    }
    const chunks = []
    clientReq.on('data', (c) => chunks.push(c))
    clientReq.on('end', () => {
      let body = {}
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        body = raw ? JSON.parse(raw) : {}
      } catch {
        sendJson(clientRes, { error: 'Invalid JSON' }, 400)
        return
      }
      let purged = 0
      if (body.all === true) {
        purged = cache.size
        cache.clear()
        console.log(`[PRG ] all          purged=${purged}`)
        sendJson(clientRes, { purged })
        return
      }
      if (typeof body.key === 'string') {
        if (cache.delete(body.key)) {
          purged = 1
        }
        console.log(`[PRG ] key=${body.key} purged=${purged}`)
        sendJson(clientRes, { purged })
        return
      }
      if (typeof body.tag === 'string') {
        const tag = body.tag
        for (const [k, e] of cache.entries()) {
          if (e.tags.includes(tag)) {
            cache.delete(k)
            purged++
          }
        }
        console.log(`[PRG ] tag=${tag} purged=${purged}`)
        sendJson(clientRes, { purged })
        return
      }
      sendJson(clientRes, { error: 'Body must be { all: true } | { key } | { tag }' }, 400)
    })
    return
  }

  if (pathname === '/__cache/view') {
    if (clientReq.method !== 'GET') {
      sendText(clientRes, 'Method Not Allowed', 405)
      return
    }
    clientRes.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    clientRes.end(CACHE_VIEW_HTML)
    return
  }

  const method = (clientReq.method || 'GET').toUpperCase()
  const displayKey = `${method} ${u}`

  if (method !== 'GET') {
    const req = http.request(
      { hostname: ORIGIN_HOST, port: ORIGIN_PORT, method, path: u, headers: forwardHeaders(clientReq) },
      (originRes) => {
        const h = { ...resHeadersToLowerObject(originRes) }
        h['x-cache'] = 'BYPASS'
        h['x-cache-key'] = displayKey
        const status = originRes.statusCode || 200
        clientRes.writeHead(status, h)
        originRes.pipe(clientRes)
        console.log(`[BYP ] ${method} ${u}`)
      },
    )
    clientReq.pipe(req)
    req.on('error', (e) => {
      console.error(e)
      if (!clientRes.headersSent) clientRes.writeHead(502)
      clientRes.end('Bad gateway')
    })
    return
  }

  // GET
  const match = findMatchingCacheEntry(clientReq)
  if (match) {
    const { key, entry } = match
    const ageSeconds = Math.max(0, Math.floor((Date.now() - entry.storedAt) / 1000))
    const copy = { ...entry.headers }
    delete copy['cache-tag']
    // Replay stored bytes as a single buffer (avoid stale chunked / length from origin).
    delete copy['transfer-encoding']
    copy['content-length'] = String(entry.body.length)
    copy['x-cache'] = 'HIT'
    copy['x-cache-key'] = key
    copy['x-cache-age'] = String(ageSeconds)
    if (entry.tags.length) {
      copy['x-cache-tags'] = entry.tags.join(',')
    }
    entry.hits += 1
    cache.set(key, { ...entry, hits: entry.hits })
    clientRes.writeHead(200, copy)
    clientRes.end(entry.body)
    console.log(`[HIT ] ${key}          age=${ageSeconds}s  hits=${entry.hits}`)
    return
  }

  const req = http.request(
    { hostname: ORIGIN_HOST, port: ORIGIN_PORT, method: 'GET', path: u, headers: forwardHeaders(clientReq) },
    (originRes) => {
      const cdn = getCdnTtlInfo(originRes, clientReq)
      const canKey = buildStoreKeyForResponse(originRes, clientReq)

      if (!cdn) {
        const h = { ...resHeadersToLowerObject(originRes) }
        h['x-cache'] = 'BYPASS'
        h['x-cache-key'] = canKey
        const status = originRes.statusCode || 200
        clientRes.writeHead(status, h)
        originRes.pipe(clientRes)
        console.log(`[BYP ] GET ${u}`)
        return
      }

      const { ttlMs, cdnTtl, pathNoQuery, contentType } = cdn

      const chunks = []
      originRes.on('data', (c) => chunks.push(c))
      originRes.on('error', (e) => {
        console.error(e)
        if (!clientRes.headersSent) clientRes.writeHead(502)
        clientRes.end('Bad gateway')
      })
      originRes.on('end', () => {
        const body = Buffer.concat(chunks)
        const oheaders = resHeadersToLowerObject(originRes)
        const tagRaw = oheaders['cache-tag']
        const tagStr = tagRaw
          ? Array.isArray(tagRaw)
            ? tagRaw.join(',')
            : String(tagRaw)
          : ''
        const tags = parseCacheTagHeader(tagStr)
        if (cdnTtl === 'heuristic') {
          for (const t of syntheticCdnTagsForHeuristic(pathNoQuery, contentType)) {
            if (!tags.includes(t)) tags.push(t)
          }
        }
        const varyStr = oheaders.vary
          ? Array.isArray(oheaders.vary)
            ? oheaders.vary.join(',')
            : String(oheaders.vary)
          : undefined
        const canonicalKey = buildCanonicalKey('GET', clientReq.url ?? '/', clientReq, varyStr)

        const now = Date.now()
        const storedAt = now
        const expiresAt = now + ttlMs

        setCacheEntry(
          canonicalKey,
          {
            headers: headersObjectForStore(originRes),
            status: 200,
            storedAt,
            expiresAt,
            tags,
            hits: 0,
          },
          body,
        )

        const out = { ...oheaders }
        delete out['cache-tag']
        out['x-cache'] = 'MISS'
        out['x-cache-key'] = canonicalKey

        const status = originRes.statusCode || 200
        const ttlS = Math.floor(ttlMs / 1000)
        const src = cdnTtl === 'heuristic' ? 'cdn-default' : 'origin-CC'
        console.log(
          `[MISS] ${canonicalKey}          stored ttl=${ttlS}s [${src}] tags=${tags.join(',') || '(none)'}`,
        )
        clientRes.writeHead(status, out)
        clientRes.end(body)
      })
    },
  )
  clientReq.pipe(req)
  req.on('error', (e) => {
    console.error(e)
    if (!clientRes.headersSent) clientRes.writeHead(502)
    clientRes.end('Bad gateway')
  })
})

const CACHE_VIEW_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>CDN simulator</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: ui-sans-serif, system-ui, sans-serif;
    background: #0d1117; color: #e6edf3; min-height: 100vh; padding: 1.5rem;
  }
  h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 1rem; }
  .row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-bottom: 1rem; }
  button {
    background: #21262d; color: #e6edf3; border: 1px solid #30363d;
    padding: 0.45rem 0.9rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;
  }
  button:hover { background: #30363d; }
  table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  th, td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid #21262d; vertical-align: top; }
  th { color: #8b949e; font-weight: 600; }
  .key { font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; font-size: 0.75rem; word-break: break-all; }
  tr.green { background: rgba(35, 134, 54, 0.15); }
  tr.yellow { background: rgba(187, 128, 9, 0.2); }
  tr.red { background: rgba(248, 81, 73, 0.18); }
  .tag-btn { font-size: 0.7rem; padding: 0.2rem 0.45rem; margin: 0.1rem; }
  .muted { color: #8b949e; }
</style>
</head>
<body>
  <h1>Cache entries (CDN simulator)</h1>
  <div class="row">
    <button type="button" id="purgeAll">Purge all</button>
    <span class="muted" id="status"></span>
  </div>
  <div style="overflow-x:auto">
    <table>
      <thead>
        <tr>
          <th>Key</th>
          <th>Tags</th>
          <th>Age</th>
          <th>TTL left</th>
          <th>Hits</th>
          <th>Bytes</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="rows"></tbody>
    </table>
  </div>
  <p class="muted" id="summary"></p>
  <script>
  const headers = { 'Content-Type': 'application/json' };

  function rowClass(e) {
    const now = Date.now();
    if (now > e.expiresAt) return 'red';
    const half = (e.ttlSeconds || 0) / 2;
    if (e.ageSeconds < half) return 'green';
    return 'yellow';
  }

  function purge(body) {
    return fetch('/__cache/purge', { method: 'POST', headers, body: JSON.stringify(body) });
  }

  function render(data) {
    const tb = document.getElementById('rows');
    const summary = document.getElementById('summary');
    tb.innerHTML = '';
    for (const e of data.entries) {
      const tr = document.createElement('tr');
      tr.className = rowClass(e);
      const tags = (e.tags || []).map(t => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tag-btn';
        b.textContent = 'Purge: ' + t;
        b.onclick = () => { purge({ tag: t }).then(() => {}); };
        return b;
      });
      const ttlLeft = Math.max(0, Math.floor((e.expiresAt - Date.now()) / 1000));
      tr.innerHTML = '<td class="key">' + escapeHtml(e.key) + '</td><td class="tag-cell"></td><td>' + e.ageSeconds + 's</td><td>' + ttlLeft + 's</td><td>' + e.hits + '</td><td>' + e.bytes + '</td><td class="act"></td>';
      const tagCell = tr.querySelector('.tag-cell');
      tags.forEach(b => tagCell.appendChild(b));
      const act = tr.querySelector('.act');
      const pb = document.createElement('button');
      pb.type = 'button';
      pb.textContent = 'Purge key';
      pb.onclick = () => { purge({ key: e.key }).then(() => {}); };
      act.appendChild(pb);
      tb.appendChild(tr);
    }
    summary.textContent = 'Total entries: ' + data.totalEntries + ' — Total bytes: ' + data.totalBytes;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  async function tick() {
    const st = document.getElementById('status');
    try {
      const r = await fetch('/__cache');
      const data = await r.json();
      render(data);
      st.textContent = 'Updated ' + new Date().toLocaleTimeString();
    } catch (e) {
      st.textContent = 'Error';
    }
  }

  document.getElementById('purgeAll').onclick = () => purge({ all: true });

  setInterval(tick, 1000);
  tick();
  </script>
</body>
</html>`

server.listen(PROXY_PORT, () => {
  console.log(
    `CDN simulator listening on http://localhost:${PROXY_PORT} -> http://${ORIGIN_HOST}:${ORIGIN_PORT}`,
  )
  console.log(`Visualizer: http://localhost:${PROXY_PORT}/__cache/view`)
})
