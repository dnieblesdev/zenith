import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { adminMiddleware } from '../middleware/admin'
import {
  createNovel,
  updateNovel,
  syncNovel,
  overrideSuggestionStatus,
  getStats,
} from '../services/admin'
import type { Variables } from '../types'

export const admin = new Hono<{ Variables: Variables }>()

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────────────────────────────────────

const createNovelSchema = z.object({
  title: z.string().min(1).max(255),
  url: z.string().url(),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric and hyphens only'),
  language: z.enum(['en', 'es']),
  description: z.string().max(5000).optional(),
  coverUrl: z.string().url().optional(),
  status: z.string().max(50).optional(),
})

const updateNovelSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  coverUrl: z.string().url().optional().nullable(),
  status: z.string().max(50).optional(),
  language: z.enum(['en', 'es']).optional(),
})

const overrideStatusSchema = z.object({
  status: z.enum(['APPLIED', 'REJECTED']),
})

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

// ─────────────────────────────────────────────────────────────────────────────
// AP-030 POST /admin/novels
// ─────────────────────────────────────────────────────────────────────────────

admin.post(
  '/novels',
  adminMiddleware,
  zValidator('json', createNovelSchema),
  async (c) => {
    const input = c.req.valid('json')
    const result = await createNovel(input)
    return c.json(result, 201)
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// AP-031 PUT /admin/novels/:id
// ─────────────────────────────────────────────────────────────────────────────

admin.put(
  '/novels/:id',
  adminMiddleware,
  zValidator('param', idParamSchema),
  zValidator('json', updateNovelSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const input = c.req.valid('json')
    const result = await updateNovel(id, input)
    return c.json(result, 200)
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// AP-032 POST /admin/novels/:id/sync
// ─────────────────────────────────────────────────────────────────────────────

admin.post(
  '/novels/:id/sync',
  adminMiddleware,
  zValidator('param', idParamSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const result = await syncNovel(id)
    return c.json(result, 202)
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// AP-033 PUT /admin/suggestions/:id/status
// ─────────────────────────────────────────────────────────────────────────────

admin.put(
  '/suggestions/:id/status',
  adminMiddleware,
  zValidator('param', idParamSchema),
  zValidator('json', overrideStatusSchema),
  async (c) => {
    const { id } = c.req.valid('param')
    const { status } = c.req.valid('json')
    const result = await overrideSuggestionStatus(id, status)
    return c.json(result, 200)
  },
)

// ─────────────────────────────────────────────────────────────────────────────
// AP-034 GET /admin/stats
// ─────────────────────────────────────────────────────────────────────────────

admin.get('/stats', adminMiddleware, async (c) => {
  const result = await getStats()
  return c.json(result, 200)
})
