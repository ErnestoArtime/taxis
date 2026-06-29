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
    canMatch: [authGuard, roleGuard('driver')],
    loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage)
  },
  {
    path: 'rides/:id',
    canMatch: [authGuard, roleGuard('driver')],
    loadComponent: () => import('./features/rides/ride-detail.page').then((m) => m.RideDetailPage)
  }
];
