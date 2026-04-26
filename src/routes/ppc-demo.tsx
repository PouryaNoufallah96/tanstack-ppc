import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * Home page hosts the news/PPC demo. Keep this path as a permanent redirect
 * for old links and docs that still mention /ppc-demo.
 */
export const Route = createFileRoute('/ppc-demo')({
  beforeLoad: () => {
    throw redirect({ to: '/' })
  },
})
