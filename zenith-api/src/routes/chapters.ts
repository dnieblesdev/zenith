import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { HTTPException } from 'hono/http-exception'
import { getChapter } from '../services/catalog'
import { db } from '../lib/db'
import type { Variables } from '../types'

export const chapters = new Hono<{ Variables: Variables }>()

// AP-004 GET /chapters/:id
chapters.get(
  '/:id',
  zValidator(
    'param',
    z.object({
      id: z.coerce.number().int().positive(),
    }),
  ),
  async (c) => {
    const { id } = c.req.valid('param')
    try {
      const result = await getChapter(id)

      // Fire-and-forget reads increment — do NOT await
      db.chapter.update({
        where: { id },
        data: { reads: { increment: 1 } },
      })

      return c.json(result)
    } catch (e) {
      if (e instanceof HTTPException) throw e
      throw new HTTPException(404, { message: 'Chapter not found' })
    }
  },
)
