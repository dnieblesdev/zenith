import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { HTTPException } from 'hono/http-exception'
import { voteSuggestion, unvoteSuggestion, getSuggestion } from '../services/editorial'
import { authMiddleware } from '../middleware/auth'
import type { Variables } from '../types'

export const suggestions = new Hono<{ Variables: Variables }>()

// AP-022 POST /suggestions/:id/vote
suggestions.post(
  '/:id/vote',
  authMiddleware,
  zValidator(
    'param',
    z.object({
      id: z.coerce.number().int().positive(),
    }),
  ),
  async (c) => {
    const { id } = c.req.valid('param')
    const user = c.get('user')

    const result = await voteSuggestion(id, user.id)

    return c.json(result, 201)
  },
)

// AP-023 DELETE /suggestions/:id/vote
suggestions.delete(
  '/:id/vote',
  authMiddleware,
  zValidator(
    'param',
    z.object({
      id: z.coerce.number().int().positive(),
    }),
  ),
  async (c) => {
    const { id } = c.req.valid('param')
    const user = c.get('user')

    const result = await unvoteSuggestion(id, user.id)

    return c.json(result, 200)
  },
)

// AP-024 GET /suggestions/:id
suggestions.get(
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
      const result = await getSuggestion(id)
      return c.json(result)
    } catch (e) {
      if (e instanceof HTTPException) throw e
      throw new HTTPException(404, { message: 'Suggestion not found' })
    }
  },
)
