import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Mock DB
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('../src/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

// Mock auth to avoid DB dependency
vi.mock('../src/lib/auth', () => ({
  auth: {
    handler: vi.fn(),
  },
}))

// Mock Bun.password
const mockBunPassword = {
  hash: vi.fn(),
  verify: vi.fn(),
}
vi.stubGlobal('Bun', { password: mockBunPassword })

import { db } from '../src/lib/db'
import { app } from '../src/index'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeUserRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    role: 'READER',
    passwordHash: '$hash$',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function jsonBody(body: Record<string, unknown>) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

// Set env secret for JWT operations
process.env.BETTER_AUTH_SECRET = 'test-secret-key-for-jwt-signing-minimum-32-chars'

// ─────────────────────────────────────────────────────────────────────────────
// AP-010 — POST /auth/register
// ─────────────────────────────────────────────────────────────────────────────

describe('AP-010 POST /auth/register', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockBunPassword.hash.mockResolvedValue('$hashed$')
  })

  it('returns 201 with public user data on success', async () => {
    vi.mocked(db.user.findUnique)
      .mockResolvedValueOnce(null)  // email check
      .mockResolvedValueOnce(null)  // username check
    vi.mocked(db.user.create).mockResolvedValueOnce(
      makeUserRow() as never,
    )

    const res = await app.request(
      '/auth/register',
      jsonBody({ email: 'test@example.com', username: 'testuser', password: 'password123' }),
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBe(1)
    expect(body.data.username).toBe('testuser')
    expect(body.data.email).toBe('test@example.com')
    expect(body.data.role).toBe('READER')
  })

  it('does not expose passwordHash in response', async () => {
    vi.mocked(db.user.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    // Return only the selected fields (no passwordHash)
    vi.mocked(db.user.create).mockResolvedValueOnce({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      role: 'READER',
      createdAt: new Date('2026-01-01'),
    } as never)

    const res = await app.request(
      '/auth/register',
      jsonBody({ email: 'test@example.com', username: 'testuser', password: 'password123' }),
    )

    const body = await res.json()
    expect(body.data).not.toHaveProperty('passwordHash')
  })

  it('returns 409 when email is already in use', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(makeUserRow() as never)

    const res = await app.request(
      '/auth/register',
      jsonBody({ email: 'taken@example.com', username: 'newuser', password: 'password123' }),
    )

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('Email already in use')
  })

  it('returns 409 when username is already in use', async () => {
    vi.mocked(db.user.findUnique)
      .mockResolvedValueOnce(null)               // email check → available
      .mockResolvedValueOnce(makeUserRow() as never) // username check → taken

    const res = await app.request(
      '/auth/register',
      jsonBody({ email: 'new@example.com', username: 'takenuser', password: 'password123' }),
    )

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('Username already in use')
  })

  it('returns 400 when body is invalid (missing email)', async () => {
    const res = await app.request(
      '/auth/register',
      jsonBody({ username: 'testuser', password: 'password123' }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is too short', async () => {
    const res = await app.request(
      '/auth/register',
      jsonBody({ email: 'test@example.com', username: 'testuser', password: 'short' }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when username has invalid characters', async () => {
    const res = await app.request(
      '/auth/register',
      jsonBody({ email: 'test@example.com', username: 'bad user!', password: 'password123' }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when username is too short', async () => {
    const res = await app.request(
      '/auth/register',
      jsonBody({ email: 'test@example.com', username: 'ab', password: 'password123' }),
    )
    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AP-011 — POST /auth/login
// ─────────────────────────────────────────────────────────────────────────────

describe('AP-011 POST /auth/login', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockBunPassword.verify.mockResolvedValue(true)
  })

  it('returns 200 and sets auth_token cookie on success', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(makeUserRow() as never)

    const res = await app.request(
      '/auth/login',
      jsonBody({ email: 'test@example.com', password: 'password123' }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.id).toBe(1)
    expect(body.data.username).toBe('testuser')
    expect(body.data.role).toBe('READER')

    // Check cookie is set
    const setCookieHeader = res.headers.get('set-cookie')
    expect(setCookieHeader).toBeTruthy()
    expect(setCookieHeader).toContain('auth_token=')
    expect(setCookieHeader).toContain('HttpOnly')
  })

  it('does not expose email in login response data', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(makeUserRow() as never)

    const res = await app.request(
      '/auth/login',
      jsonBody({ email: 'test@example.com', password: 'password123' }),
    )

    const body = await res.json()
    expect(body.data).not.toHaveProperty('email')
    expect(body.data).not.toHaveProperty('passwordHash')
  })

  it('returns 401 on wrong password', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(makeUserRow() as never)
    mockBunPassword.verify.mockResolvedValueOnce(false)

    const res = await app.request(
      '/auth/login',
      jsonBody({ email: 'test@example.com', password: 'wrongpassword' }),
    )

    expect(res.status).toBe(401)
  })

  it('returns 401 when email is not found', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(null)

    const res = await app.request(
      '/auth/login',
      jsonBody({ email: 'unknown@example.com', password: 'password123' }),
    )

    expect(res.status).toBe(401)
  })

  it('returns 400 when body is invalid', async () => {
    const res = await app.request(
      '/auth/login',
      jsonBody({ email: 'not-an-email', password: 'password123' }),
    )
    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AP-012 — POST /auth/logout
// ─────────────────────────────────────────────────────────────────────────────

describe('AP-012 POST /auth/logout', () => {
  it('returns 200 and clears the auth_token cookie', async () => {
    const res = await app.request('/auth/logout', { method: 'POST' })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.message).toBe('Logged out')

    // Cookie should be cleared (maxAge=0 or expires in the past)
    const setCookieHeader = res.headers.get('set-cookie')
    expect(setCookieHeader).toBeTruthy()
    expect(setCookieHeader).toContain('auth_token=')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AP-013 — GET /users/:id/profile
// ─────────────────────────────────────────────────────────────────────────────

describe('AP-013 GET /users/:id/profile', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns 200 with public profile fields', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: 1,
      username: 'testuser',
      role: 'READER',
      createdAt: new Date('2026-01-01'),
      _count: { suggestions: 5 },
      suggestions: [{ id: 10 }, { id: 20 }],
    } as never)

    const res = await app.request('/users/1/profile')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.id).toBe(1)
    expect(body.data.username).toBe('testuser')
    expect(body.data.role).toBe('READER')
    expect(body.data.acceptedCount).toBe(2)
    expect(body.data.suggestionsCount).toBe(5)
    expect(body.data).toHaveProperty('createdAt')
  })

  it('does not expose sensitive fields (email, passwordHash)', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: 1,
      username: 'testuser',
      role: 'READER',
      createdAt: new Date('2026-01-01'),
      _count: { suggestions: 3 },
      suggestions: [],
    } as never)

    const res = await app.request('/users/1/profile')
    const body = await res.json()

    expect(body.data).not.toHaveProperty('email')
    expect(body.data).not.toHaveProperty('passwordHash')
  })

  it('returns 404 when user not found', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValueOnce(null)

    const res = await app.request('/users/99999/profile')

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('User not found')
  })
})
