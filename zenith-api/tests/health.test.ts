import { describe, it, expect, vi } from 'vitest'

// Mock DB to avoid PrismaClient initialization
vi.mock('../src/lib/db', () => ({
  db: {},
}))

// Mock auth to avoid DB dependency
vi.mock('../src/lib/auth', () => ({
  auth: {
    handler: vi.fn(),
  },
}))

import { app } from '../src/index'

describe('GET /health', () => {
  it('returns 200 with { status: "ok" }', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ status: 'ok' })
  })
})
