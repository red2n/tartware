import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip adding x-user-id header for login endpoint (it doesn't need authentication)
  if (req.url.includes('/auth/login')) {
    return next(req);
  }

  const userId = localStorage.getItem('user_id');

  if (userId) {
    const clonedReq = req.clone({
      setHeaders: {
        'x-user-id': userId
      }
    });
    return next(clonedReq);
  }

  return next(req);
};
