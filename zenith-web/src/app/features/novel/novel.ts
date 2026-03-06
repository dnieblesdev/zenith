import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-novel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="max-w-4xl mx-auto px-4 py-8">
      <h1 class="text-2xl font-bold text-white mb-4">Novel Detail</h1>
      <p class="text-slate-400">Novel detail page — WB-003 (stub)</p>
    </section>
  `,
})
export class NovelComponent {}
