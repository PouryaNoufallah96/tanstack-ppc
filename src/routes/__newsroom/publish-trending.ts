import { createFileRoute } from '@tanstack/react-router'
import {
  publishTrendingStory,
  type TrendingStoryType,
} from '#/server/trending'

type PostBody = { headline?: string; type?: TrendingStoryType }

async function readBody(request: Request): Promise<PostBody> {
  const ct = request.headers.get('content-type') || ''
  if (!ct.includes('application/json')) return {}
  try {
    const j = (await request.json()) as { headline?: unknown; type?: unknown }
    const out: PostBody = {}
    if (typeof j?.headline === 'string' && j.headline.trim() !== '') {
      out.headline = j.headline
    }
    if (j?.type === 'basic' || j?.type === 'interactive') {
      out.type = j.type
    }
    return out
  } catch {
    // empty or invalid body — treat as no fields
    return {}
  }
}

export const Route = createFileRoute('/__newsroom/publish-trending')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = await readBody(request)
        const { story, number } = publishTrendingStory(body)
        return Response.json({ ok: true as const, story, number })
      },
    },
  },
})
