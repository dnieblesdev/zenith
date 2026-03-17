import { InjectionToken } from '@angular/core';
import { Observable } from "rxjs";
import type { Suggestion } from "../models/suggestion.model";

export interface CreateSuggestionPayload {
  chapterId: number;
  paragraphIndex: number;
  originalText: string;
  proposedText: string;
  note?: string;
}

export interface SuggestionFilters {
  paragraphIndex?: number;
  page?: number;
  limit?: number;
}

export interface PaginatedSuggestions {
  data: Suggestion[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface SuggestionRepository {
  getByChapterId(chapterId: number, filters?: SuggestionFilters): Observable<PaginatedSuggestions>;
  create(payload: CreateSuggestionPayload): Observable<{ data: Suggestion }>;
  vote(suggestionId: number): Observable<{ message: string }>;
  unvote(suggestionId: number): Observable<{ message: string }>;
}

export const SUGGESTION_REPOSITORY = new InjectionToken<SuggestionRepository>('SuggestionRepository');
