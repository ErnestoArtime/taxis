import { Routes } from '@angular/router';
import { authGuard, roleGuard } from '@taxi/auth';

export const appRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage)
  },
  {
    path: 'unauthorized',
    loadComponent: () => import('./features/unauthorized/unauthorized.page').then((m) => m.UnauthorizedPage)
  },
  {
    path: '',
    canMatch: [authGuard, roleGuard('tenant_admin', 'platform_admin')],
    loadComponent: () => import('./features/operations/operations.page').then((m) => m.OperationsPage)
  },
  {
    path: 'dispatch',
    canMatch: [authGuard, roleGuard('tenant_admin', 'platform_admin')],
    loadComponent: () => import('./features/dispatch/dispatch.page').then((m) => m.DispatchPage)
  },
  {
    path: 'pricing',
    canMatch: [authGuard, roleGuard('tenant_admin', 'platform_admin')],
    loadComponent: () => import('./features/pricing/pricing.page').then((m) => m.PricingPage)
  },
  {
    path: 'settings',
    canMatch: [authGuard, roleGuard('tenant_admin', 'platform_admin')],
    loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage)
  }
];
