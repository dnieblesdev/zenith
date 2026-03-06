import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { NovelSummary } from '../../../core/models/novel.model';

@Component({
  selector: 'app-novel-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  template: `
    <article
      class="flex flex-col rounded-xl bg-surface-raised border border-slate-700 overflow-hidden cursor-pointer hover:border-slate-500 transition-colors"
      (click)="select.emit(novel())"
    >
      <!-- Cover image -->
      <div class="relative aspect-[2/3] bg-slate-800 overflow-hidden">
        @if (novel().coverUrl) {
          <img
            [src]="novel().coverUrl"
            [alt]="novel().title"
            class="w-full h-full object-cover"
          />
        } @else {
          <div class="w-full h-full flex items-center justify-center">
            <span class="text-slate-600 text-4xl">📖</span>
          </div>
        }

        <!-- Language badge -->
        <span
          class="absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide bg-slate-900/80 text-slate-300"
        >
          {{ novel().language }}
        </span>
      </div>

      <!-- Card body -->
      <div class="flex flex-col gap-2 p-3 flex-1">
        <h3 class="text-sm font-bold text-white line-clamp-2 leading-snug">
          {{ novel().title }}
        </h3>

        @if (novel().author) {
          <p class="text-xs text-slate-400">{{ novel().author!.name }}</p>
        }

        <!-- Genres (up to 3) -->
        @if (novel().genres.length > 0) {
          <div class="flex flex-wrap gap-1">
            @for (genre of novel().genres.slice(0, 3); track genre.id) {
              <span
                class="px-1.5 py-0.5 rounded text-xs bg-slate-700 text-slate-300"
              >
                {{ genre.name }}
              </span>
            }
          </div>
        }

        <!-- Footer -->
        <div class="flex items-center justify-between mt-auto pt-1">
          <!-- Status badge -->
          @if (novel().status) {
            <span
              class="px-2 py-0.5 rounded text-xs font-medium"
              [class]="statusClass(novel().status)"
            >
              {{ novel().status }}
            </span>
          }
          <!-- Read count -->
          <span class="text-xs text-slate-500 ml-auto">
            {{ novel().reads | number }} reads
          </span>
        </div>
      </div>
    </article>
  `,
})
export class NovelCardComponent {
  readonly novel = input.required<NovelSummary>();
  readonly select = output<NovelSummary>();

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
