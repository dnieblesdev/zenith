import { HTTPException } from 'hono/http-exception'
import { db } from '../lib/db'
import { notFound } from '../lib/errors'
import type {
  SuggestionDetail,
  SuggestionListItem,
  SuggestionUserSummary,
  VoteResult,
  UnvoteResult,
  CreateSuggestionParams,
  ListSuggestionsParams,
  ListResponse,
  SingleResponse,
  PaginationMeta,
} from '../types'
import type { Prisma } from '@prisma/client'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const MIN_VOTES = 10
export const VOTE_RATIO = 0.02

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

export function calculateThreshold(chapterReads: number): number {
  return Math.max(MIN_VOTES, Math.floor(chapterReads * VOTE_RATIO))
}

// ─────────────────────────────────────────────────────────────────────────────
// Typed intermediates — avoid implicit `any`
// ─────────────────────────────────────────────────────────────────────────────

type SuggestionRow = {
  id: number
  chapterId: number
  novelId: number
  userId: number
  paragraphIndex: number
  originalText: string
  proposedText: string
  status: string
  voteCount: number
  user: { id: number; username: string }
  createdAt: Date
  updatedAt: Date
}

type SuggestionWithChapter = SuggestionRow & {
  chapter: { id: number; reads: number; novelId: number; language: string }
}

// ─────────────────────────────────────────────────────────────────────────────
// Private: apply suggestion if threshold is met (must run inside transaction)
// ─────────────────────────────────────────────────────────────────────────────

async function applySuggestionIfThreshold(
  tx: Prisma.TransactionClient,
  suggestion: SuggestionWithChapter,
): Promise<boolean> {
  const threshold = calculateThreshold(suggestion.chapter.reads)

  if (suggestion.voteCount < threshold) {
    return false
  }

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
      // Same suggestion already applied — no-op
      return false
    }

    // Different suggestion — mark old suggestion as SUPERSEDED
    await tx.suggestion.update({
      where: { id: existingCorrection.suggestionId },
      data: { status: 'SUPERSEDED' },
    })

    // Delete old correction to allow new unique creation
    await tx.correction.delete({
      where: { id: existingCorrection.id },
    })
  }

  // Create new Correction
  await tx.correction.create({
    data: {
      chapterId: suggestion.chapterId,
      paragraphIndex: suggestion.paragraphIndex,
      suggestionId: suggestion.id,
    },
  })

  // Mark suggestion as APPLIED
  await tx.suggestion.update({
    where: { id: suggestion.id },
    data: { status: 'APPLIED' },
  })

  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// AP-020 — createSuggestion
// ─────────────────────────────────────────────────────────────────────────────

export async function createSuggestion(
  params: CreateSuggestionParams,
  userId: number,
): Promise<SingleResponse<SuggestionDetail>> {
  const chapter = await db.chapter.findUnique({
    where: { id: params.chapterId },
    select: { id: true, novelId: true, language: true },
  })

  if (!chapter) {
    throw notFound('Chapter not found')
  }

  // Optional language validation
  if (params.language !== undefined && params.language !== chapter.language) {
    throw new HTTPException(422, { message: 'Language mismatch with chapter' })
  }

  const row = (await db.suggestion.create({
    data: {
      chapterId: chapter.id,
      novelId: chapter.novelId,
      userId,
      paragraphIndex: params.paragraphIndex,
      originalText: params.originalText,
      proposedText: params.proposedText,
      status: 'PENDING',
      voteCount: 0,
    },
    select: {
      id: true,
      chapterId: true,
      novelId: true,
      userId: true,
      paragraphIndex: true,
      originalText: true,
      proposedText: true,
      status: true,
      voteCount: true,
      user: { select: { id: true, username: true } },
      createdAt: true,
      updatedAt: true,
    },
  })) as SuggestionRow

  const data: SuggestionDetail = {
    id: row.id,
    chapterId: row.chapterId,
    novelId: row.novelId,
    userId: row.userId,
    paragraphIndex: row.paragraphIndex,
    originalText: row.originalText,
    proposedText: row.proposedText,
    status: row.status as SuggestionDetail['status'],
    voteCount: row.voteCount,
    user: { id: row.user.id, username: row.user.username },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }

  return { data }
}

// ─────────────────────────────────────────────────────────────────────────────
// AP-021 — listSuggestions
// ─────────────────────────────────────────────────────────────────────────────

export async function listSuggestions(
  chapterId: number,
  params: ListSuggestionsParams = {},
): Promise<ListResponse<SuggestionListItem>> {
  const { paragraphIndex, status, page = 1, limit = 20 } = params

  // Verify chapter exists
  const chapter = await db.chapter.findUnique({
    where: { id: chapterId },
    select: { id: true },
  })

  if (!chapter) {
    throw notFound('Chapter not found')
  }

  const where = {
    chapterId,
    ...(paragraphIndex !== undefined && { paragraphIndex }),
    ...(status !== undefined && { status }),
  }

  const [rows, total] = (await db.$transaction([
    db.suggestion.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ voteCount: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        chapterId: true,
        novelId: true,
        userId: true,
        paragraphIndex: true,
        originalText: true,
        proposedText: true,
        status: true,
        voteCount: true,
        user: { select: { id: true, username: true } },
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.suggestion.count({ where }),
  ])) as [SuggestionRow[], number]

  const data: SuggestionListItem[] = rows.map((row: SuggestionRow) => ({
    id: row.id,
    chapterId: row.chapterId,
    novelId: row.novelId,
    userId: row.userId,
    paragraphIndex: row.paragraphIndex,
    originalText: row.originalText,
    proposedText: row.proposedText,
    status: row.status as SuggestionListItem['status'],
    voteCount: row.voteCount,
    user: { id: row.user.id, username: row.user.username } as SuggestionUserSummary,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }))

  const meta: PaginationMeta = { total, page, limit }

  return { data, meta }
}

// ─────────────────────────────────────────────────────────────────────────────
// AP-022 — voteSuggestion
// ─────────────────────────────────────────────────────────────────────────────

export async function voteSuggestion(
  suggestionId: number,
  userId: number,
): Promise<VoteResult> {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    // Fetch suggestion with chapter reads for threshold
    const suggestion = (await tx.suggestion.findUnique({
      where: { id: suggestionId },
      select: {
        id: true,
        chapterId: true,
        novelId: true,
        userId: true,
        paragraphIndex: true,
        originalText: true,
        proposedText: true,
        status: true,
        voteCount: true,
        user: { select: { id: true, username: true } },
        chapter: { select: { id: true, reads: true, novelId: true, language: true } },
        createdAt: true,
        updatedAt: true,
      },
    })) as SuggestionWithChapter | null

    if (!suggestion) {
      throw notFound('Suggestion not found')
    }

    // Self-vote guard
    if (suggestion.userId === userId) {
      throw new HTTPException(403, { message: 'Cannot vote on your own suggestion' })
    }

    // Duplicate vote guard
    const existingVote = await tx.vote.findUnique({
      where: {
        suggestionId_userId: { suggestionId, userId },
      },
    })

    if (existingVote !== null) {
      throw new HTTPException(409, { message: 'Already voted on this suggestion' })
    }

    // Create vote
    await tx.vote.create({
      data: { suggestionId, userId },
    })

    // Increment voteCount
    const updated = await tx.suggestion.update({
      where: { id: suggestionId },
      data: { voteCount: { increment: 1 } },
      select: { voteCount: true },
    })

    // Re-hydrate suggestion with new voteCount for threshold check
    const suggestionForThreshold: SuggestionWithChapter = {
      ...suggestion,
      voteCount: updated.voteCount,
    }

    const applied = await applySuggestionIfThreshold(tx, suggestionForThreshold)

    return {
      suggestionId,
      voteCount: updated.voteCount,
      applied,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// AP-023 — unvoteSuggestion
// ─────────────────────────────────────────────────────────────────────────────

export async function unvoteSuggestion(
  suggestionId: number,
  userId: number,
): Promise<UnvoteResult> {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    // Verify suggestion exists
    const suggestion = await tx.suggestion.findUnique({
      where: { id: suggestionId },
      select: { id: true },
    })

    if (!suggestion) {
      throw notFound('Suggestion not found')
    }

    // Verify vote exists
    const existingVote = await tx.vote.findUnique({
      where: {
        suggestionId_userId: { suggestionId, userId },
      },
    })

    if (!existingVote) {
      throw notFound('Vote not found')
    }

    // Delete vote
    await tx.vote.delete({
      where: { id: existingVote.id },
    })

    // Decrement voteCount (floor at 0)
    const updated = await tx.suggestion.update({
      where: { id: suggestionId },
      data: { voteCount: { decrement: 1 } },
      select: { voteCount: true },
    })

    return {
      suggestionId,
      voteCount: Math.max(0, updated.voteCount),
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// AP-024 — getSuggestion
// ─────────────────────────────────────────────────────────────────────────────

export async function getSuggestion(id: number): Promise<SingleResponse<SuggestionDetail>> {
  const row = (await db.suggestion.findUnique({
    where: { id },
    select: {
      id: true,
      chapterId: true,
      novelId: true,
      userId: true,
      paragraphIndex: true,
      originalText: true,
      proposedText: true,
      status: true,
      voteCount: true,
      user: { select: { id: true, username: true } },
      createdAt: true,
      updatedAt: true,
    },
  })) as SuggestionRow | null

  if (!row) {
    throw notFound('Suggestion not found')
  }

  const data: SuggestionDetail = {
    id: row.id,
    chapterId: row.chapterId,
    novelId: row.novelId,
    userId: row.userId,
    paragraphIndex: row.paragraphIndex,
    originalText: row.originalText,
    proposedText: row.proposedText,
    status: row.status as SuggestionDetail['status'],
    voteCount: row.voteCount,
    user: { id: row.user.id, username: row.user.username },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }

  return { data }
}
