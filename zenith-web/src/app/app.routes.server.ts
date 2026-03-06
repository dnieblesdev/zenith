import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Static routes — safe to prerender (no dynamic params)
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'login', renderMode: RenderMode.Prerender },
  { path: 'register', renderMode: RenderMode.Prerender },
  { path: 'novels', renderMode: RenderMode.Prerender },

  // Dynamic routes — render on each server request
  { path: 'novels/:slug', renderMode: RenderMode.Server },
  { path: 'novels/:slug/:chapter', renderMode: RenderMode.Server },
  { path: 'users/:username', renderMode: RenderMode.Server },

  // Protected route — render on client only (authGuard needs browser)
  { path: 'admin', renderMode: RenderMode.Client },

  // Fallback
  { path: '**', renderMode: RenderMode.Client },
];
