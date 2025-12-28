export type AuthScope = string | string[];

export type AuthUser = {
  sub: string;
  tenantId: string;
  scope?: AuthScope;
  permissions?: Record<string, unknown>;
  [key: string]: unknown;
};
