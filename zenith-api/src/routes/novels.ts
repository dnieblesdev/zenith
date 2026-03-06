import { Hono } from 'hono'
import type { Variables } from '../types'

export const novels = new Hono<{ Variables: Variables }>()

// AP-001 GET /novels
novels.get('/', (c) => {
  return c.json({ message: 'Not Implemented' }, 501)
})

// AP-002 GET /novels/:id
novels.get('/:id', (c) => {
  return c.json({ message: 'Not Implemented' }, 501)
})

// AP-003 GET /novels/:id/chapters
novels.get('/:id/chapters', (c) => {
  return c.json({ message: 'Not Implemented' }, 501)
})
