import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { setCookie, deleteCookie } from 'hono/cookie'
import { sign } from 'hono/jwt'
import { db } from '../lib/db'
import type { Variables } from '../types'

export const authRoutes = new Hono<{ Variables: Variables }>()

// ─────────────────────────────────────────────────────────────────────────────
// Validation schemas
// ─────────────────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email(),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric with underscores only'),
  password: z.string().min(8),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// ─────────────────────────────────────────────────────────────────────────────
// AP-010: POST /auth/register
// ─────────────────────────────────────────────────────────────────────────────

authRoutes.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, username, password } = c.req.valid('json')

  // Check email uniqueness
  const existingEmail = await db.user.findUnique({ where: { email } })
  if (existingEmail) {
    return c.json({ error: 'Email already in use' }, 409)
  }

  // Check username uniqueness
  const existingUsername = await db.user.findUnique({ where: { username } })
  if (existingUsername) {
    return c.json({ error: 'Username already in use' }, 409)
  }

  const passwordHash = await Bun.password.hash(password)

  const user = await db.user.create({
    data: {
      email,
      username,
      passwordHash,
      role: 'READER',
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
    },
  })

  return c.json({ data: user }, 201)
})

// ─────────────────────────────────────────────────────────────────────────────
// AP-011: POST /auth/login
// ─────────────────────────────────────────────────────────────────────────────

authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json')

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      passwordHash: true,
    },
  })

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const passwordMatches = await Bun.password.verify(password, user.passwordHash)
  if (!passwordMatches) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const now = Math.floor(Date.now() / 1000)
  const exp = now + 60 * 60 * 24 * 7 // 7 days

  const token = await sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
      exp,
    },
    process.env.BETTER_AUTH_SECRET!,
  )

  setCookie(c, 'auth_token', token, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: 'Lax',
  })

  return c.json({
    data: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AP-012: POST /auth/logout
// ─────────────────────────────────────────────────────────────────────────────

authRoutes.post('/logout', (c) => {
  deleteCookie(c, 'auth_token', { path: '/' })
  return c.json({ data: { message: 'Logged out' } })
})
