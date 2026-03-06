import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LanguageSelectorComponent } from './language-selector';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive, LanguageSelectorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
      <a routerLink="/" class="text-xl font-bold text-white">Zenith</a>

      <div class="flex items-center gap-4">
        <a routerLink="/novels"
           routerLinkActive="text-white"
           class="text-slate-400 hover:text-white transition-colors">
          Novels
        </a>
        <a routerLink="/login"
           routerLinkActive="text-white"
           class="text-slate-400 hover:text-white transition-colors">
          Login
        </a>
        <app-language-selector />
      </div>
    </nav>
  `,
})
export class NavbarComponent {}
