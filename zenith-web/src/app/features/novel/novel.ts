import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
} from '@angular/core';
import { Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import type { Chapter } from '../../../domain/models/chapter.model';
import { ChapterListItemComponent } from './components/chapter-list-item';
import { NovelData } from './novel-data';

@Component({
  selector: 'app-novel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChapterListItemComponent, DecimalPipe],
  template: `
    <section class="max-w-4xl mx-auto px-4 py-8">

      <!-- Loading -->
      @if (data.loading()) {
        <div class="animate-pulse flex flex-col gap-6">
          <div class="flex gap-6">
            <div class="w-36 h-52 bg-slate-700 rounded-xl shrink-0"></div>
            <div class="flex flex-col gap-3 flex-1 pt-2">
              <div class="h-6 bg-slate-700 rounded w-3/4"></div>
              <div class="h-4 bg-slate-700 rounded w-1/3"></div>
              <div class="h-3 bg-slate-700 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      }

      <!-- Error -->
      @else if (data.error()) {
        <div class="flex flex-col items-center gap-4 py-16 text-center">
          <p class="text-slate-400">Failed to load novel.</p>
          <button
            class="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm hover:opacity-90"
            (click)="reload()"
          >
            Retry
          </button>
        </div>
      }

      <!-- Content -->
      @else if (data.novel()) {
        <!-- Hero -->
        <div class="flex flex-col sm:flex-row gap-6 mb-8">
          <!-- Cover -->
          <div class="shrink-0">
            @if (data.novel()!.coverUrl) {
              <img
                [src]="data.novel()!.coverUrl"
                [alt]="data.novel()!.title"
                class="w-36 h-52 object-cover rounded-xl border border-slate-700"
              />
            } @else {
              <div class="w-36 h-52 flex items-center justify-center rounded-xl bg-surface-raised border border-slate-700">
                <span class="text-5xl">📖</span>
              </div>
            }
          </div>

          <!-- Meta -->
          <div class="flex flex-col gap-3">
            <h1 class="text-2xl font-bold text-white">{{ data.novel()!.title }}</h1>

            @if (data.novel()!.author) {
              <p class="text-slate-400 text-sm">by {{ data.novel()!.author!.name }}</p>
            }

            <!-- Badges row -->
            <div class="flex flex-wrap gap-2 items-center">
              <span class="px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide bg-slate-700 text-slate-300">
                {{ data.novel()!.language }}
              </span>

              @if (data.novel()!.status) {
                <span
                  class="px-2 py-0.5 rounded text-xs font-medium"
                  [class]="statusClass(data.novel()!.status)"
                >
                  {{ data.novel()!.status }}
                </span>
              }

              <span class="text-xs text-slate-500">
                {{ data.novel()!.reads | number }} reads
              </span>

              <span class="text-xs text-slate-500">
                {{ data.novel()!.chapterCount }} chapters
              </span>
            </div>

            <!-- Genres -->
            @if (data.novel()!.genres.length > 0) {
              <div class="flex flex-wrap gap-1.5">
                @for (genre of data.novel()!.genres; track genre.id) {
                  <span class="px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-300">
                    {{ genre.name }}
                  </span>
                }
              </div>
            }

            <!-- Description -->
            @if (data.novel()!.description) {
              <p class="text-sm text-slate-400 leading-relaxed line-clamp-4">
                {{ data.novel()!.description }}
              </p>
            }
          </div>
        </div>

        <!-- Chapter list -->
        <div>
          <h2 class="text-lg font-semibold text-white mb-4">Chapters</h2>

          @if (data.chaptersLoading()) {
            <div class="space-y-2">
              @for (i of skeletons; track i) {
                <div class="h-14 rounded-lg bg-surface-raised animate-pulse"></div>
              }
            </div>
          } @else if (!data.hasChapters()) {
            <p class="text-slate-500 text-sm">No chapters available yet.</p>
          } @else {
            <ul class="flex flex-col gap-2">
              @for (chapter of data.chapters(); track chapter.id) {
                <app-chapter-list-item
                  [chapter]="chapter"
                  (select)="onChapterSelect($event)"
                />
              }
            </ul>
          }
        </div>
      }

    </section>
  `,
})
export class NovelComponent {
  // Route param bound via withComponentInputBinding()
  readonly id = input.required<string>();

  readonly data = inject(NovelData);
  private readonly router = inject(Router);

  readonly skeletons = Array.from({ length: 5 }, (_, i) => i);

  constructor() {
    effect(() => {
      const id = this.id();
      this.data.load(Number(id));
    });
  }

  onChapterSelect(chapter: Chapter) {
    this.router.navigate(['/novels', this.id(), chapter.id]);
  }

  reload() {
    this.data.load(Number(this.id()));
  }

  statusClass(status: string | null): string {
    switch (status?.toUpperCase()) {
      case 'ONGOING':
        return 'bg-green-900/50 text-green-400';
      case 'COMPLETED':
        return 'bg-blue-900/50 text-blue-400';
      case 'HIATUS':
        return 'bg-yellow-900/50 text-yellow-400';
      default:
        return 'bg-slate-700 text-slate-400';
    }
  }
}
