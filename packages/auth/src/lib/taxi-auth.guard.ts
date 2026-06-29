import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { TaxiAuthService } from './taxi-auth.service';

export const authGuard: CanMatchFn = async () => {
  const auth = inject(TaxiAuthService);
  const router = inject(Router);

  await auth.ensureInitialized();
  const user = auth.userId;
  if (!user) {
    return router.createUrlTree(['/login']);
  }
  return true;
};

export const roleGuard = (...allowedRoles: string[]): CanMatchFn => {
  return async () => {
    const auth = inject(TaxiAuthService);
    const router = inject(Router);

    await auth.ensureInitialized();
    const role = auth.userRole;
    if (!role || !allowedRoles.includes(role)) {
      return router.createUrlTree(['/unauthorized']);
    }
    return true;
  };
};
