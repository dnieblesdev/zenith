import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col items-center justify-center min-h-[80vh] gap-6 px-4 text-center">
      <h1 class="text-4xl font-bold text-white">Welcome to Zenith</h1>
      <p class="text-lg text-slate-400 max-w-xl">
        A community-driven web novel platform. Read, suggest edits, and vote for the best corrections.
      </p>
    </section>
  `,
})
export class HomeComponent {}
