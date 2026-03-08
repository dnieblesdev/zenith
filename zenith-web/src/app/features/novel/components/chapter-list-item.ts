import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { Chapter } from '../../../core/models/chapter.model';

@Component({
  selector: 'app-chapter-list-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  template: `
    <li
      class="flex items-center justify-between px-4 py-3 rounded-lg bg-surface-raised hover:bg-slate-700 cursor-pointer transition-colors border border-transparent hover:border-slate-600"
      (click)="select.emit(chapter())"
    >
      <div class="flex flex-col gap-0.5 min-w-0">
        <span class="text-sm text-white truncate">
          {{ chapter().title }}
        </span>
        <span class="text-xs text-slate-500">
          Ch. {{ chapter().orderIndex }}
        </span>
      </div>
      <span class="text-xs text-slate-500 shrink-0 ml-4">
        {{ chapter().reads | number }} reads
      </span>
    </li>
  `,
})
export class ChapterListItemComponent {
  readonly chapter = input.required<Chapter>();
  readonly select = output<Chapter>();
}
