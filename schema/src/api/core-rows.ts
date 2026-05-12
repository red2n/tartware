/**
 * DEV DOC
 * Module: api/core-rows.ts
 * Purpose: Raw PostgreSQL row shapes for core-service / common system table results.
 * Ownership: Schema package
 */

// =====================================================
// FLOW APPROVAL ROW
// =====================================================

/** Raw row shape from flow_approvals table (universal gate bypass audit). */
export type FlowApprovalRow = {
  id: string;
  tenant_id: string;
  property_id: string | null;
  flow_name: string;
  gate_name: string;
  entity_type: string;
  entity_id: string;
  approved_by: string;
  role_at_approval: string;
  reason_code: string;
  reason_notes: string | null;
  approved_at: string | Date;
  expires_at: string | Date | null;
  created_at: string | Date;
  correlation_id: string | null;
};

// =====================================================
// TENANT ROW
// =====================================================

/** Raw row shape from tenants table. */
export type TenantRow = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  email: string;
  phone: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  tax_id: string | null;
  business_license: string | null;
  registration_number: string | null;
  config: Record<string, unknown>;
  subscription: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  created_at: string | Date;
  updated_at: string | Date | null;
  created_by: string | null;
  updated_by: string | null;
  is_deleted: boolean | null;
  deleted_at: string | Date | null;
  deleted_by: string | null;
  version: string | number | bigint | null;
  property_count: number | string | null;
  user_count: number | string | null;
  active_properties: number | string | null;
};

// =====================================================
// PROPERTY ROW
// =====================================================

/** Raw row shape from properties table. */
export type PropertyRow = {
  id: string;
  tenant_id: string;
  property_name: string;
  property_code: string;
  address: Record<string, unknown>;
  phone: string | null;
  email: string | null;
  website: string | null;
  property_type: string | null;
  star_rating: number | string | null;
  total_rooms: number | string | null;
  tax_id: string | null;
  license_number: string | null;
  currency: string | null;
  timezone: string | null;
  default_language: string | null;
  config: Record<string, unknown>;
  integrations: Record<string, unknown>;
  is_active: boolean | null;
  metadata: Record<string, unknown> | null;
  created_at: string | Date;
  updated_at: string | Date | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | Date | null;
  version: string | number | bigint | null;
};

// =====================================================
// UI PREFERENCES ROW
// =====================================================

/** Raw row shape from user_ui_preferences table. */
export type UiPreferencesRow = {
  preference_id: string;
  tenant_id: string;
  user_id: string;
  theme: string | null;
  language: string | null;
  timezone: string | null;
  date_format: string | null;
  time_format: string | null;
  currency_display: string | null;
  home_page: string | null;
  home_page_dashboard_layout: Record<string, unknown>[] | null;
  default_page_size: number | string | null;
  default_sort_field: string | null;
  default_sort_direction: string | null;
  notification_sound_enabled: boolean | null;
  notification_desktop_enabled: boolean | null;
  notification_email_digest: string | null;
  pinned_reports: Record<string, unknown>[] | null;
  recent_searches: Record<string, unknown>[] | null;
  favorite_properties: string[] | null;
  profile_display_fields: string[] | null;
  profile_history_display: string | null;
  default_profile_tab: string | null;
  created_at: string | Date;
  updated_at: string | Date | null;
};

// =====================================================
// SYSTEM ADMINISTRATOR ROW
// =====================================================

/** Raw row shape from system_administrators table. */
export type SystemAdministratorRow = {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: string; // Cast to SystemAdminRole in service if needed
  mfa_secret: string | null;
  mfa_enabled: boolean;
  ip_whitelist: string[] | null;
  allowed_hours: string | null;
  last_login_at: string | Date | null;
  failed_login_attempts: number;
  account_locked_until: string | Date | null;
  is_active: boolean;
  created_at: string | Date;
  updated_at: string | Date | null;
  created_by: string | null;
  updated_by: string | null;
  metadata: Record<string, unknown> | null;
};

// =====================================================
// BREAK GLASS CODE ROW
// =====================================================

/** Raw row shape from break_glass_codes table. */
export type BreakGlassCodeRow = {
  id: string;
  code_hash: string;
  expires_at: string | Date | null;
  used_at: string | Date | null;
  created_at: string | Date;
};

// =====================================================
// USER TABLE
// =====================================================

/** Row shape for tenant list nested in UserRow. */
export type UserTenantEntryRow = {
  tenant_id: string;
  tenant_name: string | null;
  role: string;
  is_active: boolean | null;
};

/** Row shape from users table queries. */
export type UserRow = {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean | null;
  is_verified: boolean | null;
  email_verified_at: string | Date | null;
  last_login_at: string | Date | null;
  preferences: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string | Date;
  updated_at: string | Date | null;
  created_by: string | null;
  updated_by: string | null;
  version: string | number | bigint | null;
  tenants: UserTenantEntryRow[] | null;
};

// =====================================================
// USER_TENANT_ASSOCIATION TABLE
// =====================================================

/** Row shape from user_tenant_associations table queries. */
export type UserTenantAssociationRow = {
  id: string;
  user_id: string;
  tenant_id: string;
  role: string;
  is_active: boolean;
  permissions: Record<string, unknown> | null;
  valid_from: string | Date | null;
  valid_until: string | Date | null;
  metadata: Record<string, unknown> | null;
  created_at: string | Date;
  updated_at: string | Date | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | Date | null;
  version: string | number | bigint | null;
  user_username: string | null;
  user_email: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
  tenant_name: string | null;
  tenant_slug: string | null;
  tenant_status: string | null;
};
