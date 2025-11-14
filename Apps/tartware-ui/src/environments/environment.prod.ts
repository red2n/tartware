/**
 * Production environment configuration
 * This file is used for production builds
 */
export const environment = {
  production: true,
  apiUrl: 'https://api.tartware.com/v1',
  logsApiUrl: 'https://logs.tartware.com/v1',
  apiTimeout: 30000,
  logLevel: 'error',
  enableDevTools: false,
  enableDebugLogs: false,
};
