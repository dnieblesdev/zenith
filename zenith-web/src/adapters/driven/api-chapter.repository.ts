import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';

import type { Chapter, ChapterDetail } from '../../domain/models/chapter.model';
import { ChapterRepository } from '../../domain/ports/chapter.repository';

@Injectable({ providedIn: 'root' })
export class ApiChapterRepository implements ChapterRepository {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';

  getChapters(novelId: number) {
    return this.http.get<{ data: Chapter[] }>(`${this.base}/novels/${novelId}/chapters`).pipe(
      map(res => res.data)
    );
  }

  getById(chapterId: number) {
    return this.http.get<{ data: ChapterDetail }>(`${this.base}/chapters/${chapterId}`).pipe(
      map(res => res.data)
    );
  }
}
