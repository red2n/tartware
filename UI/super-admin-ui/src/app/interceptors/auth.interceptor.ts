import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { SystemSessionService } from '../services/system-session.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SystemSessionService);
  const admin = session.adminSession();
  const impersonation = session.impersonationSession();

  let cloned: HttpRequest<unknown> | null = null;

  const isSystemEndpoint = req.url.includes('/system/');
  const isCommandDefinitions = req.url.includes('/commands/definitions');
  const isCommandExecute = req.url.includes('/commands/') && req.url.includes('/execute');

  if (isCommandExecute && !impersonation) {
    return throwError(() => new Error('Impersonation token required for command execution.'));
  }

  const token = isSystemEndpoint || isCommandDefinitions
    ? admin
    : isCommandExecute
      ? impersonation
      : impersonation ?? admin; // prefer impersonation for tenant-scoped calls; fall back to admin if available

  if (token) {
    cloned = req.clone({
      setHeaders: {
        Authorization: `${token.tokenType} ${token.accessToken}`,
      },
    });
  }

  // Correlation ID for observability
  // Note: Fallback using Date.now() and Math.random() is not cryptographically secure
  // but is acceptable for correlation IDs (non-security-critical identifiers)
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
