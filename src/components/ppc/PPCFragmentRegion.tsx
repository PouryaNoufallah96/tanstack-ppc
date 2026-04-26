import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  serverFn?: string
  ttlSec?: number
  tags?: string
}

export function PPCFragmentRegion({
  children,
  serverFn = 'getTrending',
  ttlSec = 30,
  tags = 'trending, homepage',
}: Props) {
  return (
    <div
      className="ppc-region-fragment relative mb-6 w-full min-w-0 rounded-lg border-2 border-dashed bg-[var(--surface)] p-6 pb-10 pt-9 shadow-sm lg:mb-0"
    >
      <div
        className="ppc-label-fragment absolute left-3 top-3 z-[1] font-mono text-[11px] font-bold uppercase tracking-tight"
      >
        <span className="mr-1 opacity-80">[fn]</span>
        <span>PPC FRAGMENT</span>
      </div>
      {children}
      <div
        className="ppc-meta-fragment absolute bottom-2 left-3 z-[1] max-w-[calc(100%-1.5rem)] break-words font-mono text-[10px] leading-tight"
      >
        {`serverFn: ${serverFn} · ttl: ${ttlSec}s · tags: ${tags}`}
      </div>
    </div>
  )
}
