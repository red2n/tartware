export interface User {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role?: string;
}

export interface TenantMembership {
  tenant_id: string;
  tenant_name: string;
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER';
  is_active: boolean;
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
