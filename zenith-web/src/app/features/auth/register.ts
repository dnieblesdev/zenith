import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-register',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <div class="w-full max-w-sm space-y-6">
        <h1 class="text-2xl font-bold text-white text-center">Create Account</h1>
        <p class="text-slate-400 text-center">Register form — WB-006 (stub)</p>
        <p class="text-center text-slate-400 text-sm">
          Already registered? <a routerLink="/login" class="text-blue-400 hover:underline">Sign in</a>
        </p>
      </div>
    </section>
  `,
})
export class RegisterComponent {}
