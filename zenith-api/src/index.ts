import { Hono } from 'hono'
import { auth } from './lib/auth'
import { novels } from './routes/novels'
import { chapters } from './routes/chapters'
import { suggestions } from './routes/suggestions'
import { admin } from './routes/admin'
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

// Route stubs
app.route('/novels', novels)
app.route('/chapters', chapters)
app.route('/suggestions', suggestions)
app.route('/admin', admin)

// Bun server export
const port = Number(process.env.PORT) || 3000

export default {
  port,
  fetch: app.fetch,
}
