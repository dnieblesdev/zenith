import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { HTTPException } from 'hono/http-exception'
import { getChapter } from '../services/catalog'
import { createSuggestion, listSuggestions } from '../services/editorial'
import { authMiddleware } from '../middleware/auth'
import { db } from '../lib/db'
import type { Variables, SuggestionStatus } from '../types'

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

// AP-020 POST /chapters/:id/suggestions
chapters.post(
  '/:id/suggestions',
  authMiddleware,
  zValidator(
    'param',
    z.object({
      id: z.coerce.number().int().positive(),
    }),
  ),
  zValidator(
    'json',
    z.object({
      paragraphIndex: z.number().int().min(0),
      originalText: z.string().min(1),
      proposedText: z.string().min(1),
      note: z.string().max(500).optional(),
      language: z.string().optional(),
    }).refine((b) => b.proposedText !== b.originalText, {
      message: 'proposedText must differ from originalText',
      path: ['proposedText'],
    }),
  ),
  async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const user = c.get('user')

    const result = await createSuggestion(
      {
        chapterId: id,
        paragraphIndex: body.paragraphIndex,
        originalText: body.originalText,
        proposedText: body.proposedText,
        note: body.note,
        language: body.language,
      },
      user.id,
    )

    return c.json(result, 201)
  },
)

// AP-021 GET /chapters/:id/suggestions
chapters.get(
  '/:id/suggestions',
  zValidator(
    'param',
    z.object({
      id: z.coerce.number().int().positive(),
    }),
  ),
  zValidator(
    'query',
    z.object({
      paragraphIndex: z.coerce.number().int().min(0).optional(),
      status: z
        .enum(['PENDING', 'APPLIED', 'SUPERSEDED', 'REJECTED'])
        .optional(),
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(20),
    }),
  ),
  async (c) => {
    const { id } = c.req.valid('param')
    const query = c.req.valid('query')

    const result = await listSuggestions(id, {
      paragraphIndex: query.paragraphIndex,
      status: query.status as SuggestionStatus | undefined,
      page: query.page,
      limit: query.limit,
    })

    return c.json(result)
  },
)
