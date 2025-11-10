import type { TenantRole } from '@tartware/schemas';

export interface User {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role?: TenantRole;
}

export interface TenantMembership {
  tenant_id: string;
  tenant_name?: string;
  role: TenantRole;
  is_active: boolean;
  permissions?: Record<string, unknown>;
}

export interface AuthContext {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  memberships: TenantMembership[];
  authorized_tenants: string[];
}
