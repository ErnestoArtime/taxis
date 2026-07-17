import { Routes } from '@angular/router';
import { authGuard, roleGuard } from '@taxi/auth';

export const appRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register.page').then((m) => m.RegisterPage)
  },
  {
    path: 'unauthorized',
    loadComponent: () => import('./features/unauthorized/unauthorized.page').then((m) => m.UnauthorizedPage)
  },
  {
    path: '',
    canMatch: [authGuard, roleGuard('customer')],
    loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage)
  },
  {
    path: 'booking/new',
    canMatch: [authGuard, roleGuard('customer')],
    loadComponent: () => import('./features/booking/new-booking.page').then((m) => m.NewBookingPage)
  },
  {
    path: 'rides/:id',
    canMatch: [authGuard, roleGuard('customer')],
    loadComponent: () => import('./features/rides/ride-tracking.page').then((m) => m.RideTrackingPage)
  }
];
