/**
 * Development environment configuration
 * This file is used for local development
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/v1',
  logsApiUrl: 'http://localhost:3100/v1',
  apiTimeout: 30000,
  logLevel: 'debug',
  enableDevTools: true,
  enableDebugLogs: true,
  prefillCredentials: {
    username: 'bootstrap_admin',
    password: 't2S=<dG3iq%)!Nb_ynHfKv9p!',
  },
};
