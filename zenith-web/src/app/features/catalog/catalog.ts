import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-catalog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="max-w-6xl mx-auto px-4 py-8">
      <h1 class="text-2xl font-bold text-white mb-6">Novel Catalog</h1>
      <p class="text-slate-400">Catalog — WB-002 (stub)</p>
    </section>
  `,
})
export class CatalogComponent {}
