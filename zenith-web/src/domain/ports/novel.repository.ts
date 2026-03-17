import { InjectionToken } from '@angular/core';
import { Observable } from "rxjs";
import { Novel, NovelSummary, NovelQueryParams, PaginatedResponse } from "../models/novel.model";

export interface NovelRepository {
  getNovels(params?: NovelQueryParams): Observable<PaginatedResponse<NovelSummary>>;
  getById(id: number): Observable<Novel>;
}

export const NOVEL_REPOSITORY = new InjectionToken<NovelRepository>('NovelRepository');
