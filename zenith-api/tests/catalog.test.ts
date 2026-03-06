import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock DB to avoid PrismaClient initialization
vi.mock('../src/lib/db', () => ({
  db: {
    novel: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    chapter: {
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
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

import { db } from '../src/lib/db'
import { app } from '../src/index'

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeNovelRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: 'The Wandering Sword',
    slug: 'the-wandering-sword',
    coverUrl: 'https://example.com/cover.jpg',
    description: 'A great story',
    status: 'ongoing',
    language: 'en',
    reads: 100,
    authorId: 1,
    author: { id: 1, name: 'Jin Yong', description: null },
    genres: [
      { genre: { id: 1, name: 'Fantasy' } },
      { genre: { id: 2, name: 'Action' } },
    ],
    _count: { chapters: 10 },
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2026-01-01'),
    modifiedBy: null,
    ...overrides,
  }
}

function makeChapterRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: 'Chapter 1: The Beginning',
    url: 'https://example.com/ch1',
    content: 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.',
    orderIndex: 1,
    language: 'en',
    reads: 50,
    novelId: 1,
    corrections: [],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2026-01-01'),
    modifiedBy: null,
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AP-001 — GET /novels
// ─────────────────────────────────────────────────────────────────────────────

describe('AP-001 GET /novels', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns 200 with paginated list', async () => {
    const mockNovel = makeNovelRow()
    vi.mocked(db.$transaction).mockResolvedValueOnce([[mockNovel], 1])

    const res = await app.request('/novels')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toBe('The Wandering Sword')
    expect(body.meta.total).toBe(1)
    expect(body.meta.page).toBe(1)
    expect(body.meta.limit).toBe(20)
  })

  it('returns genres as array of strings', async () => {
    const mockNovel = makeNovelRow()
    vi.mocked(db.$transaction).mockResolvedValueOnce([[mockNovel], 1])

    const res = await app.request('/novels')
    const body = await res.json()

    expect(body.data[0].genres).toEqual(['Fantasy', 'Action'])
  })

  it('returns chapterCount from _count', async () => {
    const mockNovel = makeNovelRow({ _count: { chapters: 42 } })
    vi.mocked(db.$transaction).mockResolvedValueOnce([[mockNovel], 1])

    const res = await app.request('/novels')
    const body = await res.json()

    expect(body.data[0].chapterCount).toBe(42)
  })

  it('filters by lang', async () => {
    vi.mocked(db.$transaction).mockResolvedValueOnce([[], 0])

    const res = await app.request('/novels?lang=es')

    expect(res.status).toBe(200)
    // Verify transaction was called (filters applied by service)
    expect(vi.mocked(db.$transaction)).toHaveBeenCalledOnce()
  })

  it('filters by genre', async () => {
    vi.mocked(db.$transaction).mockResolvedValueOnce([[], 0])

    const res = await app.request('/novels?genre=Fantasy')

    expect(res.status).toBe(200)
    expect(vi.mocked(db.$transaction)).toHaveBeenCalledOnce()
  })

  it('filters by status', async () => {
    vi.mocked(db.$transaction).mockResolvedValueOnce([[], 0])

    const res = await app.request('/novels?status=ongoing')

    expect(res.status).toBe(200)
  })

  it('filters by q (title search)', async () => {
    vi.mocked(db.$transaction).mockResolvedValueOnce([[], 0])

    const res = await app.request('/novels?q=sword')

    expect(res.status).toBe(200)
  })

  it('supports pagination params', async () => {
    vi.mocked(db.$transaction).mockResolvedValueOnce([[], 0])

    const res = await app.request('/novels?page=2&limit=10')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.meta.page).toBe(2)
    expect(body.meta.limit).toBe(10)
  })

  it('returns 400 for invalid lang', async () => {
    const res = await app.request('/novels?lang=fr')
    expect(res.status).toBe(400)
  })

  it('returns 400 for limit > 100', async () => {
    const res = await app.request('/novels?limit=200')
    expect(res.status).toBe(400)
  })

  it('returns 400 for page < 1', async () => {
    const res = await app.request('/novels?page=0')
    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AP-002 — GET /novels/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('AP-002 GET /novels/:id', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns 200 with novel detail', async () => {
    const mockNovel = makeNovelRow()
    vi.mocked(db.novel.findUniqueOrThrow).mockResolvedValueOnce(mockNovel as never)

    const res = await app.request('/novels/1')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.id).toBe(1)
    expect(body.data.title).toBe('The Wandering Sword')
    expect(body.data.author).toEqual({ id: 1, name: 'Jin Yong', description: null })
    expect(body.data.genres).toEqual([
      { id: 1, name: 'Fantasy' },
      { id: 2, name: 'Action' },
    ])
  })

  it('returns 404 when novel not found', async () => {
    vi.mocked(db.novel.findUniqueOrThrow).mockRejectedValueOnce(
      new Error('Record not found'),
    )

    const res = await app.request('/novels/99999')

    expect(res.status).toBe(404)
  })

  it('returns null author when author is null', async () => {
    const mockNovel = makeNovelRow({ author: null, authorId: null })
    vi.mocked(db.novel.findUniqueOrThrow).mockResolvedValueOnce(mockNovel as never)

    const res = await app.request('/novels/1')
    const body = await res.json()

    expect(body.data.author).toBeNull()
  })

  it('includes chapterCount', async () => {
    const mockNovel = makeNovelRow({ _count: { chapters: 7 } })
    vi.mocked(db.novel.findUniqueOrThrow).mockResolvedValueOnce(mockNovel as never)

    const res = await app.request('/novels/1')
    const body = await res.json()

    expect(body.data.chapterCount).toBe(7)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AP-003 — GET /novels/:id/chapters
// ─────────────────────────────────────────────────────────────────────────────

describe('AP-003 GET /novels/:id/chapters', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns 200 with ordered chapter list', async () => {
    vi.mocked(db.novel.findUniqueOrThrow).mockResolvedValueOnce({ id: 1 } as never)
    vi.mocked(db.chapter.findMany).mockResolvedValueOnce([
      {
        id: 1,
        title: 'Chapter 1',
        orderIndex: 1,
        language: 'en',
        reads: 10,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
      {
        id: 2,
        title: 'Chapter 2',
        orderIndex: 2,
        language: 'en',
        reads: 5,
        createdAt: new Date('2025-01-02'),
        updatedAt: new Date('2026-01-02'),
      },
    ] as never)

    const res = await app.request('/novels/1/chapters')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
    expect(body.data[0].orderIndex).toBe(1)
    expect(body.data[1].orderIndex).toBe(2)
  })

  it('does NOT include content field in chapter list', async () => {
    vi.mocked(db.novel.findUniqueOrThrow).mockResolvedValueOnce({ id: 1 } as never)
    vi.mocked(db.chapter.findMany).mockResolvedValueOnce([
      {
        id: 1,
        title: 'Chapter 1',
        orderIndex: 1,
        language: 'en',
        reads: 10,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
    ] as never)

    const res = await app.request('/novels/1/chapters')
    const body = await res.json()

    expect(body.data[0]).not.toHaveProperty('content')
  })

  it('returns 404 when novel not found', async () => {
    vi.mocked(db.novel.findUniqueOrThrow).mockRejectedValueOnce(
      new Error('Record not found'),
    )

    const res = await app.request('/novels/99999/chapters')

    expect(res.status).toBe(404)
  })

  it('returns meta with total count', async () => {
    vi.mocked(db.novel.findUniqueOrThrow).mockResolvedValueOnce({ id: 1 } as never)
    vi.mocked(db.chapter.findMany).mockResolvedValueOnce([
      {
        id: 1,
        title: 'Ch 1',
        orderIndex: 1,
        language: 'en',
        reads: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as never)

    const res = await app.request('/novels/1/chapters')
    const body = await res.json()

    expect(body.meta.total).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AP-004 — GET /chapters/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('AP-004 GET /chapters/:id', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(db.chapter.update).mockResolvedValue(undefined as never)
  })

  it('returns 200 with chapter detail and paragraphs', async () => {
    const mockChapter = makeChapterRow()
    vi.mocked(db.chapter.findUniqueOrThrow).mockResolvedValueOnce(mockChapter as never)

    const res = await app.request('/chapters/1')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.id).toBe(1)
    expect(body.data.contentAvailable).toBe(true)
    expect(body.data.paragraphs).toHaveLength(3)
    expect(body.data.paragraphs[0].text).toBe('First paragraph.')
    expect(body.data.paragraphs[1].text).toBe('Second paragraph.')
    expect(body.data.paragraphs[2].text).toBe('Third paragraph.')
  })

  it('applies corrections overlay — uses proposedText from suggestion', async () => {
    const mockChapter = makeChapterRow({
      corrections: [
        {
          id: 10,
          chapterId: 1,
          paragraphIndex: 1,
          suggestionId: 5,
          appliedAt: new Date(),
          suggestion: { proposedText: 'CORRECTED second paragraph.' },
        },
      ],
    })
    vi.mocked(db.chapter.findUniqueOrThrow).mockResolvedValueOnce(mockChapter as never)

    const res = await app.request('/chapters/1')
    const body = await res.json()

    expect(body.data.paragraphs[0].text).toBe('First paragraph.')
    expect(body.data.paragraphs[0].isCorrected).toBe(false)
    expect(body.data.paragraphs[1].text).toBe('CORRECTED second paragraph.')
    expect(body.data.paragraphs[1].isCorrected).toBe(true)
    expect(body.data.paragraphs[2].text).toBe('Third paragraph.')
    expect(body.data.paragraphs[2].isCorrected).toBe(false)
  })

  it('INVARIANT: chapter.content is never modified — overlay is pure', async () => {
    const originalContent = 'Paragraph one.\n\nParagraph two.'
    const mockChapter = makeChapterRow({
      content: originalContent,
      corrections: [
        {
          id: 10,
          chapterId: 1,
          paragraphIndex: 0,
          suggestionId: 5,
          appliedAt: new Date(),
          suggestion: { proposedText: 'REPLACED paragraph one.' },
        },
      ],
    })
    vi.mocked(db.chapter.findUniqueOrThrow).mockResolvedValueOnce(mockChapter as never)

    await app.request('/chapters/1')

    // Verify chapter.content was never changed
    expect(mockChapter.content).toBe(originalContent)
  })

  it('returns contentAvailable: false when content is null', async () => {
    const mockChapter = makeChapterRow({ content: null, corrections: [] })
    vi.mocked(db.chapter.findUniqueOrThrow).mockResolvedValueOnce(mockChapter as never)

    const res = await app.request('/chapters/1')
    const body = await res.json()

    expect(body.data.contentAvailable).toBe(false)
    expect(body.data.paragraphs).toEqual([])
  })

  it('returns 404 when chapter not found', async () => {
    vi.mocked(db.chapter.findUniqueOrThrow).mockRejectedValueOnce(
      new Error('Record not found'),
    )

    const res = await app.request('/chapters/99999')

    expect(res.status).toBe(404)
  })

  it('fires reads increment as fire-and-forget (no await)', async () => {
    const mockChapter = makeChapterRow()
    vi.mocked(db.chapter.findUniqueOrThrow).mockResolvedValueOnce(mockChapter as never)

    const res = await app.request('/chapters/1')

    // Response returns successfully regardless of reads update
    expect(res.status).toBe(200)
    // The update was called (fire-and-forget)
    expect(vi.mocked(db.chapter.update)).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { reads: { increment: 1 } },
    })
  })

  it('all paragraphs have index, text, and isCorrected fields', async () => {
    const mockChapter = makeChapterRow()
    vi.mocked(db.chapter.findUniqueOrThrow).mockResolvedValueOnce(mockChapter as never)

    const res = await app.request('/chapters/1')
    const body = await res.json()

    for (const para of body.data.paragraphs) {
      expect(para).toHaveProperty('index')
      expect(para).toHaveProperty('text')
      expect(para).toHaveProperty('isCorrected')
    }
  })
})
