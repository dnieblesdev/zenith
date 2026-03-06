// ─────────────────────────────────────────────────────────────────────────────
// Auth types
// ─────────────────────────────────────────────────────────────────────────────

export const USER_ROLE = {
  READER: 'READER',
  EDITOR: 'EDITOR',
  ADMIN: 'ADMIN',
} as const

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE]

export type AuthUser = {
  id: number
  username: string
  email: string
  role: UserRole
}

export type Variables = {
  user: AuthUser
}

export type UserProfile = {
  id: number
  username: string
  role: UserRole
  acceptedCount: number
  suggestionsCount: number
  createdAt: Date
}

// ─────────────────────────────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────────────────────────────

export type PaginationMeta = {
  total: number
  page: number
  limit: number
}

export type ListResponse<T> = {
  data: T[]
  meta: PaginationMeta
}

export type SingleResponse<T> = {
  data: T
}

// Legacy aliases (kept for backward compatibility)
export type ApiResponse<T> = SingleResponse<T>

export type PaginatedResponse<T> = {
  data: T[]
  total: number
  page: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalog types
// ─────────────────────────────────────────────────────────────────────────────

export type AuthorSummary = {
  id: number
  name: string
}

export type AuthorDetail = {
  id: number
  name: string
  description: string | null
}

export type GenreSummary = {
  id: number
  name: string
}

export type Paragraph = {
  index: number
  text: string
  isCorrected: boolean
}

export type NovelListItem = {
  id: number
  title: string
  slug: string
  coverUrl: string | null
  status: string | null
  language: string
  reads: number
  author: AuthorSummary | null
  genres: string[]
  chapterCount: number
  createdAt: Date
  updatedAt: Date
}

export type NovelDetail = {
  id: number
  title: string
  slug: string
  description: string | null
  coverUrl: string | null
  status: string | null
  language: string
  reads: number
  author: AuthorDetail | null
  genres: GenreSummary[]
  chapterCount: number
  createdAt: Date
  updatedAt: Date
}

export type ChapterListItem = {
  id: number
  title: string
  orderIndex: number
  language: string
  reads: number
  createdAt: Date
  updatedAt: Date
}

export type ChapterDetail = {
  id: number
  title: string
  orderIndex: number
  language: string
  reads: number
  novelId: number
  contentAvailable: boolean
  paragraphs: Paragraph[]
  createdAt: Date
  updatedAt: Date
}

// ─────────────────────────────────────────────────────────────────────────────
// Service input params
// ─────────────────────────────────────────────────────────────────────────────

export type ListNovelsParams = {
  page?: number
  limit?: number
  lang?: string
  genre?: string
  status?: string
  q?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Editorial types
// ─────────────────────────────────────────────────────────────────────────────

export const SUGGESTION_STATUS = {
  PENDING: 'PENDING',
  APPLIED: 'APPLIED',
  REJECTED: 'REJECTED',
  SUPERSEDED: 'SUPERSEDED',
} as const

export type SuggestionStatus = (typeof SUGGESTION_STATUS)[keyof typeof SUGGESTION_STATUS]

export type SuggestionUserSummary = {
  id: number
  username: string
}

export type SuggestionListItem = {
  id: number
  chapterId: number
  novelId: number
  userId: number
  paragraphIndex: number
  originalText: string
  proposedText: string
  status: SuggestionStatus
  voteCount: number
  user: SuggestionUserSummary
  createdAt: Date
  updatedAt: Date
}

export type SuggestionDetail = {
  id: number
  chapterId: number
  novelId: number
  userId: number
  paragraphIndex: number
  originalText: string
  proposedText: string
  status: SuggestionStatus
  voteCount: number
  user: SuggestionUserSummary
  createdAt: Date
  updatedAt: Date
}

export type VoteResult = {
  suggestionId: number
  voteCount: number
  applied: boolean
}

export type UnvoteResult = {
  suggestionId: number
  voteCount: number
}

export type CreateSuggestionParams = {
  chapterId: number
  paragraphIndex: number
  originalText: string
  proposedText: string
  language?: string
}

export type ListSuggestionsParams = {
  paragraphIndex?: number
  status?: SuggestionStatus
  page?: number
  limit?: number
}
