process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.PORT = process.env.PORT ?? "3100";
process.env.HOST = process.env.HOST ?? "127.0.0.1";
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "silent";
process.env.LOG_PRETTY = process.env.LOG_PRETTY ?? "false";
process.env.LOG_REQUESTS = process.env.LOG_REQUESTS ?? "false";
process.env.SERVICE_NAME = process.env.SERVICE_NAME ?? "@tartware/settings-service";
process.env.SERVICE_VERSION = process.env.SERVICE_VERSION ?? "test";
process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? "test-audience";
process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? "https://auth.tartware.test";
process.env.JWT_PUBLIC_KEY =
  process.env.JWT_PUBLIC_KEY ??
  [
    "-----BEGIN PUBLIC KEY-----",
    "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsbvKxEvhpFMMz9Yx8RJW",
    "yt30YIOCQM7DDDeWGPAHDq6vH+xr3aMcMBXNIN1qNbfXDnpa9eKJeNEqXWiwxup6",
    "JzpuG1HsfrN7kYMva9n32CuWHa3gwxObn2ymlk/wEYBLETymFcpnSUsctNkYheAQ",
    "Ez+KJ0C5EvhczHxVh9Yx8RJW+dGf1/MEZh9rqx8pFazc2DSES0finBmMOPqlmkav",
    "Ku0kUQeFkC6q/i323iDL49myIIZeF1P0uohsEiL41Z8nfdXbra+XUl3Bd6mV9Ezg",
    "Q8VE3d2rYZRk5v0zzakDx4zY/boYYGr2susx1bwyodH4qzM7gc3KJ2YMBX1IzBgE",
    "QwIDAQAB",
    "-----END PUBLIC KEY-----",
  ].join("\\n");
process.env.DB_HOST = process.env.DB_HOST ?? "127.0.0.1";
process.env.DB_PORT = process.env.DB_PORT ?? "5432";
process.env.DB_NAME = process.env.DB_NAME ?? "tartware";
process.env.DB_USER = process.env.DB_USER ?? "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? "postgres";
process.env.DB_SSL = process.env.DB_SSL ?? "false";
process.env.DB_POOL_MAX = process.env.DB_POOL_MAX ?? "5";
process.env.DB_POOL_IDLE_TIMEOUT_MS = process.env.DB_POOL_IDLE_TIMEOUT_MS ?? "1000";
process.env.SERVICE_NAME = process.env.SERVICE_NAME ?? "settings-service";
process.env.SERVICE_VERSION = process.env.SERVICE_VERSION ?? "test";
