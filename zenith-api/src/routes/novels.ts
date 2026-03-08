import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { HTTPException } from 'hono/http-exception'
import { listNovels, getNovel, listChapters } from '../services/catalog'
import type { Variables } from '../types'

export const novels = new Hono<{ Variables: Variables }>()

// AP-001 GET /novels
novels.get(
  '/',
  zValidator(
    'query',
    z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      lang: z.enum(['en', 'es']).optional(),
      genre: z.string().optional(),
      status: z.string().optional(),
      q: z.string().optional(),
    }),
  ),
  async (c) => {
    const params = c.req.valid('query')
    const result = await listNovels(params)
    return c.json(result)
  },
)

// AP-002 GET /novels/:slug
novels.get(
  '/:slug',
  zValidator(
    'param',
    z.object({
      slug: z.string().min(1),
    }),
  ),
  async (c) => {
    const { slug } = c.req.valid('param')
    try {
      const result = await getNovel(slug)
      return c.json(result)
    } catch (e) {
      if (e instanceof HTTPException) throw e
      throw new HTTPException(404, { message: 'Novel not found' })
    }
  },
)

// AP-003 GET /novels/:slug/chapters
novels.get(
  '/:slug/chapters',
  zValidator(
    'param',
    z.object({
      slug: z.string().min(1),
    }),
  ),
  async (c) => {
    const { slug } = c.req.valid('param')
    try {
      const result = await listChapters(slug)
      return c.json(result)
    } catch (e) {
      if (e instanceof HTTPException) throw e
      throw new HTTPException(404, { message: 'Novel not found' })
    }
  },
)
