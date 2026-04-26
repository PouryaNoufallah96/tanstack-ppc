import { createFileRoute } from '@tanstack/react-router'
import { publishTrendingStory } from '#/server/trending'

async function readHeadlineFromPost(request: Request): Promise<string | undefined> {
  const ct = request.headers.get('content-type') || ''
  if (!ct.includes('application/json')) return undefined
  try {
    const j = (await request.json()) as { headline?: unknown }
    if (typeof j?.headline === 'string' && j.headline.trim() !== '') {
      return j.headline
    }
  } catch {
    // empty or invalid body — treat as no headline
  }
  return undefined
}

export const Route = createFileRoute('/__newsroom/publish-trending')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const headline = await readHeadlineFromPost(request)
        const { story, number } = publishTrendingStory(
          headline !== undefined ? { headline } : undefined,
        )
        return Response.json({ ok: true as const, story, number })
      },
    },
  },
})
