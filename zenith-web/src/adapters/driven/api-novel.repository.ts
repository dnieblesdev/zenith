import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';

import type { Novel, NovelSummary, NovelQueryParams, PaginatedResponse } from '../../domain/models/novel.model';
import { NovelRepository } from '../../domain/ports/novel.repository';

@Injectable({ providedIn: 'root' })
export class ApiNovelRepository implements NovelRepository {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';

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

  getById(id: number) {
    return this.http.get<{ data: Novel }>(`${this.base}/novels/${id}`).pipe(
      map(res => res.data)
    );
  }
}
