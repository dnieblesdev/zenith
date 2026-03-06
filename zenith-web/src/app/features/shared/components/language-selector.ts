import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

type Lang = 'en' | 'es';

@Component({
  selector: 'app-language-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-1">
      <button
        (click)="setLang('en')"
        [class]="lang() === 'en' ? 'text-white font-semibold' : 'text-slate-400 hover:text-white'"
        class="text-sm transition-colors">
        EN
      </button>
      <span class="text-slate-600">/</span>
      <button
        (click)="setLang('es')"
        [class]="lang() === 'es' ? 'text-white font-semibold' : 'text-slate-400 hover:text-white'"
        class="text-sm transition-colors">
        ES
      </button>
    </div>
  `,
})
export class LanguageSelectorComponent {
  private readonly platformId = inject(PLATFORM_ID);

  readonly lang = signal<Lang>(this.detectLang());

  setLang(l: Lang): void {
    this.lang.set(l);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('preferred_lang', l);
    }
  }

  private detectLang(): Lang {
    if (!isPlatformBrowser(this.platformId)) return 'en';
    const stored = localStorage.getItem('preferred_lang') as Lang | null;
    if (stored === 'en' || stored === 'es') return stored;
    const browser = navigator.language.slice(0, 2);
    return browser === 'es' ? 'es' : 'en';
  }
}
