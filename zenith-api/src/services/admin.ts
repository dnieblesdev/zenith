import { HTTPException } from 'hono/http-exception'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { db } from '../lib/db'
import { notFound } from '../lib/errors'
import type { Prisma } from '@prisma/client'
import type {
  AdminNovelInput,
  AdminUpdateNovelInput,
  AdminSyncResult,
  AdminStatusOverrideResult,
  AdminStats,
  NovelDetail,
  SingleResponse,
} from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// Typed intermediates — avoid implicit `any`
// ─────────────────────────────────────────────────────────────────────────────

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
  genres: { genre: { id: number; name: string } }[]
  _count: { chapters: number }
  createdAt: Date
  updatedAt: Date
}

// ─────────────────────────────────────────────────────────────────────────────
// Private: fetch novel as NovelDetail shape (reused by create and update)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchNovelDetail(id: number): Promise<NovelDetail> {
  let novel: NovelDetailRow
  try {
    novel = (await db.novel.findUniqueOrThrow({
      where: { id },
      include: {
        author: { select: { id: true, name: true, description: true } },
        genres: { include: { genre: { select: { id: true, name: true } } } },
        _count: { select: { chapters: true } },
      },
    })) as NovelDetailRow
  } catch {
    throw notFound('Novel not found')
  }

  return {
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
    genres: novel.genres.map((ng) => ({ id: ng.genre.id, name: ng.genre.name })),
    chapterCount: novel._count.chapters,
    createdAt: novel.createdAt,
    updatedAt: novel.updatedAt,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AP-030 — createNovel
// ─────────────────────────────────────────────────────────────────────────────

export async function createNovel(
  input: AdminNovelInput,
): Promise<SingleResponse<NovelDetail>> {
  try {
    const created = await db.novel.create({
      data: {
        title: input.title,
        url: input.url,
        slug: input.slug,
        language: input.language,
        description: input.description ?? null,
        coverUrl: input.coverUrl ?? null,
        status: input.status ?? null,
      },
    })

    const data = await fetchNovelDetail(created.id)
    return { data }
  } catch (err) {
    if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target)
        ? (err.meta.target as string[]).join(', ')
        : String(err.meta?.target ?? 'field')
      throw new HTTPException(409, { message: `Conflict: ${target} already exists` })
    }
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AP-031 — updateNovel
// ─────────────────────────────────────────────────────────────────────────────

export async function updateNovel(
  id: number,
  input: AdminUpdateNovelInput,
): Promise<SingleResponse<NovelDetail>> {
  // Verify novel exists
  const existing = await db.novel.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!existing) {
    throw notFound('Novel not found')
  }

  // Build update data with only provided fields
  const updateData: Record<string, unknown> = {}
  if (input.title !== undefined) updateData.title = input.title
  if (input.description !== undefined) updateData.description = input.description
  if (input.coverUrl !== undefined) updateData.coverUrl = input.coverUrl
  if (input.status !== undefined) updateData.status = input.status
  if (input.language !== undefined) updateData.language = input.language

  await db.novel.update({
    where: { id },
    data: updateData,
  })

  const data = await fetchNovelDetail(id)
  return { data }
}

// ─────────────────────────────────────────────────────────────────────────────
// AP-032 — syncNovel (fire-and-forget signal; actual job queue is future work)
// ─────────────────────────────────────────────────────────────────────────────

export async function syncNovel(id: number): Promise<AdminSyncResult> {
  const novel = await db.novel.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!novel) {
    throw notFound('Novel not found')
  }

  // v1: fire-and-forget acknowledgment; actual scraper invocation is future work
  return {
    novelId: id,
    queued: true,
    message: `Sync signal acknowledged for novel ${id}. Scraper will process shortly.`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AP-033 — overrideSuggestionStatus
// ─────────────────────────────────────────────────────────────────────────────

export async function overrideSuggestionStatus(
  id: number,
  status: 'APPLIED' | 'REJECTED',
): Promise<AdminStatusOverrideResult> {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    // Fetch suggestion
    const suggestion = await tx.suggestion.findUnique({
      where: { id },
      select: {
        id: true,
        chapterId: true,
        paragraphIndex: true,
        voteCount: true,
        status: true,
      },
    })

    if (!suggestion) {
      throw notFound('Suggestion not found')
    }

    let correctionCreated = false
    let correctionSuperseded = false

    if (status === 'APPLIED') {
      // Check if a Correction already exists for (chapterId, paragraphIndex)
      const existingCorrection = await tx.correction.findUnique({
        where: {
          chapterId_paragraphIndex: {
            chapterId: suggestion.chapterId,
            paragraphIndex: suggestion.paragraphIndex,
          },
        },
      })

      if (existingCorrection !== null) {
        if (existingCorrection.suggestionId === suggestion.id) {
          // Already applied to this suggestion — just update status
        } else {
          // Different suggestion — mark old suggestion as SUPERSEDED
          await tx.suggestion.update({
            where: { id: existingCorrection.suggestionId },
            data: { status: 'SUPERSEDED' },
          })

          // Delete old correction
          await tx.correction.delete({
            where: { id: existingCorrection.id },
          })

          correctionSuperseded = true

          // Create new correction
          await tx.correction.create({
            data: {
              chapterId: suggestion.chapterId,
              paragraphIndex: suggestion.paragraphIndex,
              suggestionId: suggestion.id,
            },
          })

          correctionCreated = true
        }
      } else {
        // No existing correction — create one
        await tx.correction.create({
          data: {
            chapterId: suggestion.chapterId,
            paragraphIndex: suggestion.paragraphIndex,
            suggestionId: suggestion.id,
          },
        })

        correctionCreated = true
      }
    }

    // Update suggestion status
    const updated = await tx.suggestion.update({
      where: { id },
      data: { status },
      select: { id: true, status: true, chapterId: true, paragraphIndex: true, voteCount: true },
    })

    return {
      id: updated.id,
      status: updated.status as AdminStatusOverrideResult['status'],
      chapterId: updated.chapterId,
      paragraphIndex: updated.paragraphIndex,
      voteCount: updated.voteCount,
      correctionCreated,
      correctionSuperseded,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// AP-034 — getStats
// ─────────────────────────────────────────────────────────────────────────────

export async function getStats(): Promise<AdminStats> {
  const [novels, chapters, users, suggestions, corrections, votes] = await db.$transaction([
    db.novel.count(),
    db.chapter.count(),
    db.user.count(),
    db.suggestion.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    db.correction.count(),
    db.vote.count(),
  ])

  // Build suggestion counts from groupBy result
  type GroupByRow = { status: string; _count: { _all: number } }
  const statusMap: Record<string, number> = {}
  for (const row of suggestions as GroupByRow[]) {
    statusMap[row.status] = row._count._all
  }

  const total = Object.values(statusMap).reduce((sum, n) => sum + n, 0)

  return {
    novels: novels as number,
    chapters: chapters as number,
    users: users as number,
    suggestions: {
      total,
      pending: statusMap['PENDING'] ?? 0,
      applied: statusMap['APPLIED'] ?? 0,
      rejected: statusMap['REJECTED'] ?? 0,
      superseded: statusMap['SUPERSEDED'] ?? 0,
    },
    corrections: corrections as number,
    votes: votes as number,
  }
}
