import type { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

/**
 * List of endpoints that don't require authentication
 */
const PUBLIC_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/forgot-password'];

/**
 * Authentication HTTP Interceptor
 * Automatically adds user authentication headers to HTTP requests
 * Handles 401 Unauthorized responses by redirecting to login
 *
 * @example
 * Usage is automatic when configured in app.config.ts:
 * ```typescript
 * provideHttpClient(withInterceptors([authInterceptor]))
 * ```
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  // Skip authentication for public endpoints
  if (PUBLIC_ENDPOINTS.some((endpoint) => req.url.includes(endpoint))) {
    return next(req);
  }

  // Get user ID from localStorage
  const userId = localStorage.getItem('user_id');

  // Clone request and add authentication header if user is logged in
  const authReq = userId
    ? req.clone({
        setHeaders: {
          'x-user-id': userId,
        },
      })
    : req;

  // Handle the request and catch authentication errors
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Handle 401 Unauthorized - session expired or invalid
      if (error.status === 401) {
        console.warn('Authentication failed. Redirecting to login.');

        // Clear stored authentication data
        localStorage.removeItem('user_id');
        localStorage.removeItem('auth_context');

        // Redirect to login page
        router.navigate(['/login'], {
          queryParams: { returnUrl: router.url, reason: 'session-expired' },
        });
      }

      return throwError(() => error);
    })
  );
};

/**
 * Loading interceptor to show/hide global loading indicator
 * Can be combined with authInterceptor
 *
 * @example
 * ```typescript
 * provideHttpClient(withInterceptors([authInterceptor, loadingInterceptor]))
 * ```
 */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  // Import LoadingService only if this interceptor is used
  // const loadingService = inject(LoadingService);
  // loadingService.show();

  return next(req);
  // .pipe(
  //   finalize(() => loadingService.hide())
  // );
};
