import { Hono } from 'hono'
import { db } from '../lib/db'
import type { Variables } from '../types'

export const usersRouter = new Hono<{ Variables: Variables }>()

// ─────────────────────────────────────────────────────────────────────────────
// AP-013: GET /users/:id/profile
// Public — no auth required
// ─────────────────────────────────────────────────────────────────────────────

usersRouter.get('/:id/profile', async (c) => {
  const id = Number(c.req.param('id'))

  if (isNaN(id)) {
    return c.json({ error: 'Invalid user ID' }, 400)
  }

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          suggestions: true,
        },
      },
      suggestions: {
        where: { status: 'APPLIED' },
        select: { id: true },
      },
    },
  })

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json({
    data: {
      id: user.id,
      username: user.username,
      role: user.role,
      acceptedCount: user.suggestions.length,
      suggestionsCount: user._count.suggestions,
      createdAt: user.createdAt,
    },
  })
})
