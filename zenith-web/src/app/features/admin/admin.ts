import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="max-w-6xl mx-auto px-4 py-8">
      <h1 class="text-2xl font-bold text-white mb-4">Admin Panel</h1>
      <p class="text-slate-400">Admin — WB-007 (stub)</p>
    </section>
  `,
})
export class AdminComponent {}
