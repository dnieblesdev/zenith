import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api';
import type { NovelSummary, NovelQueryParams } from '../../core/models/novel.model';
import { NovelCardComponent } from './components/novel-card';

type LangFilter = 'all' | 'en' | 'es';

@Component({
  selector: 'app-catalog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NovelCardComponent],
  template: `
    <section class="max-w-6xl mx-auto px-4 py-8">
      <h1 class="text-2xl font-bold text-white mb-6">Novel Catalog</h1>

      <!-- Filters -->
      <div class="flex flex-col gap-3 mb-6">
        <div class="flex flex-wrap gap-4">
          <!-- Language filter -->
          <div class="flex gap-2">
            @for (option of langOptions; track option.value) {
              <button
                class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                [class]="langFilter() === option.value
                  ? 'bg-brand-primary text-white'
                  : 'bg-surface-raised text-slate-400 hover:text-white'"
                (click)="setLangFilter(option.value)"
              >
                {{ option.label }}
              </button>
            }
          </div>

          <!-- Search input -->
          <input
            type="text"
            placeholder="Search novels..."
            class="flex-1 min-w-48 px-3 py-1.5 rounded-lg bg-surface-raised border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-slate-500"
            [value]="searchQuery()"
            (input)="onSearchInput($event)"
          />
        </div>

        <!-- Genre filter -->
        @if (availableGenres().length > 0) {
          <div class="flex flex-wrap gap-2">
            <button
              class="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
              [class]="genreFilter() === null
                ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/40'
                : 'bg-surface-raised text-slate-400 border border-slate-700 hover:border-slate-500 hover:text-white'"
              (click)="setGenreFilter(null)"
            >
              All genres
            </button>
            @for (genre of availableGenres(); track genre) {
              <button
                class="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                [class]="genreFilter() === genre
                  ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/40'
                  : 'bg-surface-raised text-slate-400 border border-slate-700 hover:border-slate-500 hover:text-white'"
                (click)="setGenreFilter(genre)"
              >
                {{ genre }}
              </button>
            }
          </div>
        }
      </div>

      <!-- Loading skeleton -->
      @if (loading()) {
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          @for (i of skeletons; track i) {
            <div class="rounded-xl bg-surface-raised animate-pulse">
              <div class="aspect-[2/3] bg-slate-700 rounded-t-xl"></div>
              <div class="p-3 flex flex-col gap-2">
                <div class="h-4 bg-slate-700 rounded w-3/4"></div>
                <div class="h-3 bg-slate-700 rounded w-1/2"></div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Error state -->
      @else if (error()) {
        <div class="flex flex-col items-center gap-4 py-16 text-center">
          <p class="text-slate-400">Failed to load novels.</p>
          <button
            class="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm hover:opacity-90"
            (click)="reload()"
          >
            Retry
          </button>
        </div>
      }

      <!-- Empty state -->
      @else if (!loading() && novels().length === 0) {
        <div class="flex flex-col items-center gap-2 py-16 text-center">
          <p class="text-slate-400">No novels found.</p>
        </div>
      }

      <!-- Novel grid -->
      @else {
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          @for (novel of novels(); track novel.id) {
            <app-novel-card
              [novel]="novel"
              (select)="onNovelSelect($event)"
            />
          }
        </div>

        <!-- Pagination -->
        @if (totalPages() > 1) {
          <div class="flex items-center justify-center gap-2 mt-8">
            <button
              class="px-3 py-1.5 rounded-lg bg-surface-raised text-slate-400 text-sm disabled:opacity-40"
              [disabled]="page() === 1"
              (click)="setPage(page() - 1)"
            >
              Previous
            </button>
            <span class="text-slate-400 text-sm">
              {{ page() }} / {{ totalPages() }}
            </span>
            <button
              class="px-3 py-1.5 rounded-lg bg-surface-raised text-slate-400 text-sm disabled:opacity-40"
              [disabled]="page() === totalPages()"
              (click)="setPage(page() + 1)"
            >
              Next
            </button>
          </div>
        }
      }
    </section>
  `,
})
export class CatalogComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly novels = signal<NovelSummary[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = 20;
  readonly langFilter = signal<LangFilter>('all');
  readonly searchQuery = signal('');
  readonly genreFilter = signal<string | null>(null);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit)));

  /** Derives unique genre names from currently loaded novels — no extra API call needed. */
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

  readonly skeletons = Array.from({ length: 10 }, (_, i) => i);

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

    this.api.getNovels({ ...params, limit: this.limit }).subscribe({
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

  setLangFilter(lang: LangFilter) {
    this.langFilter.set(lang);
    this.page.set(1);
  }

  setGenreFilter(genre: string | null) {
    this.genreFilter.set(genre);
    this.page.set(1);
  }

  setPage(p: number) {
    this.page.set(p);
  }

  onSearchInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchQuery.set(value);
      this.page.set(1);
    }, 300);
  }

  onNovelSelect(novel: NovelSummary) {
    this.router.navigate(['/novels', novel.slug]);
  }

  reload() {
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
