import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { SystemSessionService } from '../services/system-session.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SystemSessionService);
  const admin = session.adminSession();
  const impersonation = session.impersonationSession();

  let cloned: HttpRequest<unknown> | null = null;

  const isSystem = req.url.includes('/system/');
  const token = isSystem
    ? admin
    : impersonation ?? admin; // prefer impersonation for tenant-scoped calls; fall back to admin if available

  if (token) {
    cloned = req.clone({
      setHeaders: {
        Authorization: `${token.tokenType} ${token.accessToken}`,
      },
    });
  }

  // Correlation ID for observability
  const requestId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const withCorrelation = (cloned ?? req).clone({
    setHeaders: {
      'x-request-id': requestId,
    },
  });

  return next(withCorrelation);
};
