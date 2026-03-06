import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'
import { db } from '../lib/db'
import type { Variables, UserRole } from '../types'

export const authMiddleware = createMiddleware<{ Variables: Variables }>(
  async (c, next) => {
    // Try cookie first, then Authorization: Bearer header
    const token =
      getCookie(c, 'auth_token') ??
      c.req.header('Authorization')?.replace('Bearer ', '')

    if (!token) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    try {
      const payload = await verify(token, process.env.BETTER_AUTH_SECRET!, 'HS256')

      const user = await db.user.findUnique({
        where: { id: Number(payload.sub) },
        select: { id: true, email: true, username: true, role: true },
      })

      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      c.set('user', {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role as UserRole,
      })

      await next()
    } catch {
      return c.json({ error: 'Unauthorized' }, 401)
    }
  },
)
