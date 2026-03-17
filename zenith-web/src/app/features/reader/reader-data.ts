import { Injectable, inject, signal, effect, DestroyRef, computed } from '@angular/core';
import { Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

import type { ChapterDetail, Paragraph, Chapter } from '../../../domain/models/chapter.model';
import type { Suggestion } from '../../../domain/models/suggestion.model';
import type { SuggestionFilters, PaginatedSuggestions } from '../../../domain/ports/suggestion.repository';
import { ApiChapterRepository } from '../../../adapters/driven/api-chapter.repository';
import { ApiSuggestionRepository } from '../../../adapters/driven/api-suggestion.repository';

@Injectable({ providedIn: 'root' })
export class ReaderData {
  private readonly chapterRepo = inject(ApiChapterRepository);
  private readonly suggestionRepo = inject(ApiSuggestionRepository);
  private readonly destroyRef = inject(DestroyRef);

  // --- State signals ---
  readonly chapterData = signal<ChapterDetail | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly prevChapterId = signal<number | null>(null);
  readonly nextChapterId = signal<number | null>(null);
  readonly selectedParagraph = signal<Paragraph | null>(null);

  // --- Computed ---
  readonly hasPrev = computed(() => this.prevChapterId() !== null);
  readonly hasNext = computed(() => this.nextChapterId() !== null);

  // --- Actions ---
  loadChapter(chapterId: number): void {
    if (isNaN(chapterId)) {
      this.error.set(true);
      return;
    }
    this.loading.set(true);
    this.error.set(false);
    this.chapterData.set(null);
    this.prevChapterId.set(null);
    this.nextChapterId.set(null);
    this.selectedParagraph.set(null);

    this.chapterRepo
      .getById(chapterId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (chap) => {
          this.chapterData.set(chap);
          this.loading.set(false);
          // Load adjacent chapters after chapter loads
          this.loadAdjacentChapters(chap.novelId, chap.id);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  /**
   * Load adjacent chapters (previous/next) for navigation.
   * Fetches all chapters for the novel, sorts by orderIndex, and determines
   * which chapter comes before and after the current one.
   */
  loadAdjacentChapters(novelId: number, currentChapterId: number): void {
    this.chapterRepo
      .getChapters(novelId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (chapters) => {
          const sorted = [...chapters].sort((a, b) => a.orderIndex - b.orderIndex);
          const idx = sorted.findIndex((c) => c.id === currentChapterId);
          
          this.prevChapterId.set(idx > 0 ? sorted[idx - 1].id : null);
          this.nextChapterId.set(idx < sorted.length - 1 ? sorted[idx + 1].id : null);
        },
        error: () => {
          // Silently fail - navigation just won't be available
          this.prevChapterId.set(null);
          this.nextChapterId.set(null);
        },
      });
  }

  // Suggestions - return Observable for components to subscribe
  getSuggestions(chapterId: number, paragraphIndex?: number): Observable<Suggestion[]> {
    const filters: SuggestionFilters = {};
    if (paragraphIndex !== undefined) {
      filters.paragraphIndex = paragraphIndex;
    }

    return new Observable((observer) => {
      this.suggestionRepo
        .getByChapterId(chapterId, filters)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res: PaginatedSuggestions) => {
            observer.next(res.data);
            observer.complete();
          },
          error: (err) => observer.error(err),
        });
    });
  }

  createSuggestion(payload: {
    chapterId: number;
    paragraphIndex: number;
    originalText: string;
    proposedText: string;
    note?: string;
  }): Observable<{ data: Suggestion }> {
    return new Observable((observer) => {
      this.suggestionRepo
        .create(payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            observer.next(res);
            observer.complete();
          },
          error: (err) => observer.error(err),
        });
    });
  }

  voteSuggestion(suggestionId: number): Observable<{ message: string }> {
    return new Observable((observer) => {
      this.suggestionRepo
        .vote(suggestionId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            observer.next(res);
            observer.complete();
          },
          error: (err) => observer.error(err),
        });
    });
  }

  unvoteSuggestion(suggestionId: number): Observable<{ message: string }> {
    return new Observable((observer) => {
      this.suggestionRepo
        .unvote(suggestionId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            observer.next(res);
            observer.complete();
          },
          error: (err) => observer.error(err),
        });
    });
  }

  // UI state
  selectParagraph(paragraph: Paragraph | null): void {
    this.selectedParagraph.set(paragraph);
  }
}
