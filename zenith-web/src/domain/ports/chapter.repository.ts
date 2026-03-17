import { InjectionToken } from '@angular/core';
import { Observable } from "rxjs";
import { Chapter, ChapterDetail } from "../models/chapter.model";

export interface ChapterRepository {
  getById(id: number): Observable<ChapterDetail>;
  getChapters(novelId: number): Observable<Chapter[]>;
}

export const CHAPTER_REPOSITORY = new InjectionToken<ChapterRepository>('ChapterRepository');
