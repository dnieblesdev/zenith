import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import type { Paragraph } from '../../../domain/models/chapter.model';
import { ParagraphComponent } from './components/paragraph';
import { SuggestionPanelComponent } from './components/suggestion-panel';
import { ReaderData } from './reader-data';

@Component({
  selector: 'app-reader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ParagraphComponent, SuggestionPanelComponent],
  template: `
    <div class="min-h-screen bg-surface">

      <section class="max-w-2xl mx-auto px-6 py-12 md:py-16">

        <!-- Loading skeleton -->
        @if (data.loading()) {
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
        @else if (data.error()) {
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
        @else if (data.chapterData()) {

          <!-- Chapter header -->
          <header class="mb-10">
            <p class="text-xs font-medium text-brand-secondary uppercase tracking-[0.2em] mb-3">
              Chapter {{ data.chapterData()!.orderIndex }}
            </p>
            <h1 class="text-2xl md:text-3xl font-bold text-white leading-snug mb-6">
              {{ data.chapterData()!.title }}
            </h1>
            <!-- Decorative divider -->
            <div class="flex items-center gap-3">
              <div class="flex-1 h-px bg-slate-800"></div>
              <span class="text-slate-700 text-xs">✦</span>
              <div class="flex-1 h-px bg-slate-800"></div>
            </div>
          </header>

          <!-- No content available -->
          @if (!data.chapterData()!.contentAvailable) {
            <div class="flex flex-col items-center gap-3 py-16 text-center">
              <span class="text-3xl">📖</span>
              <p class="text-slate-400 font-medium">Chapter not yet available</p>
              <p class="text-slate-600 text-sm">The content for this chapter hasn't been published.</p>
            </div>
          }

          <!-- Paragraphs -->
          @else {
            <article class="flex flex-col gap-1">
              @for (para of data.chapterData()!.paragraphs; track para.index) {
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
              [disabled]="!data.hasPrev()"
              (click)="navigatePrev()"
            >
              <span class="transition-transform group-hover:-translate-x-0.5">←</span>
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
              [disabled]="!data.hasNext()"
              (click)="navigateNext()"
            >
              Next
              <span class="transition-transform group-enabled:translate-x-1">→</span>
            </button>
          </nav>

        }

      </section>

    </div>

    <!-- Suggestion panel (shown when a paragraph is selected) -->
    @if (data.selectedParagraph() !== null) {
      <app-suggestion-panel
        [chapterId]="chapterIdNumber()"
        [paragraphIndex]="data.selectedParagraph()!.index"
        [originalText]="data.selectedParagraph()!.text"
        [isAuthenticated]="isAuthenticated()"
        (close)="closeSuggestionPanel()"
      />
    }
  `,
})
export class ReaderComponent {
  // Route params bound via withComponentInputBinding()
  readonly novelId = input.required<string>();
  readonly chapterId = input.required<string>();

  readonly data = inject(ReaderData);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  /** Template reference to the end-of-chapter ornament element. */
  private readonly endOfChapter = viewChild<ElementRef<HTMLDivElement>>('endOfChapter');

  readonly skeletons = Array.from({ length: 12 }, (_, i) => i);

  /** Derived chapter ID for the suggestion panel. */
  readonly chapterIdNumber = computed(() => Number(this.chapterId()));

  /** Auth state forwarded to the suggestion panel. */
  readonly isAuthenticated = computed(() => this.auth.isAuthenticated());

  constructor() {
    // Load chapter when chapterId changes
    effect(() => {
      const chapterId = this.chapterId();
      this.data.loadChapter(Number(chapterId));
    });

    // Auto-scroll to next chapter via IntersectionObserver on the end ornament.
    let observer: IntersectionObserver | null = null;

    effect(() => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }

      const el = this.endOfChapter()?.nativeElement;
      if (!el) return;

      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry.isIntersecting && this.data.hasNext()) {
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

  onParagraphClick(paragraph: Paragraph) {
    this.data.selectParagraph(paragraph);
  }

  closeSuggestionPanel() {
    this.data.selectParagraph(null);
  }

  navigatePrev() {
    const prev = this.data.prevChapterId();
    if (prev !== null) {
      this.router.navigate(['/novels', this.novelId(), prev]);
    }
  }

  navigateNext() {
    const next = this.data.nextChapterId();
    if (next !== null) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.router.navigate(['/novels', this.novelId(), next]);
    }
  }

  backToNovel() {
    this.router.navigate(['/novels', this.novelId()]);
  }

  reload() {
    this.data.loadChapter(Number(this.chapterId()));
  }
}
