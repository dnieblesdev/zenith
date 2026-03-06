import { Hono } from 'hono'
import { auth } from './lib/auth'
import { novels } from './routes/novels'
import { chapters } from './routes/chapters'
import { suggestions } from './routes/suggestions'
import { admin } from './routes/admin'
import { authRoutes } from './routes/auth'
import { usersRouter } from './routes/users'
import type { Variables } from './types'

export const app = new Hono<{ Variables: Variables }>()

// Better Auth handler — covers /api/auth/**
app.on(['GET', 'POST'], '/api/auth/**', (c) => {
  return auth.handler(c.req.raw)
})

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

// Routes
app.route('/novels', novels)
app.route('/chapters', chapters)
app.route('/suggestions', suggestions)
app.route('/admin', admin)
app.route('/auth', authRoutes)
app.route('/users', usersRouter)

// Bun server export
const port = Number(process.env.PORT) || 3000

export default {
  port,
  fetch: app.fetch,
}
