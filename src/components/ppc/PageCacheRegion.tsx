import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  routeName?: string
  ttlSec?: number
}

export function PageCacheRegion({
  children,
  routeName = '/',
  ttlSec = 300,
}: Props) {
  return (
    <div
      className="ppc-region-page relative mb-6 w-full min-w-0 rounded-lg border-2 border-dashed bg-[var(--surface)] p-6 pb-10 pt-9 shadow-sm"
    >
      <div
        className="ppc-label-page absolute left-3 top-3 z-[1] font-mono text-[11px] font-bold uppercase tracking-tight"
      >
        <span className="mr-1 opacity-80">[doc]</span>
        <span>PAGE CACHE</span>
      </div>
      {children}
      <div
        className="ppc-meta-page absolute bottom-2 left-3 z-[1] max-w-[calc(100%-1.5rem)] font-mono text-[10px] leading-tight"
      >
        {`route: ${routeName} · ttl: ${ttlSec}s`}
      </div>
    </div>
  )
}
