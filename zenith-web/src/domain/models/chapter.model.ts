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
 * A single paragraph from a chapter, potentially with an applied correction.
 * `isCorrected` is true when the text reflects a community-applied Correction
 * rather than the raw content from chapter.content.
 */
export interface Paragraph {
  index: number;
  text: string;
  isCorrected: boolean;
}

/**
 * Full chapter including parsed paragraphs (server-side split of content).
 * `paragraphs` is an ordered array of Paragraph objects.
 * Each paragraph's text may reflect a community correction if one has been applied.
 * `contentAvailable` is false when the chapter has no parseable content yet.
 */
export interface ChapterDetail extends Chapter {
  paragraphs: Paragraph[];
  contentAvailable: boolean;
}
