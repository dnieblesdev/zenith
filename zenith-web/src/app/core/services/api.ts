import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';

import type { Novel, NovelSummary, NovelQueryParams, PaginatedResponse, SingleResponse } from '../models/novel.model';
import type { Chapter, ChapterDetail } from '../models/chapter.model';
import type { Suggestion } from '../models/suggestion.model';

/**
 * Typed HTTP client for all zenith-api endpoints.
 * Uses `/api` prefix — same-origin in production, proxied in dev.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';

  // ---- Novels ----------------------------------------------------------------

  getNovels(params?: NovelQueryParams) {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          httpParams = httpParams.set(k, String(v));
        }
      });
    }
    return this.http.get<PaginatedResponse<NovelSummary>>(`${this.base}/novels`, {
      params: httpParams,
    });
  }

  getNovel(slug: string) {
    return this.http.get<SingleResponse<Novel>>(`${this.base}/novels/${slug}`).pipe(
      map(res => res.data)
    );
  }

  // ---- Chapters --------------------------------------------------------------

  getChapters(novelSlug: string) {
    return this.http.get<SingleResponse<Chapter[]>>(`${this.base}/novels/${novelSlug}/chapters`).pipe(
      map(res => res.data)
    );
  }

  getChapter(chapterId: number) {
    return this.http.get<SingleResponse<ChapterDetail>>(`${this.base}/chapters/${chapterId}`).pipe(
      map(res => res.data)
    );
  }

  // ---- Suggestions & Votes ---------------------------------------------------

  getSuggestions(chapterId: number, paragraphIndex?: number) {
    let httpParams = new HttpParams();
    if (paragraphIndex !== undefined) {
      httpParams = httpParams.set('paragraphIndex', String(paragraphIndex));
    }
    return this.http.get<{ data: Suggestion[]; meta: { total: number; page: number; limit: number } }>(
      `${this.base}/chapters/${chapterId}/suggestions`,
      { params: httpParams }
    );
  }

  createSuggestion(payload: {
    chapterId: number;
    paragraphIndex: number;
    originalText: string;
    proposedText: string;
    note?: string;
  }) {
    const { chapterId, ...body } = payload;
    return this.http.post<{ data: Suggestion }>(
      `${this.base}/chapters/${chapterId}/suggestions`,
      body
    );
  }

  voteSuggestion(suggestionId: number) {
    return this.http.post<{ message: string }>(
      `${this.base}/suggestions/${suggestionId}/vote`,
      {}
    );
  }

  unvoteSuggestion(suggestionId: number) {
    return this.http.delete<{ message: string }>(
      `${this.base}/suggestions/${suggestionId}/vote`
    );
  }
}
