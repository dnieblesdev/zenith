import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth';

export const routes: Routes = [
  {
    // WB-001 — Home
    path: '',
    loadComponent: () =>
      import('./features/home/home').then((m) => m.HomeComponent),
  },
  {
    // WB-002 — Novel catalog
    path: 'novels',
    loadComponent: () =>
      import('./features/catalog/catalog').then((m) => m.CatalogComponent),
  },
  {
    // WB-003 — Novel detail
    path: 'novels/:slug',
    loadComponent: () =>
      import('./features/novel/novel').then((m) => m.NovelComponent),
  },
  {
    // WB-004 — Chapter reader
    path: 'novels/:slug/:chapter',
    loadComponent: () =>
      import('./features/reader/reader').then((m) => m.ReaderComponent),
  },
  {
    // WB-005 — User profile
    path: 'users/:username',
    loadComponent: () =>
      import('./features/profile/profile').then((m) => m.ProfileComponent),
  },
  {
    // WB-006 — Login
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login').then((m) => m.LoginComponent),
  },
  {
    // WB-006 — Register
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register').then((m) => m.RegisterComponent),
  },
  {
    // WB-007 — Admin panel (protected)
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/admin/admin').then((m) => m.AdminComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
