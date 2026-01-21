import { InjectionToken } from '@angular/core';

// Base path for backend APIs. Override by providing this token in app.config.ts if needed.
const resolveApiBase = (): string => {
  if (typeof window === 'undefined') return '/v1';
  const { hostname, port, protocol } = window.location;
  if (hostname === 'localhost' && port === '4200') {
    return `${protocol}//${hostname}:3000/v1`;
  }
  return '/v1';
};

export const API_BASE = new InjectionToken<string>('API_BASE', {
  providedIn: 'root',
  factory: resolveApiBase,
});
