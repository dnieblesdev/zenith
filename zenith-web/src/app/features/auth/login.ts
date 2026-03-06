import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <div class="w-full max-w-sm space-y-6">
        <h1 class="text-2xl font-bold text-white text-center">Sign In</h1>
        <p class="text-slate-400 text-center">Login form — WB-006 (stub)</p>
        <p class="text-center text-slate-400 text-sm">
          No account? <a routerLink="/register" class="text-blue-400 hover:underline">Register</a>
        </p>
      </div>
    </section>
  `,
})
export class LoginComponent {}
