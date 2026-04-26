import type { ReactNode } from 'react'

type Props = { children: ReactNode }

export function ControlRegion({ children }: Props) {
  return (
    <div
      className="ppc-region-control relative mb-6 w-full min-w-0 rounded-lg border-2 border-solid bg-[var(--surface)] p-6 pt-9 shadow-sm"
    >
      <div
        className="ppc-label-control absolute left-3 top-3 z-[1] font-mono text-[11px] font-bold uppercase tracking-tight"
      >
        Control · NOT CACHED
      </div>
      <div className="mt-1">{children}</div>
    </div>
  )
}
