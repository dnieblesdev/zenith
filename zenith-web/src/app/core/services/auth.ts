import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface AuthUser {
  id: number;
  email: string;
  username: string;
  role: 'READER' | 'EDITOR' | 'ADMIN';
}

/**
 * Global authentication state service.
 * Integrates with Better Auth via the zenith-api session endpoint.
 * Browser-only initialization is guarded by PLATFORM_ID.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);

  /** Current authenticated user, null when logged out. */
  readonly user = signal<AuthUser | null>(null);

  /** JWT / session token used by the auth interceptor. */
  readonly token = signal<string | null>(null);

  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.restoreSession();
    }
  }

  /** Persist user + token after a successful login response. */
  setSession(user: AuthUser, token: string): void {
    this.user.set(user);
    this.token.set(token);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('auth_token', token);
    }
  }

  /** Clear all auth state (logout). */
  clearSession(): void {
    this.user.set(null);
    this.token.set(null);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('auth_token');
    }
  }

  private restoreSession(): void {
    const stored = localStorage.getItem('auth_token');
    if (stored) {
      // Token present — the interceptor will attach it to /api/auth/session
      // to validate and hydrate the user on first load.
      this.token.set(stored);
    }
  }
}
