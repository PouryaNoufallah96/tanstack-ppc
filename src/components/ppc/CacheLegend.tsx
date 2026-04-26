export function CacheLegend() {
  return (
    <section
      className="mb-8 w-full min-w-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 text-sm text-[var(--sea-ink)]"
    >
      <h2 className="m-0 mb-3 text-base font-bold text-[var(--sea-ink)]">
        What the borders mean
      </h2>
      <div className="space-y-3 text-[var(--sea-ink-soft)]">
        <div className="ppc-legend-swatch">
          <div
            className="ppc-legend-swatch__box ppc-legend-swatch__box--page"
            aria-hidden
          />
          <div>
            <p className="m-0 font-mono text-xs font-semibold text-[var(--ppc-page)]">
              Page cache
            </p>
            <p className="m-0 mt-1 text-sm">
              Rendered by the route. Cached as the HTML for{' '}
              <code className="text-[var(--sea-ink)]">/</code> (home) — one TTL, one
              cache key for the document body.
            </p>
          </div>
        </div>
        <div className="ppc-legend-swatch">
          <div
            className="ppc-legend-swatch__box ppc-legend-swatch__box--fragment"
            aria-hidden
          />
          <div>
            <p className="m-0 font-mono text-xs font-semibold text-[var(--ppc-fragment)]">
              PPC fragment
            </p>
            <p className="m-0 mt-1 text-sm">
              A GET server function called from the client. Independently cached at{' '}
              <code className="text-[var(--sea-ink)]">/_serverFn/&lt;id&gt;</code> with its
              own TTL, key, and <code>Cache-Tag</code> headers.
            </p>
          </div>
        </div>
        <div className="ppc-legend-swatch">
          <div
            className="ppc-legend-swatch__box ppc-legend-swatch__box--control"
            aria-hidden
          />
          <div>
            <p className="m-0 font-mono text-xs font-semibold text-[var(--ppc-control)]">
              Control
            </p>
            <p className="m-0 mt-1 text-sm">
              Admin-style actions. Not cached. Publishing updates server state; purging
              invalidates the proxy only when you run it.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
