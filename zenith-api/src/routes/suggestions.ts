import { Hono } from 'hono'
import type { Variables } from '../types'

export const suggestions = new Hono<{ Variables: Variables }>()

// AP-020 POST /chapters/:id/suggestions
suggestions.post('/chapters/:id/suggestions', (c) => {
  return c.json({ message: 'Not Implemented' }, 501)
})

// AP-021 GET /chapters/:id/suggestions
suggestions.get('/chapters/:id/suggestions', (c) => {
  return c.json({ message: 'Not Implemented' }, 501)
})

// AP-022 POST /suggestions/:id/vote
suggestions.post('/:id/vote', (c) => {
  return c.json({ message: 'Not Implemented' }, 501)
})

// AP-023 DELETE /suggestions/:id/vote
suggestions.delete('/:id/vote', (c) => {
  return c.json({ message: 'Not Implemented' }, 501)
})

// AP-024 GET /suggestions/:id
suggestions.get('/:id', (c) => {
  return c.json({ message: 'Not Implemented' }, 501)
})
