import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import type { Suggestion } from '../../domain/models/suggestion.model';
import type {
  SuggestionRepository,
  CreateSuggestionPayload,
  SuggestionFilters,
  PaginatedSuggestions,
} from '../../domain/ports/suggestion.repository';

@Injectable({ providedIn: 'root' })
export class ApiSuggestionRepository implements SuggestionRepository {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';

  getByChapterId(chapterId: number, filters?: SuggestionFilters): Observable<PaginatedSuggestions> {
    let httpParams = new HttpParams();
    
    if (filters?.paragraphIndex !== undefined) {
      httpParams = httpParams.set('paragraphIndex', String(filters.paragraphIndex));
    }
    if (filters?.page !== undefined) {
      httpParams = httpParams.set('page', String(filters.page));
    }
    if (filters?.limit !== undefined) {
      httpParams = httpParams.set('limit', String(filters.limit));
    }

    return this.http.get<PaginatedSuggestions>(
      `${this.base}/chapters/${chapterId}/suggestions`,
      { params: httpParams }
    );
  }

  create(payload: CreateSuggestionPayload): Observable<{ data: Suggestion }> {
    const { chapterId, ...body } = payload;
    return this.http.post<{ data: Suggestion }>(
      `${this.base}/chapters/${chapterId}/suggestions`,
      body
    );
  }

  vote(suggestionId: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.base}/suggestions/${suggestionId}/vote`,
      {}
    );
  }

  unvote(suggestionId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.base}/suggestions/${suggestionId}/vote`
    );
  }
}
