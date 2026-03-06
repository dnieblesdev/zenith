import { Hono } from 'hono'
import type { Variables } from '../types'

export const admin = new Hono<{ Variables: Variables }>()

// AP-030 POST /admin/novels
admin.post('/novels', (c) => {
  return c.json({ message: 'Not Implemented' }, 501)
})

// AP-031 PUT /admin/novels/:id
admin.put('/novels/:id', (c) => {
  return c.json({ message: 'Not Implemented' }, 501)
})

// AP-032 POST /admin/novels/:id/sync
admin.post('/novels/:id/sync', (c) => {
  return c.json({ message: 'Not Implemented' }, 501)
})

// AP-033 PUT /admin/suggestions/:id/status
admin.put('/suggestions/:id/status', (c) => {
  return c.json({ message: 'Not Implemented' }, 501)
})

// AP-034 GET /admin/stats
admin.get('/stats', (c) => {
  return c.json({ message: 'Not Implemented' }, 501)
})
