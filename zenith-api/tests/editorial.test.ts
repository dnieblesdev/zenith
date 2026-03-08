import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// Type alias for Prisma-style transaction callbacks used in mocks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxFn<T> = (tx: any) => Promise<T>

// ─────────────────────────────────────────────────────────────────────────────
// Mock DB — must be before imports that use db
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('../src/lib/db', () => ({
  db: {
    chapter: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    suggestion: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    vote: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    correction: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
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

// Mock authMiddleware — inject a user with id=1 for authenticated requests
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

import { db } from '../src/lib/db'
import { authMiddleware } from '../src/middleware/auth'
import { app } from '../src/index'
import {
  calculateThreshold,
  createSuggestion,
  listSuggestions,
  voteSuggestion,
  unvoteSuggestion,
  getSuggestion,
  MIN_VOTES,
  VOTE_RATIO,
} from '../src/services/editorial'

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

process.env.BETTER_AUTH_SECRET = 'test-secret-key-for-jwt-signing-minimum-32-chars'

/** Re-apply authMiddleware mock implementation after vi.resetAllMocks() */
function restoreAuthMock() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(authMiddleware).mockImplementation(async (c: any, next: () => Promise<void>) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    c.set('user', { id: 1, username: 'testuser', email: 'test@example.com', role: 'READER' })
    await next()
  })
}

function makeChapterRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    novelId: 2,
    language: 'en',
    reads: 100,
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
    originalText: 'Original text here.',
    proposedText: 'Proposed improvement here.',
    note: null,
    status: 'PENDING',
    voteCount: 0,
    user: { id: 5, username: 'testuser' },
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
    ...overrides,
  }
}

function makeSuggestionWithChapter(overrides: Record<string, unknown> = {}) {
  return {
    ...makeSuggestionRow(),
    chapter: makeChapterRow(),
    ...overrides,
  }
}

function makeAuthHeader() {
  // A token that the mocked `verify` will accept, returning { sub: '1' }
  return { Authorization: 'Bearer fake-token' }
}

function jsonBody(body: Record<string, unknown>, method = 'POST') {
  return {
    method,
    headers: { 'Content-Type': 'application/json', ...makeAuthHeader() },
    body: JSON.stringify(body),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit: calculateThreshold
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateThreshold', () => {
  it('returns MIN_VOTES when chapter reads are low', () => {
    expect(calculateThreshold(0)).toBe(MIN_VOTES)
    expect(calculateThreshold(100)).toBe(MIN_VOTES) // 100 * 0.02 = 2 → min 10
    expect(calculateThreshold(400)).toBe(MIN_VOTES) // 400 * 0.02 = 8 → min 10
    expect(calculateThreshold(499)).toBe(MIN_VOTES) // 499 * 0.02 = 9.98 → floor = 9 → min 10
  })

  it('returns computed value when chapter reads are high', () => {
    expect(calculateThreshold(500)).toBe(10)  // 500 * 0.02 = 10 → exactly MIN_VOTES
    expect(calculateThreshold(1000)).toBe(20) // 1000 * 0.02 = 20
    expect(calculateThreshold(5000)).toBe(100) // 5000 * 0.02 = 100
  })

  it('uses VOTE_RATIO constant', () => {
    expect(VOTE_RATIO).toBe(0.02)
    expect(MIN_VOTES).toBe(10)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Unit: createSuggestion service
// ─────────────────────────────────────────────────────────────────────────────

describe('createSuggestion service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('creates suggestion and returns detail', async () => {
    vi.mocked(db.chapter.findUnique).mockResolvedValueOnce(makeChapterRow() as never)
    vi.mocked(db.suggestion.create).mockResolvedValueOnce(makeSuggestionRow() as never)

    const result = await createSuggestion(
      {
        chapterId: 1,
        paragraphIndex: 3,
        originalText: 'Original text here.',
        proposedText: 'Proposed improvement here.',
      },
      5,
    )

    expect(result.data.id).toBe(10)
    expect(result.data.status).toBe('PENDING')
    expect(result.data.voteCount).toBe(0)
    expect(result.data.proposedText).toBe('Proposed improvement here.')
  })

  it('throws 404 when chapter not found', async () => {
    vi.mocked(db.chapter.findUnique).mockResolvedValueOnce(null)

    await expect(
      createSuggestion(
        { chapterId: 99, paragraphIndex: 0, originalText: 'A', proposedText: 'B' },
        1,
      ),
    ).rejects.toThrow()
  })

  it('throws 422 on language mismatch', async () => {
    vi.mocked(db.chapter.findUnique).mockResolvedValueOnce(
      makeChapterRow({ language: 'en' }) as never,
    )

    await expect(
      createSuggestion(
        {
          chapterId: 1,
          paragraphIndex: 0,
          originalText: 'A',
          proposedText: 'B',
          language: 'es',
        },
        1,
      ),
    ).rejects.toThrow()
  })

  it('accepts suggestion when language matches chapter', async () => {
    vi.mocked(db.chapter.findUnique).mockResolvedValueOnce(
      makeChapterRow({ language: 'en' }) as never,
    )
    vi.mocked(db.suggestion.create).mockResolvedValueOnce(makeSuggestionRow() as never)

    const result = await createSuggestion(
      {
        chapterId: 1,
        paragraphIndex: 0,
        originalText: 'A',
        proposedText: 'B',
        language: 'en',
      },
      1,
    )

    expect(result.data.id).toBe(10)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Unit: listSuggestions service
// ─────────────────────────────────────────────────────────────────────────────

describe('listSuggestions service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns paginated suggestion list', async () => {
    vi.mocked(db.chapter.findUnique).mockResolvedValueOnce(makeChapterRow() as never)
    vi.mocked(db.$transaction).mockResolvedValueOnce([[makeSuggestionRow()], 1])

    const result = await listSuggestions(1)

    expect(result.data).toHaveLength(1)
    expect(result.meta.total).toBe(1)
    expect(result.data[0].status).toBe('PENDING')
  })

  it('throws 404 when chapter not found', async () => {
    vi.mocked(db.chapter.findUnique).mockResolvedValueOnce(null)

    await expect(listSuggestions(99)).rejects.toThrow()
  })

  it('returns empty list for chapter with no suggestions', async () => {
    vi.mocked(db.chapter.findUnique).mockResolvedValueOnce(makeChapterRow() as never)
    vi.mocked(db.$transaction).mockResolvedValueOnce([[], 0])

    const result = await listSuggestions(1)

    expect(result.data).toHaveLength(0)
    expect(result.meta.total).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Unit: voteSuggestion service
// ─────────────────────────────────────────────────────────────────────────────

describe('voteSuggestion service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('votes successfully and returns updated voteCount', async () => {
    // Set up transaction mock to execute the callback
    vi.mocked(db.$transaction).mockImplementationOnce(async (fn: TxFn<unknown>) => {
      const tx = {
        suggestion: {
          findUnique: vi.fn().mockResolvedValueOnce(makeSuggestionWithChapter()),
          update: vi.fn().mockResolvedValueOnce({ voteCount: 1 }),
        },
        vote: {
          findUnique: vi.fn().mockResolvedValueOnce(null),
          create: vi.fn().mockResolvedValueOnce({ id: 1 }),
        },
        correction: {
          findUnique: vi.fn().mockResolvedValueOnce(null),
        },
      }
      return fn(tx)
    })

    const result = await voteSuggestion(10, 99) // user 99 votes on suggestion by user 5

    expect(result.suggestionId).toBe(10)
    expect(result.voteCount).toBe(1)
    expect(result.applied).toBe(false) // 1 vote, threshold is 10
  })

  it('throws 403 on self-vote', async () => {
    vi.mocked(db.$transaction).mockImplementationOnce(async (fn: TxFn<unknown>) => {
      const tx = {
        suggestion: {
          findUnique: vi.fn().mockResolvedValueOnce(
            makeSuggestionWithChapter({ userId: 5 }) // suggestion owner is user 5
          ),
        },
        vote: { findUnique: vi.fn() },
        correction: { findUnique: vi.fn() },
      }
      return fn(tx)
    })

    await expect(voteSuggestion(10, 5)).rejects.toThrow('Cannot vote on your own suggestion')
  })

  it('throws 409 on duplicate vote', async () => {
    vi.mocked(db.$transaction).mockImplementationOnce(async (fn: TxFn<unknown>) => {
      const tx = {
        suggestion: {
          findUnique: vi.fn().mockResolvedValueOnce(makeSuggestionWithChapter()),
        },
        vote: {
          findUnique: vi.fn().mockResolvedValueOnce({ id: 1 }), // existing vote
        },
        correction: { findUnique: vi.fn() },
      }
      return fn(tx)
    })

    await expect(voteSuggestion(10, 99)).rejects.toThrow('Already voted on this suggestion')
  })

  it('throws 404 when suggestion not found', async () => {
    vi.mocked(db.$transaction).mockImplementationOnce(async (fn: TxFn<unknown>) => {
      const tx = {
        suggestion: {
          findUnique: vi.fn().mockResolvedValueOnce(null),
        },
        vote: { findUnique: vi.fn() },
        correction: { findUnique: vi.fn() },
      }
      return fn(tx)
    })

    await expect(voteSuggestion(99, 1)).rejects.toThrow()
  })

  it('triggers auto-apply when threshold is met', async () => {
    // chapter has 0 reads → threshold = MIN_VOTES = 10
    // suggestion already has 9 votes, this vote makes it 10 → threshold met
    const suggestionAtThreshold = makeSuggestionWithChapter({
      voteCount: 9,
      chapter: makeChapterRow({ reads: 0 }), // threshold = 10
    })

    vi.mocked(db.$transaction).mockImplementationOnce(async (fn: TxFn<unknown>) => {
      const tx = {
        suggestion: {
          findUnique: vi.fn().mockResolvedValueOnce(suggestionAtThreshold),
          update: vi.fn().mockResolvedValueOnce({ voteCount: 10 }),
        },
        vote: {
          findUnique: vi.fn().mockResolvedValueOnce(null),
          create: vi.fn().mockResolvedValueOnce({ id: 5 }),
        },
        correction: {
          findUnique: vi.fn().mockResolvedValueOnce(null), // no existing correction
          create: vi.fn().mockResolvedValueOnce({ id: 1 }),
        },
      }
      return fn(tx)
    })

    const result = await voteSuggestion(10, 99)

    expect(result.applied).toBe(true)
    expect(result.voteCount).toBe(10)
  })

  it('supersedes old suggestion when new one has enough votes', async () => {
    // New suggestion reaches threshold, old correction exists with different suggestionId
    const suggestionAtThreshold = makeSuggestionWithChapter({
      id: 20,
      userId: 5,
      voteCount: 9,
      chapter: makeChapterRow({ reads: 0 }), // threshold = 10
    })

    const existingCorrection = { id: 99, chapterId: 1, paragraphIndex: 3, suggestionId: 10 } // different suggestion

    const mockSuggestionUpdate = vi.fn().mockResolvedValue({ voteCount: 10 })
    const mockCorrectionDelete = vi.fn().mockResolvedValue({})
    const mockCorrectionCreate = vi.fn().mockResolvedValue({ id: 100 })

    vi.mocked(db.$transaction).mockImplementationOnce(async (fn: TxFn<unknown>) => {
      const tx = {
        suggestion: {
          findUnique: vi.fn().mockResolvedValueOnce(suggestionAtThreshold),
          update: mockSuggestionUpdate,
        },
        vote: {
          findUnique: vi.fn().mockResolvedValueOnce(null),
          create: vi.fn().mockResolvedValueOnce({ id: 5 }),
        },
        correction: {
          findUnique: vi.fn().mockResolvedValueOnce(existingCorrection),
          delete: mockCorrectionDelete,
          create: mockCorrectionCreate,
        },
      }
      return fn(tx)
    })

    const result = await voteSuggestion(20, 99)

    expect(result.applied).toBe(true)
    // Old suggestion should be marked SUPERSEDED
    expect(mockSuggestionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: { status: 'SUPERSEDED' },
      }),
    )
    // Old correction should be deleted
    expect(mockCorrectionDelete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 99 } }),
    )
    // New correction created
    expect(mockCorrectionCreate).toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Unit: unvoteSuggestion service
// ─────────────────────────────────────────────────────────────────────────────

describe('unvoteSuggestion service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('removes vote and decrements voteCount', async () => {
    vi.mocked(db.$transaction).mockImplementationOnce(async (fn: TxFn<unknown>) => {
      const tx = {
        suggestion: {
          findUnique: vi.fn().mockResolvedValueOnce({ id: 10 }),
          update: vi.fn().mockResolvedValueOnce({ voteCount: 4 }),
        },
        vote: {
          findUnique: vi.fn().mockResolvedValueOnce({ id: 7 }),
          delete: vi.fn().mockResolvedValueOnce({}),
        },
      }
      return fn(tx)
    })

    const result = await unvoteSuggestion(10, 99)

    expect(result.suggestionId).toBe(10)
    expect(result.voteCount).toBe(4)
  })

  it('throws 404 when suggestion not found', async () => {
    vi.mocked(db.$transaction).mockImplementationOnce(async (fn: TxFn<unknown>) => {
      const tx = {
        suggestion: {
          findUnique: vi.fn().mockResolvedValueOnce(null),
        },
        vote: { findUnique: vi.fn() },
      }
      return fn(tx)
    })

    await expect(unvoteSuggestion(99, 1)).rejects.toThrow()
  })

  it('throws 404 when vote not found', async () => {
    vi.mocked(db.$transaction).mockImplementationOnce(async (fn: TxFn<unknown>) => {
      const tx = {
        suggestion: {
          findUnique: vi.fn().mockResolvedValueOnce({ id: 10 }),
        },
        vote: {
          findUnique: vi.fn().mockResolvedValueOnce(null), // vote doesn't exist
        },
      }
      return fn(tx)
    })

    await expect(unvoteSuggestion(10, 99)).rejects.toThrow()
  })

  it('floors voteCount at 0 (no negative counts)', async () => {
    vi.mocked(db.$transaction).mockImplementationOnce(async (fn: TxFn<unknown>) => {
      const tx = {
        suggestion: {
          findUnique: vi.fn().mockResolvedValueOnce({ id: 10 }),
          update: vi.fn().mockResolvedValueOnce({ voteCount: -1 }), // edge case
        },
        vote: {
          findUnique: vi.fn().mockResolvedValueOnce({ id: 7 }),
          delete: vi.fn().mockResolvedValueOnce({}),
        },
      }
      return fn(tx)
    })

    const result = await unvoteSuggestion(10, 99)

    expect(result.voteCount).toBe(0) // floored at 0
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Unit: getSuggestion service
// ─────────────────────────────────────────────────────────────────────────────

describe('getSuggestion service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns suggestion detail', async () => {
    vi.mocked(db.suggestion.findUnique).mockResolvedValueOnce(makeSuggestionRow() as never)

    const result = await getSuggestion(10)

    expect(result.data.id).toBe(10)
    expect(result.data.status).toBe('PENDING')
    expect(result.data.user.username).toBe('testuser')
  })

  it('throws 404 when suggestion not found', async () => {
    vi.mocked(db.suggestion.findUnique).mockResolvedValueOnce(null)

    await expect(getSuggestion(99)).rejects.toThrow()
  })

  it('includes proposedText in response', async () => {
    vi.mocked(db.suggestion.findUnique).mockResolvedValueOnce(
      makeSuggestionRow({ proposedText: 'Better wording.' }) as never,
    )

    const result = await getSuggestion(10)

    expect(result.data.proposedText).toBe('Better wording.')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integration: AP-020 POST /chapters/:id/suggestions
// ─────────────────────────────────────────────────────────────────────────────

describe('AP-020 POST /chapters/:id/suggestions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    restoreAuthMock()
  })

  it('returns 201 with suggestion on success', async () => {
    vi.mocked(db.chapter.findUnique).mockResolvedValueOnce(makeChapterRow() as never)
    vi.mocked(db.suggestion.create).mockResolvedValueOnce(makeSuggestionRow() as never)

    const res = await app.request(
      '/chapters/1/suggestions',
      jsonBody({
        paragraphIndex: 3,
        originalText: 'Original text here.',
        proposedText: 'Proposed improvement here.',
      }),
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBe(10)
    expect(body.data.status).toBe('PENDING')
  })

  it('returns 401 when not authenticated', async () => {
    const res = await app.request('/chapters/1/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paragraphIndex: 3,
        originalText: 'A',
        proposedText: 'B',
      }),
    })

    expect(res.status).toBe(401)
  })

  it('returns 422 on language mismatch', async () => {
    vi.mocked(db.chapter.findUnique).mockResolvedValueOnce(
      makeChapterRow({ language: 'en' }) as never,
    )

    const res = await app.request(
      '/chapters/1/suggestions',
      jsonBody({
        paragraphIndex: 0,
        originalText: 'A',
        proposedText: 'B',
        language: 'es',
      }),
    )

    expect(res.status).toBe(422)
  })

  it('returns 400 when body is invalid', async () => {
    const res = await app.request(
      '/chapters/1/suggestions',
      jsonBody({
        // missing paragraphIndex, originalText, proposedText
      }),
    )

    expect(res.status).toBe(400)
  })

  it('returns 404 when chapter not found', async () => {
    vi.mocked(db.chapter.findUnique).mockResolvedValueOnce(null)

    const res = await app.request(
      '/chapters/1/suggestions',
      jsonBody({
        paragraphIndex: 0,
        originalText: 'A',
        proposedText: 'B',
      }),
    )

    expect(res.status).toBe(404)
  })

  it('returns 400 when proposedText equals originalText', async () => {
    const res = await app.request(
      '/chapters/1/suggestions',
      jsonBody({
        paragraphIndex: 0,
        originalText: 'Same text.',
        proposedText: 'Same text.',
      }),
    )

    expect(res.status).toBe(400)
  })

  it('accepts optional note field and includes it in response', async () => {
    vi.mocked(db.chapter.findUnique).mockResolvedValueOnce(makeChapterRow() as never)
    vi.mocked(db.suggestion.create).mockResolvedValueOnce(
      makeSuggestionRow({ note: 'This word is more precise here.' }) as never,
    )

    const res = await app.request(
      '/chapters/1/suggestions',
      jsonBody({
        paragraphIndex: 3,
        originalText: 'Original text here.',
        proposedText: 'Proposed improvement here.',
        note: 'This word is more precise here.',
      }),
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.note).toBe('This word is more precise here.')
  })

  it('returns 400 when note exceeds 500 characters', async () => {
    const res = await app.request(
      '/chapters/1/suggestions',
      jsonBody({
        paragraphIndex: 0,
        originalText: 'A',
        proposedText: 'B',
        note: 'x'.repeat(501),
      }),
    )

    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integration: AP-021 GET /chapters/:id/suggestions
// ─────────────────────────────────────────────────────────────────────────────

describe('AP-021 GET /chapters/:id/suggestions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    restoreAuthMock()
  })

  it('returns 200 with suggestion list', async () => {
    vi.mocked(db.chapter.findUnique).mockResolvedValueOnce(makeChapterRow() as never)
    vi.mocked(db.$transaction).mockResolvedValueOnce([[makeSuggestionRow()], 1])

    const res = await app.request('/chapters/1/suggestions')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.meta.total).toBe(1)
  })

  it('returns 404 when chapter not found', async () => {
    vi.mocked(db.chapter.findUnique).mockResolvedValueOnce(null)

    const res = await app.request('/chapters/99/suggestions')

    expect(res.status).toBe(404)
  })

  it('is public — no auth required', async () => {
    vi.mocked(db.chapter.findUnique).mockResolvedValueOnce(makeChapterRow() as never)
    vi.mocked(db.$transaction).mockResolvedValueOnce([[], 0])

    const res = await app.request('/chapters/1/suggestions')

    expect(res.status).toBe(200)
  })

  it('supports paragraphIndex filter', async () => {
    vi.mocked(db.chapter.findUnique).mockResolvedValueOnce(makeChapterRow() as never)
    vi.mocked(db.$transaction).mockResolvedValueOnce([[], 0])

    const res = await app.request('/chapters/1/suggestions?paragraphIndex=3')

    expect(res.status).toBe(200)
  })

  it('supports status filter', async () => {
    vi.mocked(db.chapter.findUnique).mockResolvedValueOnce(makeChapterRow() as never)
    vi.mocked(db.$transaction).mockResolvedValueOnce([[], 0])

    const res = await app.request('/chapters/1/suggestions?status=PENDING')

    expect(res.status).toBe(200)
  })

  it('returns 400 for invalid status filter', async () => {
    const res = await app.request('/chapters/1/suggestions?status=INVALID_STATUS')

    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integration: AP-022 POST /suggestions/:id/vote
// ─────────────────────────────────────────────────────────────────────────────

describe('AP-022 POST /suggestions/:id/vote', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    restoreAuthMock()
  })

  it('returns 201 on successful vote', async () => {
    vi.mocked(db.$transaction).mockImplementationOnce(async (fn: TxFn<unknown>) => {
      const tx = {
        suggestion: {
          findUnique: vi.fn().mockResolvedValueOnce(
            makeSuggestionWithChapter({ userId: 99 }) // different from auth user (1)
          ),
          update: vi.fn().mockResolvedValueOnce({ voteCount: 1 }),
        },
        vote: {
          findUnique: vi.fn().mockResolvedValueOnce(null),
          create: vi.fn().mockResolvedValueOnce({ id: 1 }),
        },
        correction: {
          findUnique: vi.fn().mockResolvedValueOnce(null),
        },
      }
      return fn(tx)
    })

    const res = await app.request('/suggestions/10/vote', {
      method: 'POST',
      headers: makeAuthHeader(),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.suggestionId).toBe(10)
    expect(body.voteCount).toBe(1)
  })

  it('returns 401 when not authenticated', async () => {
    const res = await app.request('/suggestions/10/vote', { method: 'POST' })

    expect(res.status).toBe(401)
  })

  it('returns 403 on self-vote', async () => {
    vi.mocked(db.$transaction).mockImplementationOnce(async (fn: TxFn<unknown>) => {
      const tx = {
        suggestion: {
          findUnique: vi.fn().mockResolvedValueOnce(
            makeSuggestionWithChapter({ userId: 1 }) // same as auth user (1)
          ),
        },
        vote: { findUnique: vi.fn() },
        correction: { findUnique: vi.fn() },
      }
      return fn(tx)
    })

    const res = await app.request('/suggestions/10/vote', {
      method: 'POST',
      headers: makeAuthHeader(),
    })

    expect(res.status).toBe(403)
  })

  it('returns 409 on duplicate vote', async () => {
    vi.mocked(db.$transaction).mockImplementationOnce(async (fn: TxFn<unknown>) => {
      const tx = {
        suggestion: {
          findUnique: vi.fn().mockResolvedValueOnce(
            makeSuggestionWithChapter({ userId: 99 })
          ),
        },
        vote: {
          findUnique: vi.fn().mockResolvedValueOnce({ id: 7 }), // existing
        },
        correction: { findUnique: vi.fn() },
      }
      return fn(tx)
    })

    const res = await app.request('/suggestions/10/vote', {
      method: 'POST',
      headers: makeAuthHeader(),
    })

    expect(res.status).toBe(409)
  })

  it('triggers auto-apply when threshold is met and returns applied: true', async () => {
    vi.mocked(db.$transaction).mockImplementationOnce(async (fn: TxFn<unknown>) => {
      const tx = {
        suggestion: {
          findUnique: vi.fn().mockResolvedValueOnce(
            makeSuggestionWithChapter({
              userId: 99,
              voteCount: 9,
              chapter: makeChapterRow({ reads: 0 }), // threshold = 10
            })
          ),
          update: vi.fn().mockResolvedValue({ voteCount: 10 }),
        },
        vote: {
          findUnique: vi.fn().mockResolvedValueOnce(null),
          create: vi.fn().mockResolvedValueOnce({ id: 5 }),
        },
        correction: {
          findUnique: vi.fn().mockResolvedValueOnce(null),
          create: vi.fn().mockResolvedValueOnce({ id: 1 }),
        },
      }
      return fn(tx)
    })

    const res = await app.request('/suggestions/10/vote', {
      method: 'POST',
      headers: makeAuthHeader(),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.applied).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integration: AP-023 DELETE /suggestions/:id/vote
// ─────────────────────────────────────────────────────────────────────────────

describe('AP-023 DELETE /suggestions/:id/vote', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    restoreAuthMock()
  })

  it('returns 200 on successful unvote', async () => {
    vi.mocked(db.$transaction).mockImplementationOnce(async (fn: TxFn<unknown>) => {
      const tx = {
        suggestion: {
          findUnique: vi.fn().mockResolvedValueOnce({ id: 10 }),
          update: vi.fn().mockResolvedValueOnce({ voteCount: 4 }),
        },
        vote: {
          findUnique: vi.fn().mockResolvedValueOnce({ id: 7 }),
          delete: vi.fn().mockResolvedValueOnce({}),
        },
      }
      return fn(tx)
    })

    const res = await app.request('/suggestions/10/vote', {
      method: 'DELETE',
      headers: makeAuthHeader(),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.suggestionId).toBe(10)
    expect(body.voteCount).toBe(4)
  })

  it('returns 401 when not authenticated', async () => {
    const res = await app.request('/suggestions/10/vote', { method: 'DELETE' })

    expect(res.status).toBe(401)
  })

  it('returns 404 when vote not found', async () => {
    vi.mocked(db.$transaction).mockImplementationOnce(async (fn: TxFn<unknown>) => {
      const tx = {
        suggestion: {
          findUnique: vi.fn().mockResolvedValueOnce({ id: 10 }),
        },
        vote: {
          findUnique: vi.fn().mockResolvedValueOnce(null),
        },
      }
      return fn(tx)
    })

    const res = await app.request('/suggestions/10/vote', {
      method: 'DELETE',
      headers: makeAuthHeader(),
    })

    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Integration: AP-024 GET /suggestions/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('AP-024 GET /suggestions/:id', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    restoreAuthMock()
  })

  it('returns 200 with suggestion detail', async () => {
    vi.mocked(db.suggestion.findUnique).mockResolvedValueOnce(makeSuggestionRow() as never)

    const res = await app.request('/suggestions/10')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.id).toBe(10)
    expect(body.data.status).toBe('PENDING')
    expect(body.data.user.username).toBe('testuser')
    expect(body.data.proposedText).toBe('Proposed improvement here.')
  })

  it('returns 404 when suggestion not found', async () => {
    vi.mocked(db.suggestion.findUnique).mockResolvedValueOnce(null)

    const res = await app.request('/suggestions/99999')

    expect(res.status).toBe(404)
  })

  it('is public — no auth required', async () => {
    vi.mocked(db.suggestion.findUnique).mockResolvedValueOnce(makeSuggestionRow() as never)

    const res = await app.request('/suggestions/10')

    expect(res.status).toBe(200)
  })

  it('returns suggestion with APPLIED status', async () => {
    vi.mocked(db.suggestion.findUnique).mockResolvedValueOnce(
      makeSuggestionRow({ status: 'APPLIED', voteCount: 15 }) as never,
    )

    const res = await app.request('/suggestions/10')
    const body = await res.json()

    expect(body.data.status).toBe('APPLIED')
    expect(body.data.voteCount).toBe(15)
  })

  it('returns suggestion with all required fields', async () => {
    vi.mocked(db.suggestion.findUnique).mockResolvedValueOnce(makeSuggestionRow() as never)

    const res = await app.request('/suggestions/10')
    const body = await res.json()

    expect(body.data).toHaveProperty('id')
    expect(body.data).toHaveProperty('chapterId')
    expect(body.data).toHaveProperty('novelId')
    expect(body.data).toHaveProperty('userId')
    expect(body.data).toHaveProperty('paragraphIndex')
    expect(body.data).toHaveProperty('originalText')
    expect(body.data).toHaveProperty('proposedText')
    expect(body.data).toHaveProperty('status')
    expect(body.data).toHaveProperty('voteCount')
    expect(body.data).toHaveProperty('user')
    expect(body.data).toHaveProperty('createdAt')
    expect(body.data).toHaveProperty('updatedAt')
  })
})
