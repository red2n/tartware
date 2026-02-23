import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  // Check if access_token exists (session might still be valid)
  if (localStorage.getItem('access_token')) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
