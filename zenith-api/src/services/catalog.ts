import { db } from '../lib/db'
import { notFound } from '../lib/errors'
import type {
  ListNovelsParams,
  NovelListItem,
  NovelDetail,
  ChapterListItem,
  ChapterDetail,
  ListResponse,
  SingleResponse,
  PaginationMeta,
} from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// Typed intermediates — avoid implicit `any` in map/filter callbacks
// ─────────────────────────────────────────────────────────────────────────────

type GenreRelation = { genre: { id: number; name: string } }
type GenreDetailRelation = { genre: { id: number; name: string } }

type NovelRow = {
  id: number
  title: string
  slug: string
  coverUrl: string | null
  status: string | null
  language: string
  reads: number
  author: { id: number; name: string } | null
  genres: GenreRelation[]
  _count: { chapters: number }
  createdAt: Date
  updatedAt: Date
}

type NovelDetailRow = {
  id: number
  title: string
  slug: string
  description: string | null
  coverUrl: string | null
  status: string | null
  language: string
  reads: number
  author: { id: number; name: string; description: string | null } | null
  genres: GenreDetailRelation[]
  _count: { chapters: number }
  createdAt: Date
  updatedAt: Date
}

type ChapterSelectRow = {
  id: number
  title: string
  orderIndex: number
  language: string
  reads: number
  createdAt: Date
  updatedAt: Date
}

type CorrectionWithProposed = {
  id: number
  chapterId: number
  paragraphIndex: number
  suggestionId: number
  appliedAt: Date
  suggestion: { proposedText: string }
}

type ChapterWithCorrectionsRow = {
  id: number
  title: string
  url: string
  content: string | null
  orderIndex: number
  language: string
  reads: number
  novelId: number
  createdAt: Date
  updatedAt: Date
  corrections: CorrectionWithProposed[]
}

// ─────────────────────────────────────────────────────────────────────────────
// AP-001 — listNovels
// ─────────────────────────────────────────────────────────────────────────────

export async function listNovels(
  params: ListNovelsParams,
): Promise<ListResponse<NovelListItem>> {
  const { page = 1, limit = 20, lang, genre, status, q } = params

  const where = {
    ...(lang !== undefined && { language: lang }),
    ...(status !== undefined && { status }),
    ...(q !== undefined && { title: { contains: q } }),
    ...(genre !== undefined && {
      genres: {
        some: {
          genre: { name: genre },
        },
      },
    }),
  }

  const [novelsRaw, total] = (await db.$transaction([
    db.novel.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        author: { select: { id: true, name: true } },
        genres: { include: { genre: { select: { id: true, name: true } } } },
        _count: { select: { chapters: true } },
      },
    }),
    db.novel.count({ where }),
  ])) as [NovelRow[], number]

  const data: NovelListItem[] = novelsRaw.map((novel: NovelRow) => ({
    id: novel.id,
    title: novel.title,
    slug: novel.slug,
    coverUrl: novel.coverUrl,
    status: novel.status,
    language: novel.language,
    reads: novel.reads,
    author: novel.author
      ? { id: novel.author.id, name: novel.author.name }
      : null,
    genres: novel.genres.map((ng: GenreRelation) => ({ id: ng.genre.id, name: ng.genre.name })),
    chapterCount: novel._count.chapters,
    createdAt: novel.createdAt,
    updatedAt: novel.updatedAt,
  }))

  const meta: PaginationMeta = { total, page, limit }

  return { data, meta }
}

// ─────────────────────────────────────────────────────────────────────────────
// AP-002 — getNovel
// ─────────────────────────────────────────────────────────────────────────────

export async function getNovel(slug: string): Promise<SingleResponse<NovelDetail>> {
  let novel: NovelDetailRow
  try {
    novel = (await db.novel.findUniqueOrThrow({
      where: { slug },
      include: {
        author: { select: { id: true, name: true, description: true } },
        genres: { include: { genre: { select: { id: true, name: true } } } },
        _count: { select: { chapters: true } },
      },
    })) as NovelDetailRow
  } catch {
    throw notFound('Novel not found')
  }

  const data: NovelDetail = {
    id: novel.id,
    title: novel.title,
    slug: novel.slug,
    description: novel.description,
    coverUrl: novel.coverUrl,
    status: novel.status,
    language: novel.language,
    reads: novel.reads,
    author: novel.author
      ? {
          id: novel.author.id,
          name: novel.author.name,
          description: novel.author.description,
        }
      : null,
    genres: novel.genres.map((ng: GenreDetailRelation) => ({
      id: ng.genre.id,
      name: ng.genre.name,
    })),
    chapterCount: novel._count.chapters,
    createdAt: novel.createdAt,
    updatedAt: novel.updatedAt,
  }

  return { data }
}

// ─────────────────────────────────────────────────────────────────────────────
// AP-003 — listChapters
// ─────────────────────────────────────────────────────────────────────────────

export async function listChapters(
  novelSlug: string,
): Promise<ListResponse<ChapterListItem>> {
  // Verify novel exists first
  let novelId: number
  try {
    const novel = await db.novel.findUniqueOrThrow({
      where: { slug: novelSlug },
      select: { id: true },
    })
    novelId = novel.id
  } catch {
    throw notFound('Novel not found')
  }

  const chapters: ChapterSelectRow[] = (await db.chapter.findMany({
    where: { novelId },
    orderBy: { orderIndex: 'asc' },
    select: {
      id: true,
      title: true,
      orderIndex: true,
      language: true,
      reads: true,
      createdAt: true,
      updatedAt: true,
    },
  })) as ChapterSelectRow[]

  const data: ChapterListItem[] = chapters.map((ch: ChapterSelectRow) => ({
    id: ch.id,
    title: ch.title,
    orderIndex: ch.orderIndex,
    language: ch.language,
    reads: ch.reads,
    createdAt: ch.createdAt,
    updatedAt: ch.updatedAt,
  }))

  const meta: PaginationMeta = {
    total: data.length,
    page: 1,
    limit: data.length,
  }

  return { data, meta }
}

// ─────────────────────────────────────────────────────────────────────────────
// AP-004 — getChapter
// Applies community corrections as an in-memory overlay.
// INVARIANT: chapter.content is NEVER modified.
// ─────────────────────────────────────────────────────────────────────────────

export async function getChapter(id: number): Promise<SingleResponse<ChapterDetail>> {
  let chapter: ChapterWithCorrectionsRow
  try {
    chapter = (await db.chapter.findUniqueOrThrow({
      where: { id },
      include: {
        corrections: {
          include: {
            suggestion: {
              select: { proposedText: true },
            },
          },
        },
      },
    })) as ChapterWithCorrectionsRow
  } catch {
    throw notFound('Chapter not found')
  }

  // Build correction map: paragraphIndex → corrected text (from suggestion.proposedText)
  // chapter.content is NEVER written — overlay is purely read-only
  const correctionMap = new Map<number, string>()
  for (const correction of chapter.corrections) {
    correctionMap.set(correction.paragraphIndex, correction.suggestion.proposedText)
  }

  // Split raw content into paragraphs (double newlines or single newlines)
  const rawParagraphs: string[] =
    chapter.content !== null
      ? chapter.content
          .split(/\n\n|\n/)
          .map((p: string) => p.trim())
          .filter((p: string) => p.length > 0)
      : []

  const paragraphs = rawParagraphs.map((rawText: string, index: number) => {
    const corrected = correctionMap.get(index)
    return {
      index,
      text: corrected ?? rawText,
      isCorrected: corrected !== undefined,
    }
  })

  const data: ChapterDetail = {
    id: chapter.id,
    title: chapter.title,
    orderIndex: chapter.orderIndex,
    language: chapter.language,
    reads: chapter.reads,
    novelId: chapter.novelId,
    contentAvailable: chapter.content !== null,
    paragraphs,
    createdAt: chapter.createdAt,
    updatedAt: chapter.updatedAt,
  }

  return { data }
}
