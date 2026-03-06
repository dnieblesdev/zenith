// ---------------------------------------------------------------------------
// Editorial domain models — mirrors the Prisma schema (zenith-scrapper/prisma/schema.prisma)
// Suggestion, Vote, Correction
// ---------------------------------------------------------------------------

import type { UserSummary } from './user.model';

export type SuggestionStatus = 'PENDING' | 'APPLIED' | 'REJECTED' | 'SUPERSEDED';

/**
 * A community suggestion for an alternative paragraph text.
 * Lifecycle: PENDING → APPLIED | REJECTED | SUPERSEDED
 */
export interface Suggestion {
  id: number;
  chapterId: number;
  novelId: number;
  userId: number;
  paragraphIndex: number;
  originalText: string;
  proposedText: string;
  status: SuggestionStatus;
  voteCount: number;
  user: UserSummary;
  createdAt: string;
  updatedAt: string;
}

/**
 * A vote cast on a suggestion. Each user may vote once per suggestion.
 */
export interface Vote {
  id: number;
  suggestionId: number;
  userId: number;
  createdAt: string;
}

/**
 * An applied correction — the winning suggestion that replaced the raw paragraph.
 * `correctedText` is derived from the linked Suggestion.proposedText.
 */
export interface Correction {
  id: number;
  chapterId: number;
  paragraphIndex: number;
  suggestionId: number;
  correctedText: string;
  appliedAt: string;
}
