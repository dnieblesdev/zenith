import { createMiddleware } from 'hono/factory'
import { authMiddleware } from './auth'
import type { Variables } from '../types'

export const adminMiddleware = createMiddleware<{ Variables: Variables }>(
  async (c, next) => {
    // First apply auth check
    let authPassed = false
    await authMiddleware(c, async () => {
      authPassed = true
    })

    if (!authPassed) {
      // authMiddleware already returned a 401 response
      return
    }

    const user = c.get('user')
    if (user.role !== 'ADMIN') {
      return c.json({ error: 'Forbidden' }, 403)
    }

    await next()
  },
)
