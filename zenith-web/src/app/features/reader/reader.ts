import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api';
import { AuthService } from '../../core/services/auth';
import type { ChapterDetail, Paragraph } from '../../core/models/chapter.model';
import { ParagraphComponent } from './components/paragraph';
import { SuggestionPanelComponent } from './components/suggestion-panel';

@Component({
  selector: 'app-reader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ParagraphComponent, SuggestionPanelComponent],
  template: `
    <section class="max-w-3xl mx-auto px-4 py-8">

      <!-- Loading skeleton -->
      @if (loading()) {
        <div class="animate-pulse flex flex-col gap-4">
          <div class="h-6 bg-slate-700 rounded w-2/3 mb-6"></div>
          @for (i of skeletons; track i) {
            <div class="h-4 bg-slate-700 rounded w-full"></div>
          }
        </div>
      }

      <!-- Error state -->
      @else if (error()) {
        <div class="flex flex-col items-center gap-4 py-16 text-center">
          <p class="text-slate-400">Failed to load chapter.</p>
          <button
            class="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm hover:opacity-90"
            (click)="reload()"
          >
            Retry
          </button>
        </div>
      }

      <!-- Chapter content -->
      @else if (chapterData()) {
        <!-- Chapter header -->
        <header class="mb-8">
          <p class="text-xs text-slate-500 uppercase tracking-widest mb-2">
            Chapter {{ chapterData()!.orderIndex + 1 }}
          </p>
          <h1 class="text-xl font-bold text-white">{{ chapterData()!.title }}</h1>
        </header>

        <!-- No content available -->
        @if (!chapterData()!.contentAvailable) {
          <div class="flex flex-col items-center gap-2 py-12 text-center">
            <p class="text-slate-500">Chapter content is not available yet.</p>
          </div>
        }

        <!-- Paragraphs -->
        @else {
          <article class="flex flex-col gap-5">
            @for (para of chapterData()!.paragraphs; track para.index) {
              <app-paragraph
                [paragraph]="para"
                (clicked)="onParagraphClick($event)"
              />
            }
          </article>
        }

        <!-- Navigation -->
        <nav class="flex items-center justify-between mt-12 pt-6 border-t border-slate-700">
          <button
            class="px-4 py-2 rounded-lg bg-surface-raised text-slate-300 text-sm hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            [disabled]="!hasPrev()"
            (click)="navigatePrev()"
          >
            ← Previous
          </button>

          <button
            class="px-4 py-2 rounded-lg text-slate-400 text-sm hover:text-white transition-colors"
            (click)="backToNovel()"
          >
            Table of Contents
          </button>

          <button
            class="px-4 py-2 rounded-lg bg-surface-raised text-slate-300 text-sm hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            [disabled]="!hasNext()"
            (click)="navigateNext()"
          >
            Next →
          </button>
        </nav>
      }

    </section>

    <!-- Suggestion panel (shown when a paragraph is selected) -->
    @if (selectedParagraph() !== null) {
      <app-suggestion-panel
        [chapterId]="chapterId()"
        [paragraphIndex]="selectedParagraph()!.index"
        [originalText]="selectedParagraph()!.text"
        [isAuthenticated]="isAuthenticated()"
        (close)="closeSuggestionPanel()"
      />
    }
  `,
})
export class ReaderComponent {
  // Route params bound via withComponentInputBinding()
  // 'slug' corresponds to :slug and 'chapter' to :chapter in routes.ts
  readonly slug = input.required<string>();
  readonly chapter = input.required<string>();

  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  // Renamed to avoid collision with the 'chapter' input signal in the template
  readonly chapterData = signal<ChapterDetail | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);

  readonly prevChapterId = signal<number | null>(null);
  readonly nextChapterId = signal<number | null>(null);

  readonly hasPrev = computed(() => this.prevChapterId() !== null);
  readonly hasNext = computed(() => this.nextChapterId() !== null);

  readonly skeletons = Array.from({ length: 12 }, (_, i) => i);

  /** Currently selected paragraph for the suggestion panel. */
  readonly selectedParagraph = signal<Paragraph | null>(null);

  /** Derived chapter ID for the suggestion panel. */
  readonly chapterId = computed(() => Number(this.chapter()));

  /** Auth state forwarded to the suggestion panel. */
  readonly isAuthenticated = computed(() => this.auth.isAuthenticated());

  constructor() {
    effect(() => {
      const chapterId = this.chapter();
      this.fetchChapter(Number(chapterId));
    });
  }

  private fetchChapter(chapterId: number) {
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

    this.api.getChapter(chapterId).subscribe({
      next: (chap) => {
        this.chapterData.set(chap);
        this.loading.set(false);
        this.loadAdjacentChapters(chap);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  /**
   * Fetch the novel's full chapter list to determine prev/next chapter IDs.
   */
  private loadAdjacentChapters(chap: ChapterDetail) {
    this.api.getChapters(chap.novelId).subscribe({
      next: (chapters) => {
        const sorted = [...chapters].sort((a, b) => a.orderIndex - b.orderIndex);
        const idx = sorted.findIndex((c) => c.id === chap.id);
        this.prevChapterId.set(idx > 0 ? sorted[idx - 1].id : null);
        this.nextChapterId.set(idx < sorted.length - 1 ? sorted[idx + 1].id : null);
      },
    });
  }

  onParagraphClick(paragraph: Paragraph) {
    this.selectedParagraph.set(paragraph);
  }

  closeSuggestionPanel() {
    this.selectedParagraph.set(null);
  }

  navigatePrev() {
    const prev = this.prevChapterId();
    if (prev !== null) {
      this.router.navigate(['/novels', this.slug(), prev]);
    }
  }

  navigateNext() {
    const next = this.nextChapterId();
    if (next !== null) {
      this.router.navigate(['/novels', this.slug(), next]);
    }
  }

  backToNovel() {
    this.router.navigate(['/novels', this.slug()]);
  }

  reload() {
    this.fetchChapter(Number(this.chapter()));
  }
}
