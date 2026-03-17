import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import type { NovelSummary } from '../../../domain/models/novel.model';
import { NovelCardComponent } from './components/novel-card';
import { CatalogData } from './catalog-data';

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
            @for (option of data.langOptions; track option.value) {
              <button
                class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                [class]="data.langFilter() === option.value
                  ? 'bg-brand-primary text-white'
                  : 'bg-surface-raised text-slate-400 hover:text-white'"
                (click)="data.setLangFilter(option.value)"
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
            [value]="data.searchQuery()"
            (input)="onSearchInput($event)"
          />
        </div>

        <!-- Genre filter -->
        @if (data.availableGenres().length > 0) {
          <div class="flex flex-wrap gap-2">
            <button
              class="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
              [class]="data.genreFilter() === null
                ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/40'
                : 'bg-surface-raised text-slate-400 border border-slate-700 hover:border-slate-500 hover:text-white'"
              (click)="data.setGenreFilter(null)"
            >
              All genres
            </button>
            @for (genre of data.availableGenres(); track genre) {
              <button
                class="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                [class]="data.genreFilter() === genre
                  ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/40'
                  : 'bg-surface-raised text-slate-400 border border-slate-700 hover:border-slate-500 hover:text-white'"
                (click)="data.setGenreFilter(genre)"
              >
                {{ genre }}
              </button>
            }
          </div>
        }
      </div>

      <!-- Loading skeleton -->
      @if (data.loading()) {
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          @for (i of skeletons; track i) {
            <div class="rounded-xl bg-surface-raised animate-pulse">
              <div class="aspect-2/3 bg-slate-700 rounded-t-xl"></div>
              <div class="p-3 flex flex-col gap-2">
                <div class="h-4 bg-slate-700 rounded w-3/4"></div>
                <div class="h-3 bg-slate-700 rounded w-1/2"></div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Error state -->
      @else if (data.error()) {
        <div class="flex flex-col items-center gap-4 py-16 text-center">
          <p class="text-slate-400">Failed to load novels.</p>
          <button
            class="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm hover:opacity-90"
            (click)="data.reload()"
          >
            Retry
          </button>
        </div>
      }

      <!-- Empty state -->
      @else if (!data.loading() && !data.hasNovels()) {
        <div class="flex flex-col items-center gap-2 py-16 text-center">
          <p class="text-slate-400">No novels found.</p>
        </div>
      }

      <!-- Novel grid -->
      @else {
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          @for (novel of data.novels(); track novel.id) {
            <app-novel-card
              [novel]="novel"
              (select)="onNovelSelect($event)"
            />
          }
        </div>

        <!-- Pagination -->
        @if (data.totalPages() > 1) {
          <div class="flex items-center justify-center gap-2 mt-8">
            <button
              class="px-3 py-1.5 rounded-lg bg-surface-raised text-slate-400 text-sm disabled:opacity-40"
              [disabled]="data.page() === 1"
              (click)="data.setPage(data.page() - 1)"
            >
              Previous
            </button>
            <span class="text-slate-400 text-sm">
              {{ data.page() }} / {{ data.totalPages() }}
            </span>
            <button
              class="px-3 py-1.5 rounded-lg bg-surface-raised text-slate-400 text-sm disabled:opacity-40"
              [disabled]="data.page() === data.totalPages()"
              (click)="data.setPage(data.page() + 1)"
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
  readonly data = inject(CatalogData);
  private readonly router = inject(Router);

  readonly skeletons = Array.from({ length: 10 }, (_, i) => i);

  onSearchInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.data.onSearchInput(value);
  }

  onNovelSelect(novel: NovelSummary) {
    this.router.navigate(['/novels', novel.id]);
  }
}
