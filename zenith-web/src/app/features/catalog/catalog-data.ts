import { Injectable, inject, signal, effect, DestroyRef, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import type { NovelSummary, NovelQueryParams } from '../../../domain/models/novel.model';
import { ApiNovelRepository } from '../../../adapters/driven/api-novel.repository';

type LangFilter = 'all' | 'en' | 'es';

@Injectable({ providedIn: 'root' })
export class CatalogData {
  private readonly novelRepo = inject(ApiNovelRepository);
  private readonly destroyRef = inject(DestroyRef);

  // --- State signals ---
  readonly novels = signal<NovelSummary[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = 20;

  // --- Filter signals ---
  readonly langFilter = signal<LangFilter>('all');
  readonly searchQuery = signal('');
  readonly genreFilter = signal<string | null>(null);

  // --- Computed ---
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit)));
  readonly hasNovels = computed(() => this.novels().length > 0);

  // Derives unique genre names from currently loaded novels
  readonly availableGenres = computed(() => {
    const seen = new Set<string>();
    for (const novel of this.novels()) {
      for (const g of novel.genres) seen.add(g.name);
    }
    return Array.from(seen).sort();
  });

  readonly langOptions: { value: LangFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'en', label: 'EN' },
    { value: 'es', label: 'ES' },
  ];

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      // Re-fetch whenever filter/page/search changes
      const lang = this.langFilter();
      const q = this.searchQuery();
      const currentPage = this.page();
      const genre = this.genreFilter();
      this.fetchNovels({
        lang: lang === 'all' ? undefined : lang,
        q: q || undefined,
        genre: genre ?? undefined,
        page: currentPage,
      });
    });
  }

  private fetchNovels(params: NovelQueryParams) {
    this.loading.set(true);
    this.error.set(false);

    this.novelRepo
      .getNovels({ ...params, limit: this.limit })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.novels.set(res.data);
          this.total.set(res.meta.total);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  // --- Actions ---
  setLangFilter(lang: LangFilter): void {
    this.langFilter.set(lang);
    this.page.set(1);
  }

  setGenreFilter(genre: string | null): void {
    this.genreFilter.set(genre);
    this.page.set(1);
  }

  setPage(p: number): void {
    this.page.set(p);
  }

  onSearchInput(value: string): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchQuery.set(value);
      this.page.set(1);
    }, 300);
  }

  reload(): void {
    const lang = this.langFilter();
    this.fetchNovels({
      lang: lang === 'all' ? undefined : lang,
      q: this.searchQuery() || undefined,
      genre: this.genreFilter() ?? undefined,
      page: this.page(),
      limit: this.limit,
    });
  }
}
