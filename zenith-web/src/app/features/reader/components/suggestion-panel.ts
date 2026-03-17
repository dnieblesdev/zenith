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
import type { Suggestion } from '../../../../domain/models/suggestion.model';
import { ReaderData } from '../reader-data';

@Component({
  selector: 'app-suggestion-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <aside class="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col bg-surface-raised overflow-y-auto border-l border-slate-800 shadow-2xl">

      <!-- Header -->
      <header class="flex items-center justify-between px-6 py-5 border-b border-slate-800 shrink-0">
        <div>
          <div class="text-xs font-medium uppercase tracking-widest text-brand-secondary mb-0.5">Community Suggestions</div>
          <div class="text-sm font-semibold text-white">Paragraph {{ paragraphIndex() + 1 }}</div>
        </div>
        <button
          class="flex items-center justify-center w-8 h-8 rounded-full hover:bg-slate-700 text-slate-500 hover:text-slate-200 transition-all"
          aria-label="Close suggestions panel"
          (click)="close.emit()"
        >✕</button>
      </header>

      <!-- Original text preview -->
      <div class="mx-6 mt-4 mb-2 px-3 py-3 rounded-lg bg-slate-800 border border-slate-700">
        <div class="text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-medium">Original</div>
        <div class="text-xs text-slate-400 leading-relaxed italic line-clamp-3">{{ originalText() }}</div>
      </div>

      <!-- Loading -->
      @if (loading()) {
        <div class="flex flex-col items-center justify-center py-16 gap-3">
          <div class="h-5 w-5 animate-spin rounded-full border-2 border-brand-primary border-t-transparent"></div>
          <div class="text-xs text-slate-600">Loading suggestions…</div>
        </div>
      } @else if (error()) {
        <!-- Error -->
        <div class="mx-6 mt-4 rounded-xl bg-red-950 border border-red-800 px-4 py-3 text-sm text-red-400">
          {{ error() }}
        </div>
      } @else {
        <!-- Suggestion list -->
        <div class="flex flex-col gap-2 px-6 py-4 flex-1">
          @for (s of suggestions(); track s.id) {
            <div [class]="suggestionClass(s.id)">
              <div class="text-sm text-slate-200 leading-relaxed mb-3">{{ s.proposedText }}</div>
              @if (s.note) {
                <div class="text-xs text-slate-500 italic mb-3 pl-2 border-l border-slate-700">"{{ s.note }}"</div>
              }
              <div class="flex items-center justify-between">
                <span class="text-xs text-slate-600">by <span class="text-slate-400">{{ s.user.username }}</span></span>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-slate-400">{{ s.voteCount }} {{ s.voteCount === 1 ? 'vote' : 'votes' }}</span>
                  @if (votedIds().has(s.id)) {
                    <button
                      class="px-2.5 py-1 rounded-full text-xs font-medium bg-brand-secondary text-surface border border-brand-secondary transition-colors"
                      (click)="onUnvote(s)"
                    >&#9650; Voted</button>
                  } @else {
                    <button
                      class="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      [disabled]="!isAuthenticated()"
                      [title]="isAuthenticated() ? '' : 'Sign in to vote'"
                      (click)="onVote(s)"
                    >&#9650; Vote</button>
                  }
                </div>
              </div>
            </div>
          } @empty {
            <div class="flex flex-col items-center gap-2 py-12 text-center">
              <div class="text-slate-500 text-sm">No suggestions yet.</div>
              <div class="text-slate-600 text-xs">Be the first to propose a correction.</div>
            </div>
          }
        </div>
      }

      <!-- Suggest correction section -->
      <div class="border-t border-slate-800 px-6 py-5 shrink-0">
        @if (isAuthenticated()) {
          @if (!showForm()) {
            <button
              class="w-full py-2.5 rounded-full bg-brand-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
              (click)="showForm.set(true)"
            >+ Suggest a correction</button>
          } @else {
            <form (ngSubmit)="onSubmit()" class="flex flex-col gap-3">
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-1.5">
                  Proposed text <span class="text-brand-primary">*</span>
                </label>
                <textarea
                  class="w-full rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm px-4 py-3 focus:outline-none focus:border-brand-primary resize-none placeholder-slate-600 transition-colors"
                  rows="4"
                  placeholder="Enter your proposed correction…"
                  [(ngModel)]="proposedText"
                  name="proposedText"
                  required
                ></textarea>
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-1.5">
                  Note <span class="text-slate-600">(optional)</span>
                </label>
                <input
                  class="w-full rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm px-4 py-2.5 focus:outline-none focus:border-brand-primary placeholder-slate-600 transition-colors"
                  type="text"
                  placeholder="Why this change?"
                  [(ngModel)]="noteText"
                  name="noteText"
                  maxlength="500"
                />
              </div>
              <div class="flex gap-2 pt-1">
                <button
                  type="submit"
                  class="flex-1 py-2.5 rounded-full bg-brand-primary text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
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
                  class="px-5 py-2.5 rounded-full bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition-colors border border-slate-600"
                  (click)="cancelForm()"
                >Cancel</button>
              </div>
              @if (submitError()) {
                <div class="text-xs text-red-400 text-center">{{ submitError() }}</div>
              }
            </form>
          }
        } @else {
          <div class="text-center text-xs text-slate-600">
            <a class="text-brand-primary hover:underline font-medium" href="/login">Sign in</a>
            to vote or suggest corrections.
          </div>
        }
      </div>
    </aside>

    <!-- Backdrop -->
    <div class="fixed inset-0 z-30 bg-black/60" (click)="close.emit()"></div>
  `,
})
export class SuggestionPanelComponent {
  readonly chapterId = input.required<number>();
  readonly paragraphIndex = input.required<number>();
  readonly originalText = input.required<string>();
  readonly isAuthenticated = input<boolean>(false);

  readonly close = output<void>();

  private readonly data = inject(ReaderData);

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

    this.data.getSuggestions(chapterId, paragraphIndex).subscribe({
      next: (suggestions) => {
        this.suggestions.set(suggestions);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load suggestions. Please try again.');
        this.loading.set(false);
      },
    });
  }

  onVote(suggestion: Suggestion): void {
    this.data.voteSuggestion(suggestion.id).subscribe({
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
    this.data.unvoteSuggestion(suggestion.id).subscribe({
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

    this.data
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

  suggestionClass(id: number): string {
    const voted = this.votedIds().has(id);
    return [
      'rounded-xl border p-4 transition-colors',
      voted
        ? 'border-brand-secondary bg-slate-800'
        : 'border-slate-700 bg-slate-800',
    ].join(' ');
  }
}
