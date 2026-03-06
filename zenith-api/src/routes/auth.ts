import { Hono } from 'hono'
import type { Variables } from '../types'

export const authRoutes = new Hono<{ Variables: Variables }>()

// AP-010 POST /auth/register
authRoutes.post('/register', (c) => {
  return c.json({ message: 'Not Implemented' }, 501)
})

// AP-011 POST /auth/login
authRoutes.post('/login', (c) => {
  return c.json({ message: 'Not Implemented' }, 501)
})

// AP-012 POST /auth/logout
authRoutes.post('/logout', (c) => {
  return c.json({ message: 'Not Implemented' }, 501)
})

// AP-013 GET /users/:id/profile
authRoutes.get('/users/:id/profile', (c) => {
  return c.json({ message: 'Not Implemented' }, 501)
})
