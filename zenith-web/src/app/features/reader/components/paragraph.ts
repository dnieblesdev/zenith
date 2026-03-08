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
      [class]="paragraphClass()"
      (click)="onParagraphClick()"
    >
      {{ paragraph().text }}

      @if (paragraph().isCorrected) {
        <span
          class="inline-flex items-center ml-2 px-1.5 py-0.5 rounded-full text-xs font-medium bg-brand-secondary/10 text-brand-secondary align-middle leading-none"
          title="Community correction applied"
        >
          ✓ edited
        </span>
      }

      <!-- "Suggest" hint: only visible on hover when suggest is enabled -->
      @if (suggestEnabled()) {
        <span
          class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        >
          suggest
        </span>
      }
    </p>
  `,
})
export class ParagraphComponent {
  readonly paragraph = input.required<Paragraph>();
  readonly suggestEnabled = input<boolean>(true);
  readonly clicked = output<Paragraph>();

  paragraphClass(): string {
    const base = 'group relative rounded-sm -mx-3 px-3 py-0.5 transition-colors duration-200 select-none';
    const interactive = this.suggestEnabled()
      ? 'cursor-pointer hover:bg-slate-800/60'
      : 'cursor-default';
    const corrected = this.paragraph().isCorrected
      ? 'pl-4 border-l-2 border-brand-secondary'
      : '';
    return `${base} ${interactive} ${corrected}`.trim();
  }

  onParagraphClick(): void {
    if (this.suggestEnabled()) {
      this.clicked.emit(this.paragraph());
    }
  }
}
