import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api';
import type { Suggestion } from '../../../core/models/suggestion.model';

@Component({
  selector: 'app-suggestion-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <aside
      class="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col bg-surface-raised shadow-2xl border-l border-slate-700 overflow-y-auto"
    >
      <!-- Header -->
      <header class="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
        <h2 class="text-sm font-semibold text-white">
          Suggestions — paragraph {{ paragraphIndex() + 1 }}
        </h2>
        <button
          class="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          aria-label="Close suggestions panel"
          (click)="close.emit()"
        >
          ✕
        </button>
      </header>

      <!-- Loading -->
      @if (loading()) {
        <div class="flex items-center justify-center py-12">
          <div class="h-6 w-6 animate-spin rounded-full border-2 border-brand-primary border-t-transparent"></div>
        </div>
      }

      <!-- Error -->
      @else if (error()) {
        <div class="mx-5 mt-4 rounded-lg bg-red-900/30 border border-red-700/50 px-4 py-3 text-sm text-red-400">
          {{ error() }}
        </div>
      }

      <!-- Suggestion list -->
      @else {
        <ul class="flex flex-col gap-3 px-5 py-4">
          @for (s of suggestions(); track s.id) {
            <li class="rounded-lg bg-slate-800/60 border border-slate-700/50 p-4">
              <!-- Proposed text -->
              <p class="text-sm text-slate-200 leading-relaxed mb-2">{{ s.proposedText }}</p>

              <!-- Note -->
              @if (s.note) {
                <p class="text-xs text-slate-500 italic mb-3">{{ s.note }}</p>
              }

              <!-- Footer: author + vote -->
              <div class="flex items-center justify-between">
                <span class="text-xs text-slate-500">by {{ s.user.username }}</span>

                <div class="flex items-center gap-2">
                  <span class="text-xs text-slate-400">{{ s.voteCount }} votes</span>

                  @if (votedIds().has(s.id)) {
                    <!-- Unvote button -->
                    <button
                      class="px-2.5 py-1 rounded text-xs font-medium bg-brand-primary/20 text-brand-primary border border-brand-primary/40 hover:bg-brand-primary/30 transition-colors"
                      (click)="onUnvote(s)"
                    >
                      Unvote
                    </button>
                  } @else {
                    <!-- Vote button -->
                    <button
                      class="px-2.5 py-1 rounded text-xs font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      [disabled]="!isAuthenticated()"
                      (click)="onVote(s)"
                    >
                      Vote
                    </button>
                  }
                </div>
              </div>
            </li>
          } @empty {
            @if (!loading()) {
              <li class="py-8 text-center text-slate-500 text-sm">
                No suggestions yet for this paragraph.
              </li>
            }
          }
        </ul>
      }

      <!-- Suggest correction section -->
      <div class="mt-auto border-t border-slate-700 px-5 py-4 shrink-0">
        @if (isAuthenticated()) {
          @if (!showForm()) {
            <button
              class="w-full px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
              (click)="showForm.set(true)"
            >
              Suggest a correction
            </button>
          } @else {
            <!-- Suggestion form -->
            <form (ngSubmit)="onSubmit()" class="flex flex-col gap-3">
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-1">
                  Proposed text <span class="text-red-400">*</span>
                </label>
                <textarea
                  class="w-full rounded-lg bg-slate-800 border border-slate-600 text-slate-200 text-sm px-3 py-2 focus:outline-none focus:border-brand-primary resize-none placeholder-slate-500"
                  rows="4"
                  placeholder="Enter your proposed correction…"
                  [(ngModel)]="proposedText"
                  name="proposedText"
                  required
                ></textarea>
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-400 mb-1">
                  Note <span class="text-slate-500">(optional, max 500 chars)</span>
                </label>
                <input
                  class="w-full rounded-lg bg-slate-800 border border-slate-600 text-slate-200 text-sm px-3 py-2 focus:outline-none focus:border-brand-primary placeholder-slate-500"
                  type="text"
                  placeholder="Why this change?"
                  [(ngModel)]="noteText"
                  name="noteText"
                  maxlength="500"
                />
              </div>

              <div class="flex gap-2">
                <button
                  type="submit"
                  class="flex-1 px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  [disabled]="submitting() || !proposedText.trim()"
                >
                  @if (submitting()) {
                    Submitting…
                  } @else {
                    Submit
                  }
                </button>
                <button
                  type="button"
                  class="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition-colors"
                  (click)="cancelForm()"
                >
                  Cancel
                </button>
              </div>

              @if (submitError()) {
                <p class="text-xs text-red-400">{{ submitError() }}</p>
              }
            </form>
          }
        } @else {
          <p class="text-center text-xs text-slate-500">
            <a class="text-brand-primary hover:underline" href="/login">Sign in</a> to vote or suggest corrections.
          </p>
        }
      </div>
    </aside>

    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-30 bg-black/50"
      (click)="close.emit()"
    ></div>
  `,
})
export class SuggestionPanelComponent {
  readonly chapterId = input.required<number>();
  readonly paragraphIndex = input.required<number>();
  readonly originalText = input.required<string>();
  readonly isAuthenticated = input<boolean>(false);

  readonly close = output<void>();

  private readonly api = inject(ApiService);

  readonly suggestions = signal<Suggestion[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly votedIds = signal<Set<number>>(new Set());

  readonly showForm = signal(false);
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  // Two-way bound form fields (plain properties — no signals needed for ngModel)
  proposedText = '';
  noteText = '';

  constructor() {
    effect(() => {
      const chapterId = this.chapterId();
      const paragraphIndex = this.paragraphIndex();
      this.loadSuggestions(chapterId, paragraphIndex);
    });
  }

  private loadSuggestions(chapterId: number, paragraphIndex: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.suggestions.set([]);

    this.api.getSuggestions(chapterId, paragraphIndex).subscribe({
      next: (response) => {
        this.suggestions.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load suggestions. Please try again.');
        this.loading.set(false);
      },
    });
  }

  onVote(suggestion: Suggestion): void {
    this.api.voteSuggestion(suggestion.id).subscribe({
      next: () => {
        // Optimistic update: increment voteCount + track voted id
        this.suggestions.update((list) =>
          list.map((s) =>
            s.id === suggestion.id ? { ...s, voteCount: s.voteCount + 1 } : s
          )
        );
        this.votedIds.update((ids) => new Set([...ids, suggestion.id]));
      },
    });
  }

  onUnvote(suggestion: Suggestion): void {
    this.api.unvoteSuggestion(suggestion.id).subscribe({
      next: () => {
        // Optimistic update: decrement voteCount + remove from voted ids
        this.suggestions.update((list) =>
          list.map((s) =>
            s.id === suggestion.id ? { ...s, voteCount: Math.max(0, s.voteCount - 1) } : s
          )
        );
        this.votedIds.update((ids) => {
          const next = new Set(ids);
          next.delete(suggestion.id);
          return next;
        });
      },
    });
  }

  onSubmit(): void {
    const proposed = this.proposedText.trim();
    if (!proposed || this.submitting()) return;

    this.submitting.set(true);
    this.submitError.set(null);

    this.api
      .createSuggestion({
        chapterId: this.chapterId(),
        paragraphIndex: this.paragraphIndex(),
        originalText: this.originalText(),
        proposedText: proposed,
        note: this.noteText.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.cancelForm();
          // Refresh suggestions list
          this.loadSuggestions(this.chapterId(), this.paragraphIndex());
        },
        error: () => {
          this.submitting.set(false);
          this.submitError.set('Failed to submit suggestion. Please try again.');
        },
      });
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.proposedText = '';
    this.noteText = '';
    this.submitError.set(null);
  }
}
