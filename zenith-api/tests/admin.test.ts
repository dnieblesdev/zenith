import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// Type alias for Prisma-style transaction callbacks used in mocks
type TxFn<T> = (tx: unknown) => Promise<T>

// ─────────────────────────────────────────────────────────────────────────────
// Mock DB — must be before imports that use db
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('../src/lib/db', () => ({
  db: {
    novel: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    chapter: {
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    suggestion: {
      findUnique: vi.fn(),
      update: vi.fn(),
      groupBy: vi.fn(),
    },
    correction: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    vote: {
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

// Mock auth to avoid DB dependency
vi.mock('../src/lib/auth', () => ({
  auth: {
    handler: vi.fn(),
  },
}))

// Mock authMiddleware — passes with READER role by default
vi.mock('../src/middleware/auth', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authMiddleware: vi.fn(async (c: any, next: () => Promise<void>) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    c.set('user', { id: 1, username: 'testuser', email: 'test@example.com', role: 'READER' })
    await next()
  }),
}))

// Mock adminMiddleware — by default grants ADMIN access for 'Bearer admin-token'
vi.mock('../src/middleware/admin', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminMiddleware: vi.fn(async (c: any, next: () => Promise<void>) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    if (authHeader === 'Bearer non-admin-token') {
      return c.json({ error: 'Forbidden' }, 403)
    }
    c.set('user', { id: 1, username: 'admin', email: 'admin@example.com', role: 'ADMIN' })
    await next()
  }),
}))

import { db } from '../src/lib/db'
import { adminMiddleware } from '../src/middleware/admin'
import { app } from '../src/index'
import {
  createNovel,
  updateNovel,
  syncNovel,
  overrideSuggestionStatus,
  getStats,
} from '../src/services/admin'

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

process.env.BETTER_AUTH_SECRET = 'test-secret-key-for-jwt-signing-minimum-32-chars'

/** Re-apply adminMiddleware mock after vi.resetAllMocks() */
function restoreAdminMock() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(adminMiddleware).mockImplementation(async (c: any, next: () => Promise<void>) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    if (authHeader === 'Bearer non-admin-token') {
      return c.json({ error: 'Forbidden' }, 403)
    }
    c.set('user', { id: 1, username: 'admin', email: 'admin@example.com', role: 'ADMIN' })
    await next()
  })
}

function makeNovelRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: 'The Wandering Sword',
    slug: 'the-wandering-sword',
    url: 'https://example.com/novel/the-wandering-sword',
    coverUrl: 'https://example.com/cover.jpg',
    description: 'A great story.',
    status: 'Ongoing',
    language: 'en',
    reads: 0,
    authorId: null,
    author: null,
    genres: [],
    _count: { chapters: 0 },
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    modifiedBy: null,
    ...overrides,
  }
}

function makeSuggestionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    chapterId: 1,
    novelId: 2,
    userId: 5,
    paragraphIndex: 3,
    originalText: 'Original text.',
    proposedText: 'Proposed text.',
    note: null,
    status: 'PENDING',
    voteCount: 5,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function adminHeaders() {
  return { Authorization: 'Bearer admin-token' }
}

function jsonBody(body: Record<string, unknown>, method = 'POST') {
  return {
    method,
    headers: { 'Content-Type': 'application/json', ...adminHeaders() },
    body: JSON.stringify(body),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit: createNovel service
// ─────────────────────────────────────────────────────────────────────────────

describe('createNovel service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('creates a novel and returns NovelDetail', async () => {
    const created = { id: 1 }
    vi.mocked(db.novel.create).mockResolvedValueOnce(created as never)
    vi.mocked(db.novel.findUniqueOrThrow).mockResolvedValueOnce(makeNovelRow() as never)

    const result = await createNovel({
      title: 'The Wandering Sword',
      url: 'https://example.com/novel/the-wandering-sword',
      slug: 'the-wandering-sword',
      language: 'en',
    })

    expect(result.data.id).toBe(1)
    expect(result.data.title).toBe('The Wandering Sword')
    expect(result.data.slug).toBe('the-wandering-sword')
    expect(db.novel.create).toHaveBeenCalledOnce()
  })

  it('throws 409 on url conflict (P2002)', async () => {
    const { PrismaClientKnownRequestError } = await import(
      '@prisma/client/runtime/library'
    )
    const err = new PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
      meta: { target: ['url'] },
    })
    vi.mocked(db.novel.create).mockRejectedValueOnce(err)

    await expect(
      createNovel({
        title: 'Test',
        url: 'https://example.com/duplicate',
        slug: 'duplicate',
        language: 'en',
      }),
    ).rejects.toThrow()
  })

  it('throws 409 on slug conflict (P2002)', async () => {
    const { PrismaClientKnownRequestError } = await import(
      '@prisma/client/runtime/library'
    )
    const err = new PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
      meta: { target: ['slug'] },
    })
    vi.mocked(db.novel.create).mockRejectedValueOnce(err)

    await expect(
      createNovel({
        title: 'Test',
        url: 'https://example.com/new',
        slug: 'duplicate-slug',
        language: 'en',
      }),
    ).rejects.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Unit: updateNovel service
// ─────────────────────────────────────────────────────────────────────────────

describe('updateNovel service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('updates novel and returns updated NovelDetail', async () => {
    vi.mocked(db.novel.findUnique).mockResolvedValueOnce({ id: 1 } as never)
    vi.mocked(db.novel.update).mockResolvedValueOnce({} as never)
    vi.mocked(db.novel.findUniqueOrThrow).mockResolvedValueOnce(
      makeNovelRow({ title: 'Updated Title', status: 'Complete' }) as never,
    )

    const result = await updateNovel(1, { title: 'Updated Title', status: 'Complete' })

    expect(result.data.title).toBe('Updated Title')
    expect(result.data.status).toBe('Complete')
    expect(db.novel.update).toHaveBeenCalledOnce()
  })

  it('throws 404 when novel not found', async () => {
    vi.mocked(db.novel.findUnique).mockResolvedValueOnce(null)

    await expect(updateNovel(99, { title: 'X' })).rejects.toThrow()
  })

  it('only updates provided fields (partial update)', async () => {
    vi.mocked(db.novel.findUnique).mockResolvedValueOnce({ id: 1 } as never)
    vi.mocked(db.novel.update).mockResolvedValueOnce({} as never)
    vi.mocked(db.novel.findUniqueOrThrow).mockResolvedValueOnce(makeNovelRow() as never)

    await updateNovel(1, { status: 'Complete' })

    // update called with only status
    expect(vi.mocked(db.novel.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'Complete' },
      }),
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Unit: syncNovel service
// ─────────────────────────────────────────────────────────────────────────────

describe('syncNovel service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns queued sync result for existing novel', async () => {
    vi.mocked(db.novel.findUnique).mockResolvedValueOnce({ id: 5 } as never)

    const result = await syncNovel(5)

    expect(result.novelId).toBe(5)
    expect(result.queued).toBe(true)
    expect(result.message).toContain('5')
  })

  it('throws 404 when novel not found', async () => {
    vi.mocked(db.novel.findUnique).mockResolvedValueOnce(null)

    await expect(syncNovel(99)).rejects.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Unit: overrideSuggestionStatus service
// ─────────────────────────────────────────────────────────────────────────────

describe('overrideSuggestionStatus service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('sets status to REJECTED without creating correction', async () => {
    vi.mocked(db.$transaction).mockImplementationOnce(async (fn: TxFn<unknown>) => {
      const tx = {
        suggestion: {
          findUnique: vi.fn().mockResolvedValueOnce(makeSuggestionRow()),
          update: vi.fn().mockResolvedValueOnce({
            id: 10,
            status: 'REJECTED',
            chapterId: 1,
            paragraphIndex: 3,
            voteCount: 5,
          }),
        },
        correction: {
          findUnique: vi.fn(),
          create: vi.fn(),
          delete: vi.fn(),
        },
      }
      return fn(tx)
    })

    const result = await overrideSuggestionStatus(10, 'REJECTED')

    expect(result.status).toBe('REJECTED')
    expect(result.correctionCreated).toBe(false)
    expect(result.correctionSuperseded).toBe(false)
  })

  it('sets status to APPLIED and creates correction when none exists', async () => {
    const mockCorrectionCreate = vi.fn().mockResolvedValueOnce({ id: 100 })

    vi.mocked(db.$transaction).mockImplementationOnce(async (fn: TxFn<unknown>) => {
      const tx = {
        suggestion: {
          findUnique: vi.fn().mockResolvedValueOnce(makeSuggestionRow()),
          update: vi.fn().mockResolvedValueOnce({
            id: 10,
            status: 'APPLIED',
            chapterId: 1,
            paragraphIndex: 3,
            voteCount: 5,
          }),
        },
        correction: {
          findUnique: vi.fn().mockResolvedValueOnce(null),
          create: mockCorrectionCreate,
          delete: vi.fn(),
        },
      }
      return fn(tx)
    })

    const result = await overrideSuggestionStatus(10, 'APPLIED')

    expect(result.status).toBe('APPLIED')
    expect(result.correctionCreated).toBe(true)
    expect(result.correctionSuperseded).toBe(false)
    expect(mockCorrectionCreate).toHaveBeenCalledOnce()
  })

  it('supersedes old correction when applying over existing one', async () => {
    const existingCorrection = { id: 99, chapterId: 1, paragraphIndex: 3, suggestionId: 7 }
    const mockSuggestionUpdate = vi.fn().mockResolvedValue({
      id: 10,
      status: 'APPLIED',
      chapterId: 1,
      paragraphIndex: 3,
      voteCount: 5,
    })
    const mockCorrectionDelete = vi.fn().mockResolvedValueOnce({})
    const mockCorrectionCreate = vi.fn().mockResolvedValueOnce({ id: 100 })

    vi.mocked(db.$transaction).mockImplementationOnce(async (fn: TxFn<unknown>) => {
      const tx = {
        suggestion: {
          findUnique: vi.fn().mockResolvedValueOnce(makeSuggestionRow()),
          update: mockSuggestionUpdate,
        },
        correction: {
          findUnique: vi.fn().mockResolvedValueOnce(existingCorrection),
          create: mockCorrectionCreate,
          delete: mockCorrectionDelete,
        },
      }
      return fn(tx)
    })

    const result = await overrideSuggestionStatus(10, 'APPLIED')

    expect(result.correctionCreated).toBe(true)
    expect(result.correctionSuperseded).toBe(true)
    // Old suggestion marked as SUPERSEDED
    expect(mockSuggestionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        data: { status: 'SUPERSEDED' },
      }),
    )
    // Old correction deleted
    expect(mockCorrectionDelete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 99 } }),
    )
    // New correction created
    expect(mockCorrectionCreate).toHaveBeenCalledOnce()
  })

  it('throws 404 when suggestion not found', async () => {
    vi.mocked(db.$transaction).mockImplementationOnce(async (fn: TxFn<unknown>) => {
      const tx = {
        suggestion: {
          findUnique: vi.fn().mockResolvedValueOnce(null),
        },
        correction: { findUnique: vi.fn() },
      }
      return fn(tx)
    })

    await expect(overrideSuggestionStatus(99, 'REJECTED')).rejects.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Unit: getStats service
// ─────────────────────────────────────────────────────────────────────────────

describe('getStats service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns aggregate stats', async () => {
    vi.mocked(db.$transaction).mockResolvedValueOnce([
      5,    // novels
      20,   // chapters
      100,  // users
      [     // suggestion groupBy
        { status: 'PENDING', _count: { _all: 12 } },
        { status: 'APPLIED', _count: { _all: 8 } },
        { status: 'REJECTED', _count: { _all: 3 } },
        { status: 'SUPERSEDED', _count: { _all: 1 } },
      ],
      8,    // corrections
      150,  // votes
    ])

    const result = await getStats()

    expect(result.novels).toBe(5)
    expect(result.chapters).toBe(20)
    expect(result.users).toBe(100)
    expect(result.suggestions.total).toBe(24)
    expect(result.suggestions.pending).toBe(12)
    expect(result.suggestions.applied).toBe(8)
    expect(result.suggestions.rejected).toBe(3)
    expect(result.suggestions.superseded).toBe(1)
    expect(result.corrections).toBe(8)
    expect(result.votes).toBe(150)
  })

  it('returns 0 for missing suggestion statuses', async () => {
    vi.mocked(db.$transaction).mockResolvedValueOnce([
      0, 0, 0,
      [], // no suggestions at all
      0, 0,
    ])

    const result = await getStats()

    expect(result.suggestions.total).toBe(0)
    expect(result.suggestions.pending).toBe(0)
    expect(result.suggestions.applied).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integration: Admin access guard (all endpoints)
// ─────────────────────────────────────────────────────────────────────────────

describe('Admin access guard', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    restoreAdminMock()
  })

  it('returns 401 when unauthenticated', async () => {
    const res = await app.request('/admin/stats')
    expect(res.status).toBe(401)
  })

  it('returns 403 when authenticated as non-admin', async () => {
    const res = await app.request('/admin/stats', {
      headers: { Authorization: 'Bearer non-admin-token' },
    })
    expect(res.status).toBe(403)
  })

  it('allows access with admin token', async () => {
    vi.mocked(db.$transaction).mockResolvedValueOnce([
      0, 0, 0, [], 0, 0,
    ])

    const res = await app.request('/admin/stats', {
      headers: adminHeaders(),
    })
    expect(res.status).toBe(200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integration: AP-030 POST /admin/novels
// ─────────────────────────────────────────────────────────────────────────────

describe('AP-030 POST /admin/novels', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    restoreAdminMock()
  })

  it('returns 201 with created novel', async () => {
    vi.mocked(db.novel.create).mockResolvedValueOnce({ id: 1 } as never)
    vi.mocked(db.novel.findUniqueOrThrow).mockResolvedValueOnce(makeNovelRow() as never)

    const res = await app.request(
      '/admin/novels',
      jsonBody({
        title: 'The Wandering Sword',
        url: 'https://example.com/novel/the-wandering-sword',
        slug: 'the-wandering-sword',
        language: 'en',
      }),
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBe(1)
    expect(body.data.title).toBe('The Wandering Sword')
  })

  it('returns 201 with optional fields', async () => {
    vi.mocked(db.novel.create).mockResolvedValueOnce({ id: 2 } as never)
    vi.mocked(db.novel.findUniqueOrThrow).mockResolvedValueOnce(
      makeNovelRow({
        id: 2,
        description: 'A great epic.',
        coverUrl: 'https://example.com/cover.jpg',
        status: 'Ongoing',
      }) as never,
    )

    const res = await app.request(
      '/admin/novels',
      jsonBody({
        title: 'Epic Story',
        url: 'https://example.com/epic-story',
        slug: 'epic-story',
        language: 'es',
        description: 'A great epic.',
        coverUrl: 'https://example.com/cover.jpg',
        status: 'Ongoing',
      }),
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.description).toBe('A great epic.')
    expect(body.data.status).toBe('Ongoing')
  })

  it('returns 400 when title is missing', async () => {
    const res = await app.request(
      '/admin/novels',
      jsonBody({
        url: 'https://example.com/novel',
        slug: 'novel',
        language: 'en',
      }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when url is invalid', async () => {
    const res = await app.request(
      '/admin/novels',
      jsonBody({
        title: 'Test',
        url: 'not-a-url',
        slug: 'test',
        language: 'en',
      }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when slug has invalid characters', async () => {
    const res = await app.request(
      '/admin/novels',
      jsonBody({
        title: 'Test',
        url: 'https://example.com/test',
        slug: 'Test Novel!',
        language: 'en',
      }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when language is invalid', async () => {
    const res = await app.request(
      '/admin/novels',
      jsonBody({
        title: 'Test',
        url: 'https://example.com/test',
        slug: 'test',
        language: 'fr',
      }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const res = await app.request('/admin/novels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', url: 'https://example.com', slug: 'test', language: 'en' }),
    })
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integration: AP-031 PUT /admin/novels/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('AP-031 PUT /admin/novels/:id', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    restoreAdminMock()
  })

  it('returns 200 with updated novel', async () => {
    vi.mocked(db.novel.findUnique).mockResolvedValueOnce({ id: 1 } as never)
    vi.mocked(db.novel.update).mockResolvedValueOnce({} as never)
    vi.mocked(db.novel.findUniqueOrThrow).mockResolvedValueOnce(
      makeNovelRow({ title: 'New Title' }) as never,
    )

    const res = await app.request(
      '/admin/novels/1',
      jsonBody({ title: 'New Title' }, 'PUT'),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.title).toBe('New Title')
  })

  it('returns 404 when novel not found', async () => {
    vi.mocked(db.novel.findUnique).mockResolvedValueOnce(null)

    const res = await app.request(
      '/admin/novels/99',
      jsonBody({ title: 'X' }, 'PUT'),
    )

    expect(res.status).toBe(404)
  })

  it('returns 200 with partial update (status only)', async () => {
    vi.mocked(db.novel.findUnique).mockResolvedValueOnce({ id: 1 } as never)
    vi.mocked(db.novel.update).mockResolvedValueOnce({} as never)
    vi.mocked(db.novel.findUniqueOrThrow).mockResolvedValueOnce(
      makeNovelRow({ status: 'Complete' }) as never,
    )

    const res = await app.request(
      '/admin/novels/1',
      jsonBody({ status: 'Complete' }, 'PUT'),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('Complete')
  })

  it('returns 400 when language is invalid', async () => {
    const res = await app.request(
      '/admin/novels/1',
      jsonBody({ language: 'de' }, 'PUT'),
    )
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    const res = await app.request('/admin/novels/1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'X' }),
    })
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integration: AP-032 POST /admin/novels/:id/sync
// ─────────────────────────────────────────────────────────────────────────────

describe('AP-032 POST /admin/novels/:id/sync', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    restoreAdminMock()
  })

  it('returns 202 with sync acknowledgement', async () => {
    vi.mocked(db.novel.findUnique).mockResolvedValueOnce({ id: 5 } as never)

    const res = await app.request('/admin/novels/5/sync', {
      method: 'POST',
      headers: adminHeaders(),
    })

    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.novelId).toBe(5)
    expect(body.queued).toBe(true)
    expect(body.message).toBeDefined()
  })

  it('returns 404 when novel not found', async () => {
    vi.mocked(db.novel.findUnique).mockResolvedValueOnce(null)

    const res = await app.request('/admin/novels/99/sync', {
      method: 'POST',
      headers: adminHeaders(),
    })

    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    const res = await app.request('/admin/novels/1/sync', { method: 'POST' })
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integration: AP-033 PUT /admin/suggestions/:id/status
// ─────────────────────────────────────────────────────────────────────────────

describe('AP-033 PUT /admin/suggestions/:id/status', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    restoreAdminMock()
  })

  it('returns 200 when setting status to REJECTED', async () => {
    vi.mocked(db.$transaction).mockImplementationOnce(async (fn: TxFn<unknown>) => {
      const tx = {
        suggestion: {
          findUnique: vi.fn().mockResolvedValueOnce(makeSuggestionRow()),
          update: vi.fn().mockResolvedValueOnce({
            id: 10,
            status: 'REJECTED',
            chapterId: 1,
            paragraphIndex: 3,
            voteCount: 5,
          }),
        },
        correction: {
          findUnique: vi.fn(),
          create: vi.fn(),
          delete: vi.fn(),
        },
      }
      return fn(tx)
    })

    const res = await app.request(
      '/admin/suggestions/10/status',
      jsonBody({ status: 'REJECTED' }, 'PUT'),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('REJECTED')
    expect(body.correctionCreated).toBe(false)
  })

  it('returns 200 when setting status to APPLIED', async () => {
    vi.mocked(db.$transaction).mockImplementationOnce(async (fn: TxFn<unknown>) => {
      const tx = {
        suggestion: {
          findUnique: vi.fn().mockResolvedValueOnce(makeSuggestionRow()),
          update: vi.fn().mockResolvedValueOnce({
            id: 10,
            status: 'APPLIED',
            chapterId: 1,
            paragraphIndex: 3,
            voteCount: 5,
          }),
        },
        correction: {
          findUnique: vi.fn().mockResolvedValueOnce(null),
          create: vi.fn().mockResolvedValueOnce({ id: 100 }),
          delete: vi.fn(),
        },
      }
      return fn(tx)
    })

    const res = await app.request(
      '/admin/suggestions/10/status',
      jsonBody({ status: 'APPLIED' }, 'PUT'),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('APPLIED')
    expect(body.correctionCreated).toBe(true)
  })

  it('returns 400 when status is invalid', async () => {
    const res = await app.request(
      '/admin/suggestions/10/status',
      jsonBody({ status: 'PENDING' }, 'PUT'),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when status is missing', async () => {
    const res = await app.request(
      '/admin/suggestions/10/status',
      jsonBody({}, 'PUT'),
    )
    expect(res.status).toBe(400)
  })

  it('returns 404 when suggestion not found', async () => {
    vi.mocked(db.$transaction).mockImplementationOnce(async (fn: TxFn<unknown>) => {
      const tx = {
        suggestion: {
          findUnique: vi.fn().mockResolvedValueOnce(null),
        },
        correction: { findUnique: vi.fn() },
      }
      return fn(tx)
    })

    const res = await app.request(
      '/admin/suggestions/99/status',
      jsonBody({ status: 'REJECTED' }, 'PUT'),
    )

    expect(res.status).toBe(404)
  })

  it('returns 401 when unauthenticated', async () => {
    const res = await app.request('/admin/suggestions/10/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'REJECTED' }),
    })
    expect(res.status).toBe(401)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integration: AP-034 GET /admin/stats
// ─────────────────────────────────────────────────────────────────────────────

describe('AP-034 GET /admin/stats', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    restoreAdminMock()
  })

  it('returns 200 with platform stats', async () => {
    vi.mocked(db.$transaction).mockResolvedValueOnce([
      10,   // novels
      50,   // chapters
      200,  // users
      [
        { status: 'PENDING', _count: { _all: 15 } },
        { status: 'APPLIED', _count: { _all: 5 } },
      ],
      5,    // corrections
      100,  // votes
    ])

    const res = await app.request('/admin/stats', { headers: adminHeaders() })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.novels).toBe(10)
    expect(body.chapters).toBe(50)
    expect(body.users).toBe(200)
    expect(body.suggestions.total).toBe(20)
    expect(body.suggestions.pending).toBe(15)
    expect(body.suggestions.applied).toBe(5)
    expect(body.corrections).toBe(5)
    expect(body.votes).toBe(100)
  })

  it('returns all required fields in response', async () => {
    vi.mocked(db.$transaction).mockResolvedValueOnce([0, 0, 0, [], 0, 0])

    const res = await app.request('/admin/stats', { headers: adminHeaders() })
    const body = await res.json()

    expect(body).toHaveProperty('novels')
    expect(body).toHaveProperty('chapters')
    expect(body).toHaveProperty('users')
    expect(body).toHaveProperty('suggestions')
    expect(body.suggestions).toHaveProperty('total')
    expect(body.suggestions).toHaveProperty('pending')
    expect(body.suggestions).toHaveProperty('applied')
    expect(body.suggestions).toHaveProperty('rejected')
    expect(body.suggestions).toHaveProperty('superseded')
    expect(body).toHaveProperty('corrections')
    expect(body).toHaveProperty('votes')
  })

  it('returns 401 when unauthenticated', async () => {
    const res = await app.request('/admin/stats')
    expect(res.status).toBe(401)
  })

  it('returns 403 when authenticated as non-admin', async () => {
    const res = await app.request('/admin/stats', {
      headers: { Authorization: 'Bearer non-admin-token' },
    })
    expect(res.status).toBe(403)
  })
})
