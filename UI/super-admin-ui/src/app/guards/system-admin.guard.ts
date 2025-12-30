import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { SystemSessionService } from '../services/system-session.service';

export const systemAdminGuard: CanActivateFn = () => {
  const session = inject(SystemSessionService);
  const router = inject(Router);

  if (session.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
