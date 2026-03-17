// ---------------------------------------------------------------------------
// Novel domain models — mirrors the Prisma schema (zenith-scrapper/prisma/schema.prisma)
// These are read-only API response shapes; all writes go through zenith-api.
// ---------------------------------------------------------------------------

export interface Author {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Genre {
  id: number;
  name: string;
  description: string | null;
}

/**
 * Full novel as returned by GET /api/novels/:slug
 */
export interface Novel {
  id: number;
  title: string;
  slug: string;
  url: string;
  coverUrl: string | null;
  description: string | null;
  status: string | null;
  language: 'en' | 'es';
  reads: number;
  authorId: number | null;
  author: Author | null;
  genres: Genre[];
  chapterCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Lightweight novel summary for list responses (catalog pagination).
 */
export interface NovelSummary
  extends Pick<
    Novel,
    | 'id'
    | 'title'
    | 'slug'
    | 'coverUrl'
    | 'description'
    | 'language'
    | 'reads'
    | 'status'
    | 'createdAt'
  > {
  author: Pick<Author, 'id' | 'name'> | null;
  genres: Pick<Genre, 'id' | 'name'>[];
  chapterCount: number;
}

export interface NovelQueryParams {
  lang?: 'en' | 'es';
  genre?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface SingleResponse<T> {
  data: T;
}
