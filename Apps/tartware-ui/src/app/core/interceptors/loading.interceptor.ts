import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { LoadingService } from '../services/loading.service';

/**
 * Loading Interceptor
 * Automatically shows/hides loading indicator for HTTP requests
 *
 * Features:
 * - Shows loading bar for all HTTP requests
 * - Handles multiple concurrent requests
 * - Automatically hides when request completes (success or error)
 *
 * Reference: https://angular.dev/api/common/http/HttpInterceptorFn
 *
 * @example Register in app.config.ts
 * ```typescript
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideHttpClient(
 *       withInterceptors([authInterceptor, loadingInterceptor])
 *     )
 *   ]
 * };
 * ```
 */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);

  // Show loading indicator
  loadingService.show();

  // Pass request and hide loading when complete
  return next(req).pipe(
    finalize(() => {
      // Hide loading indicator after request completes
      loadingService.hide();
    })
  );
};
