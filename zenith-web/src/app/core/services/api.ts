import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

import type { Novel, NovelSummary, NovelQueryParams, PaginatedResponse } from '../models/novel.model';
import type { Chapter, ChapterDetail } from '../models/chapter.model';
import type { Correction } from '../models/suggestion.model';

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
    return this.http.get<Novel>(`${this.base}/novels/${slug}`);
  }

  // ---- Chapters --------------------------------------------------------------

  getChapters(novelId: number) {
    return this.http.get<Chapter[]>(`${this.base}/novels/${novelId}/chapters`);
  }

  getChapter(chapterId: number) {
    return this.http.get<ChapterDetail>(`${this.base}/chapters/${chapterId}`);
  }

  // ---- Corrections -----------------------------------------------------------

  getCorrections(chapterId: number) {
    return this.http.get<Correction[]>(
      `${this.base}/chapters/${chapterId}/corrections`
    );
  }
}
