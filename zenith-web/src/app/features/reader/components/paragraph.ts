import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import type { Paragraph } from '../../../core/models/chapter.model';

@Component({
  selector: 'app-paragraph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p
      class="text-base leading-relaxed text-slate-200 cursor-pointer rounded px-1 -mx-1 transition-colors hover:bg-slate-700/40 relative"
      [class.border-l-2]="paragraph().isCorrected"
      [class.border-brand-secondary]="paragraph().isCorrected"
      [class.pl-3]="paragraph().isCorrected"
      (click)="clicked.emit(paragraph())"
    >
      {{ paragraph().text }}
      @if (paragraph().isCorrected) {
        <span
          class="inline-flex items-center ml-1.5 px-1 py-0.5 rounded text-xs bg-brand-secondary/20 text-brand-secondary align-middle"
          title="Community correction applied"
        >
          ✓
        </span>
      }
    </p>
  `,
})
export class ParagraphComponent {
  readonly paragraph = input.required<Paragraph>();
  readonly clicked = output<Paragraph>();
}
