import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-reader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="max-w-3xl mx-auto px-4 py-8">
      <h1 class="text-xl font-bold text-white mb-6">Chapter Reader</h1>
      <p class="text-slate-400">Reader — WB-004 (stub)</p>
    </section>
  `,
})
export class ReaderComponent {}
