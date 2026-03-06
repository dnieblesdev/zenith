import { Hono } from 'hono'
import type { Variables } from '../types'

export const chapters = new Hono<{ Variables: Variables }>()

// AP-004 GET /chapters/:id
chapters.get('/:id', (c) => {
  return c.json({ message: 'Not Implemented' }, 501)
})
