import { InjectionToken } from '@angular/core';

// Base path for backend APIs. Override by providing this token in app.config.ts if needed.
export const API_BASE = new InjectionToken<string>('API_BASE', {
  providedIn: 'root',
  factory: () => '/v1',
});
