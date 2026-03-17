import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Static routes — SSR (workaround: Prerender + zoneless causes NG0401 in Angular 19.2.x)
  { path: '', renderMode: RenderMode.Server },
  { path: 'login', renderMode: RenderMode.Server },
  { path: 'register', renderMode: RenderMode.Server },
  { path: 'novels', renderMode: RenderMode.Server },

  // Dynamic routes — render on each server request
  { path: 'novels/:id', renderMode: RenderMode.Server },
  { path: 'novels/:id/:chapterId', renderMode: RenderMode.Server },
  { path: 'users/:username', renderMode: RenderMode.Server },

  // Protected route — render on client only (authGuard needs browser)
  { path: 'admin', renderMode: RenderMode.Client },

  // Fallback
  { path: '**', renderMode: RenderMode.Client },
];
