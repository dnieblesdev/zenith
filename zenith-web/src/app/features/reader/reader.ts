import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api';
import { AuthService } from '../../core/services/auth';
import { ReaderPreferencesService } from '../../core/services/reader-preferences';
import type { ChapterDetail, Paragraph } from '../../core/models/chapter.model';
import { ParagraphComponent } from './components/paragraph';
import { SuggestionPanelComponent } from './components/suggestion-panel';
import { ReaderSettingsComponent } from './components/reader-settings';

@Component({
  selector: 'app-reader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ParagraphComponent, SuggestionPanelComponent, ReaderSettingsComponent],
  template: `
    <div class="min-h-screen bg-surface">

      <section class="max-w-2xl mx-auto px-6 py-12 md:py-16">

        <!-- Loading skeleton -->
        @if (loading()) {
          <div class="animate-pulse flex flex-col gap-6">
            <!-- Fake chapter label -->
            <div class="h-3 bg-slate-800 rounded-full w-24 mb-2"></div>
            <!-- Fake title -->
            <div class="h-7 bg-slate-800 rounded-full w-3/4 mb-8"></div>
            <!-- Fake separator -->
            <div class="h-px bg-slate-800 w-full mb-6"></div>
            <!-- Fake paragraphs -->
            @for (i of skeletons; track i) {
              <div class="flex flex-col gap-2">
                <div class="h-4 bg-slate-800 rounded-full w-full"></div>
                <div class="h-4 bg-slate-800 rounded-full w-full"></div>
                <div class="h-4 bg-slate-800 rounded-full w-5/6"></div>
              </div>
            }
          </div>
        }

        <!-- Error state -->
        @else if (error()) {
          <div class="flex flex-col items-center gap-6 py-24 text-center">
            <div class="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center text-2xl">
              ⚠
            </div>
            <div>
              <p class="text-slate-300 font-medium mb-1">Couldn't load this chapter</p>
              <p class="text-slate-500 text-sm">There was a problem fetching the content.</p>
            </div>
            <button
              class="px-6 py-2.5 rounded-full bg-brand-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
              (click)="reload()"
            >
              Try again
            </button>
          </div>
        }

        <!-- Chapter content -->
        @else if (chapterData()) {

          <!-- Chapter header -->
          <header class="mb-10">
            <p class="text-xs font-medium text-brand-secondary uppercase tracking-[0.2em] mb-3">
              Chapter {{ chapterData()!.orderIndex }}
            </p>
            <h1 class="text-2xl md:text-3xl font-bold text-white leading-snug mb-6">
              {{ chapterData()!.title }}
            </h1>
            <!-- Decorative divider -->
            <div class="flex items-center gap-3">
              <div class="flex-1 h-px bg-slate-800"></div>
              <span class="text-slate-700 text-xs">✦</span>
              <div class="flex-1 h-px bg-slate-800"></div>
            </div>
          </header>

          <!-- No content available -->
          @if (!chapterData()!.contentAvailable) {
            <div class="flex flex-col items-center gap-3 py-16 text-center">
              <span class="text-3xl">📖</span>
              <p class="text-slate-400 font-medium">Chapter not yet available</p>
              <p class="text-slate-600 text-sm">The content for this chapter hasn't been published.</p>
            </div>
          }

          <!-- Paragraphs -->
          @else {
            <article [class]="'reader-prose flex flex-col gap-1 ' + prefs.fontSizeClass()">
              @for (para of chapterData()!.paragraphs; track para.index) {
                <app-paragraph
                  [paragraph]="para"
                  [suggestEnabled]="isAuthenticated()"
                  (clicked)="onParagraphClick($event)"
                />
              }
            </article>

            <!-- End of chapter ornament -->
            <div #endOfChapter class="flex items-center justify-center gap-3 mt-12 mb-10">
              <div class="w-12 h-px bg-slate-800"></div>
              <span class="text-slate-700 text-base">✦ ✦ ✦</span>
              <div class="w-12 h-px bg-slate-800"></div>
            </div>
          }

          <!-- Navigation -->
          <nav class="flex items-center justify-between pt-6 border-t border-slate-800/80">
            <button
              class="group flex items-center gap-2 px-5 py-2.5 rounded-full border border-slate-700 text-slate-300 text-sm font-medium hover:border-slate-500 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-slate-700 disabled:hover:text-slate-300"
              [disabled]="!hasPrev()"
              (click)="navigatePrev()"
            >
              <span class="transition-transform group-hover:-translate-x-0.5 group-enabled:group-hover:-translate-x-1">←</span>
              Previous
            </button>

            <button
              class="text-slate-500 text-xs hover:text-slate-300 transition-colors tracking-wide uppercase"
              (click)="backToNovel()"
            >
              Contents
            </button>

            <button
              class="group flex items-center gap-2 px-5 py-2.5 rounded-full border border-slate-700 text-slate-300 text-sm font-medium hover:border-slate-500 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-slate-700 disabled:hover:text-slate-300"
              [disabled]="!hasNext()"
              (click)="navigateNext()"
            >
              Next
              <span class="transition-transform group-enabled:group-hover:translate-x-1">→</span>
            </button>
          </nav>

        }

      </section>

    </div>

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

    <!-- Settings panel (shown when settings button is clicked) -->
    @if (settingsOpen()) {
      <app-reader-settings (close)="settingsOpen.set(false)" />
    }

    <!-- Floating settings button -->
    <button
      class="fixed bottom-6 right-6 z-30 w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 hover:bg-slate-700 shadow-lg transition-all"
      (click)="settingsOpen.set(true)"
      aria-label="Reader settings"
    >
      ⚙
    </button>
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
  private readonly destroyRef = inject(DestroyRef);
  readonly prefs = inject(ReaderPreferencesService);

  /** Template reference to the end-of-chapter ornament element. */
  private readonly endOfChapter = viewChild<ElementRef<HTMLDivElement>>('endOfChapter');

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

  /** Controls the settings panel visibility. */
  readonly settingsOpen = signal(false);

  /** Derived chapter ID for the suggestion panel. */
  readonly chapterId = computed(() => Number(this.chapter()));

  /** Auth state forwarded to the suggestion panel. */
  readonly isAuthenticated = computed(() => this.auth.isAuthenticated());

  constructor() {
    effect(() => {
      const chapterId = this.chapter();
      this.fetchChapter(Number(chapterId));
    });

    // Auto-scroll to next chapter via IntersectionObserver on the end ornament.
    // By tracking endOfChapter() directly, the effect re-runs only AFTER Angular
    // has rendered the DOM and the viewChild signal resolves to a real element.
    // This avoids the race condition where chapterData() changes before the new
    // DOM is painted (in which case endOfChapter() would still be undefined).
    let observer: IntersectionObserver | null = null;

    effect(() => {
      // Disconnect any previous observer before creating a new one.
      if (observer) {
        observer.disconnect();
        observer = null;
      }

      // Track the viewChild signal directly — it resolves to undefined while the
      // element is absent (loading / error state) and to the ElementRef once the
      // paragraph block is in the DOM.  The effect will re-run automatically the
      // moment Angular renders the element, guaranteeing the observer is always
      // attached to an existing node.
      const el = this.endOfChapter()?.nativeElement;
      if (!el) return;

      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry.isIntersecting && this.prefs.autoNextChapter() && this.hasNext()) {
            this.navigateNext();
          }
        },
        { threshold: 1.0 },
      );

      observer.observe(el);
    });

    this.destroyRef.onDestroy(() => {
      observer?.disconnect();
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
    this.api.getChapters(this.slug()).subscribe({
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
