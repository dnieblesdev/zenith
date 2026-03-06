// ---------------------------------------------------------------------------
// Chapter domain models — mirrors the Prisma schema (zenith-scrapper/prisma/schema.prisma)
// chapter.content is IMMUTABLE — owned exclusively by zenith-scrapper.
// zenith-api and zenith-web NEVER write to chapter.content.
// ---------------------------------------------------------------------------

/**
 * Lightweight chapter entry for chapter lists (table of contents).
 */
export interface Chapter {
  id: number;
  novelId: number;
  title: string;
  url: string;
  orderIndex: number;
  language: 'en' | 'es';
  reads: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Full chapter including parsed paragraphs (server-side split of content).
 * `paragraphs` is an ordered array of raw paragraph strings from chapter.content.
 * The reader renders these alongside any active Corrections.
 */
export interface ChapterDetail extends Chapter {
  paragraphs: string[];
}
