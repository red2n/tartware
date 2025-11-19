export interface AdminTenantMembership {
  tenant_id: string;
  tenant_name: string;
  role: string;
  is_active: boolean;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_verified: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at?: string;
  version: string;
  tenants?: AdminTenantMembership[];
}

export interface SystemTenantOverview {
  id: string;
  name: string;
  slug: string;
  status: string;
  type: string;
  active_properties: number;
  user_count: number;
  property_count: number;
  created_at: string;
  version: string;
}

export interface SystemAdminProfile {
  id: string;
  username: string;
  email: string;
  role: string;
  last_login_at?: string;
  is_active: boolean;
}

export interface SystemAdminLoginRequest {
  username: string;
  password: string;
  device_fingerprint: string;
  mfa_code?: string;
}

export interface SystemAdminLoginResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: 'SYSTEM_ADMIN';
  session_id: string;
  admin: SystemAdminProfile;
}

export interface SystemAdminTenantResponse {
  tenants: SystemTenantOverview[];
  count: number;
}

export interface SystemImpersonationRequest {
  tenant_id: string;
  user_id: string;
  reason: string;
  ticket_id: string;
}

export interface SystemImpersonationResponse {
  access_token: string;
  token_type: 'Bearer';
  scope: 'TENANT_IMPERSONATION';
  expires_in: number;
}
