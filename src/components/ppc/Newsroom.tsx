import { useState } from 'react'

function purgeBaseUrl() {
  if (typeof window === 'undefined') return 'http://localhost:8080'
  return window.location.port === '8080' ? '' : 'http://localhost:8080'
}

export function Newsroom() {
  const [pubMsg, setPubMsg] = useState('')
  const [tagMsg, setTagMsg] = useState('')
  const [allMsg, setAllMsg] = useState('')

  const publish = async () => {
    setPubMsg('')
    try {
      const res = await fetch('/publish-trending', { method: 'POST' })
      const data = (await res.json()) as {
        ok?: boolean
        number?: number
        story?: { id: string; headline: string }
      }
      if (!res.ok) {
        setPubMsg(`Error ${res.status}`)
        return
      }
      if (data.ok && data.story && typeof data.number === 'number') {
        setPubMsg(
          `Published story #${data.number} · trending cache NOT yet purged`,
        )
        return
      }
      setPubMsg('Unexpected response from publish')
    } catch (e) {
      setPubMsg(
        e instanceof Error ? e.message : 'Publish failed. Is the app running on :3000 or :8080?',
      )
    }
  }

  const purgeTag = async () => {
    setTagMsg('')
    try {
      const base = purgeBaseUrl()
      const res = await fetch(`${base}/__cache/purge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: 'trending' }),
      })
      const data = (await res.json()) as { purged?: number; error?: string }
      if (!res.ok) {
        setTagMsg(data.error || `Error ${res.status} — open via :8080?`)
        return
      }
      setTagMsg(
        `Purged ${data.purged ?? 0} ${data.purged === 1 ? 'entry' : 'entries'} for tag "trending"`,
      )
    } catch (e) {
      setTagMsg(
        e instanceof Error
          ? e.message
          : 'Purge failed. Use the CDN simulator (port 8080) for this action.',
      )
    }
  }

  const purgeAll = async () => {
    setAllMsg('')
    try {
      const base = purgeBaseUrl()
      const res = await fetch(`${base}/__cache/purge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      const data = (await res.json()) as { purged?: number; error?: string }
      if (!res.ok) {
        setAllMsg(data.error || `Error ${res.status} — open via :8080?`)
        return
      }
      setAllMsg(`Purged all: ${data.purged ?? 0} ${data.purged === 1 ? 'entry' : 'entries'}`)
    } catch (e) {
      setAllMsg(
        e instanceof Error
          ? e.message
          : 'Purge failed. Use the CDN simulator (port 8080) for this action.',
      )
    }
  }

  return (
    <div className="space-y-5 text-(--sea-ink)">
      <p className="m-0 text-sm text-(--sea-ink-soft)">
        Wire actions for the video: publish changes server data first; the proxy can still
        serve the old <code>trending</code> response until you purge the tag. Publish
        endpoint: <code className="text-(--sea-ink)">POST /publish-trending</code> (
        <code className="text-(--sea-ink)">src/routes/__newsroom/publish-trending.ts</code>
        ).
      </p>
      <div>
        <button
          type="button"
          onClick={publish}
          className="rounded border border-(--line) bg-(--chip-bg) px-3 py-1.5 font-mono text-xs text-(--sea-ink) hover:bg-(--link-bg-hover)"
        >
          [ publish trending story ]
        </button>
        {pubMsg ? (
          <p className="mt-2 m-0 font-mono text-xs text-(--sea-ink-soft)">{pubMsg}</p>
        ) : null}
      </div>
      <div>
        <button
          type="button"
          onClick={purgeTag}
          className="rounded border border-(--line) bg-(--chip-bg) px-3 py-1.5 font-mono text-xs text-(--sea-ink) hover:bg-(--link-bg-hover)"
        >
          [ Purge "trending" tag in proxy ]
        </button>
        {tagMsg ? (
          <p className="mt-2 m-0 font-mono text-xs text-(--sea-ink-soft)">{tagMsg}</p>
        ) : null}
      </div>
      <div>
        <button
          type="button"
          onClick={purgeAll}
          className="rounded border border-(--line) bg-(--chip-bg) px-3 py-1.5 font-mono text-xs text-(--sea-ink) hover:bg-(--link-bg-hover)"
        >
          [ Purge all in proxy ]
        </button>
        {allMsg ? (
          <p className="mt-2 m-0 font-mono text-xs text-(--sea-ink-soft)">{allMsg}</p>
        ) : null}
      </div>
    </div>
  )
}
