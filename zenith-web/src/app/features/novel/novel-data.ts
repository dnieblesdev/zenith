import { Injectable, inject, signal, effect, DestroyRef, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import type { Novel } from '../../../domain/models/novel.model';
import type { Chapter } from '../../../domain/models/chapter.model';
import { ApiNovelRepository } from '../../../adapters/driven/api-novel.repository';
import { ApiChapterRepository } from '../../../adapters/driven/api-chapter.repository';

@Injectable({ providedIn: 'root' })
export class NovelData {
  private readonly novelRepo = inject(ApiNovelRepository);
  private readonly chapterRepo = inject(ApiChapterRepository);
  private readonly destroyRef = inject(DestroyRef);

  // --- State signals ---
  readonly novel = signal<Novel | null>(null);
  readonly chapters = signal<Chapter[]>([]);
  readonly loading = signal(false);
  readonly chaptersLoading = signal(false);
  readonly error = signal(false);

  // --- Computed ---
  readonly hasChapters = computed(() => this.chapters().length > 0);

  // --- Actions ---
  load(id: number): void {
    this.loading.set(true);
    this.error.set(false);
    this.novel.set(null);
    this.chapters.set([]);

    this.novelRepo
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (novel) => {
          this.novel.set(novel);
          this.loading.set(false);
          this.loadChapters(id);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  private loadChapters(novelId: number): void {
    this.chaptersLoading.set(true);

    this.chapterRepo
      .getChapters(novelId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (chapters) => {
          this.chapters.set(chapters);
          this.chaptersLoading.set(false);
        },
        error: () => {
          this.chaptersLoading.set(false);
        },
      });
  }
}
