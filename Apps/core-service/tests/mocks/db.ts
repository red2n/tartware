import { vi } from "vitest";
import type pg from "pg";

// Test data - realistic UUIDs and data
export const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
export const TEST_TENANT_ID = "660e8400-e29b-41d4-a716-446655440000";
export const TEST_GUEST_ID = "770e8400-e29b-41d4-a716-446655440000";
export const TEST_PROPERTY_ID = "880e8400-e29b-41d4-a716-446655440000";
export const TEST_USER_USERNAME = "testuser";
export const TEST_USER_PASSWORD_HASH =
  "$2a$10$U8wfbip4Pk1ReP6u.sHcuu/mV7Xz2xvkjGF1mR5lBeRHyW/t4qxza"; // hash for Password123!
let currentTestUserPasswordHash = TEST_USER_PASSWORD_HASH;

export const TEST_SYSTEM_ADMIN_ID = "990e8400-e29b-41d4-a716-446655440000";
export const TEST_SYSTEM_ADMIN_USERNAME = "sysadmin";
export const TEST_SYSTEM_ADMIN_PASSWORD = "SuperSecurePass123!";
export const TEST_SYSTEM_ADMIN_PASSWORD_HASH =
  "$2a$10$lVhoThJ5rSrAu9mz2kgXuew27BmgImztE2EXokYbtjgboPHgGwVKW";
const TEST_SYSTEM_ADMIN_MFA_SECRET = "KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD";

const DEFAULT_ALLOWED_HOURS = "[2000-01-01T00:00:00Z,2100-01-01T00:00:00Z)";

const systemAdminState: {
  failedAttempts: number;
  lockedUntil: Date | null;
  allowedHours: string | null;
  ipWhitelist: string[];
  trustedDevices: string[];
  mfaEnabled: boolean;
} = {
  failedAttempts: 0,
  lockedUntil: null as Date | null,
  allowedHours: DEFAULT_ALLOWED_HOURS,
  ipWhitelist: ["127.0.0.1/32", "::1/128"],
  trustedDevices: ["trusted-device"],
  mfaEnabled: true,
};

export const resetSystemAdminState = (): void => {
  systemAdminState.failedAttempts = 0;
  systemAdminState.lockedUntil = null;
  systemAdminState.allowedHours = DEFAULT_ALLOWED_HOURS;
  systemAdminState.ipWhitelist = ["127.0.0.1/32", "::1/128"];
  systemAdminState.trustedDevices = ["trusted-device"];
  systemAdminState.mfaEnabled = true;
};

export const configureSystemAdminMock = (options: {
  allowedHours?: string | null;
  ipWhitelist?: string[];
  trustedDevices?: string[];
  mfaEnabled?: boolean;
} = {}): void => {
  if (options.allowedHours !== undefined) {
    systemAdminState.allowedHours = options.allowedHours;
  }
  if (options.ipWhitelist) {
    systemAdminState.ipWhitelist = options.ipWhitelist;
  }
  if (options.trustedDevices) {
    systemAdminState.trustedDevices = options.trustedDevices;
  }
  if (options.mfaEnabled !== undefined) {
    systemAdminState.mfaEnabled = options.mfaEnabled;
  }
};

// Role-specific test users for negative testing
export const MANAGER_USER_ID = "550e8400-e29b-41d4-a716-446655440001";
export const STAFF_USER_ID = "550e8400-e29b-41d4-a716-446655440002";
export const VIEWER_USER_ID = "550e8400-e29b-41d4-a716-446655440003";
export const MODULE_DISABLED_USER_ID = "550e8400-e29b-41d4-a716-446655440004";

// Mock query function
export const query = vi.fn(async <T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> => {
  const sql = text.trim().toLowerCase();

  const buildSystemAdminRow = () => ({
    id: TEST_SYSTEM_ADMIN_ID,
    username: TEST_SYSTEM_ADMIN_USERNAME,
    email: "sysadmin@example.com",
    password_hash: TEST_SYSTEM_ADMIN_PASSWORD_HASH,
    role: "SYSTEM_ADMIN",
    mfa_secret: TEST_SYSTEM_ADMIN_MFA_SECRET,
    mfa_enabled: systemAdminState.mfaEnabled,
    ip_whitelist: systemAdminState.ipWhitelist,
    allowed_hours: systemAdminState.allowedHours,
    last_login_at: new Date("2024-01-01T00:00:00Z"),
    failed_login_attempts: systemAdminState.failedAttempts,
    account_locked_until: systemAdminState.lockedUntil,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    created_by: null,
    updated_by: null,
    metadata: { trusted_devices: systemAdminState.trustedDevices },
  });

  if (sql.includes("from public.system_administrators")) {
    const username = params?.[0];
    if (username === TEST_SYSTEM_ADMIN_USERNAME) {
      return {
        rows: [buildSystemAdminRow()] as unknown as T[],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      };
    }
    return {
      rows: [] as unknown as T[],
      rowCount: 0,
      command: "SELECT",
      oid: 0,
      fields: [],
    };
  }

  if (
    sql.startsWith("update public.system_administrators") &&
    sql.includes("failed_login_attempts = failed_login_attempts + 1")
  ) {
    systemAdminState.failedAttempts += 1;
    const maxAttempts = (params?.[1] as number) ?? 5;
    const lockMinutes = (params?.[2] as number) ?? 15;
    if (systemAdminState.failedAttempts >= maxAttempts) {
      systemAdminState.lockedUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
    }
    return {
      rows: [
        {
          failed_login_attempts: systemAdminState.failedAttempts,
          account_locked_until: systemAdminState.lockedUntil,
        },
      ] as unknown as T[],
      rowCount: 1,
      command: "UPDATE",
      oid: 0,
      fields: [],
    };
  }

  if (
    sql.startsWith("update public.system_administrators") &&
    sql.includes("set failed_login_attempts = 0")
  ) {
    systemAdminState.failedAttempts = 0;
    systemAdminState.lockedUntil = null;
    return {
      rows: [
        {
          last_login_at: new Date(),
        },
      ] as unknown as T[],
      rowCount: 1,
      command: "UPDATE",
      oid: 0,
      fields: [],
    };
  }

  if (sql.startsWith("insert into public.system_admin_audit_log")) {
    return {
      rows: [] as unknown as T[],
      rowCount: 1,
      command: "INSERT",
      oid: 0,
      fields: [],
    };
  }

  // Mock active memberships query (used by auth plugin)
  if (sql.includes("user_tenant_associations") && sql.includes("where uta.user_id")) {
    const userId = params?.[0];

    if (typeof userId === "string") {
      // Return role based on user ID
      if (userId === TEST_USER_ID) {
        return {
          rows: [
            {
              tenant_id: TEST_TENANT_ID,
              role: "ADMIN",
              is_active: true,
              permissions: {},
              tenant_name: "Test Tenant",
              modules: [
                "core",
                "finance-automation",
                "tenant-owner-portal",
                "facility-maintenance",
                "analytics-bi",
                "marketing-channel",
                "enterprise-api",
              ],
            },
          ] as unknown as T[],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        };
      }

      if (userId === MANAGER_USER_ID) {
        return {
          rows: [
            {
              tenant_id: TEST_TENANT_ID,
              role: "MANAGER",
              is_active: true,
              permissions: {},
              tenant_name: "Test Tenant",
              modules: ["core", "facility-maintenance"],
            },
          ] as unknown as T[],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        };
      }

      if (userId === STAFF_USER_ID) {
        return {
          rows: [
            {
              tenant_id: TEST_TENANT_ID,
              role: "STAFF",
              is_active: true,
              permissions: {},
              tenant_name: "Test Tenant",
              modules: ["core"],
            },
          ] as unknown as T[],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        };
      }

      if (userId === VIEWER_USER_ID) {
        return {
          rows: [
            {
              tenant_id: TEST_TENANT_ID,
              role: "VIEWER",
              is_active: true,
              permissions: {},
              tenant_name: "Test Tenant",
              modules: ["core"],
            },
          ] as unknown as T[],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        };
      }

      if (userId === MODULE_DISABLED_USER_ID) {
        return {
          rows: [
            {
              tenant_id: TEST_TENANT_ID,
              role: "ADMIN",
              is_active: true,
              permissions: {},
              tenant_name: "Test Tenant",
              modules: ["finance-automation"],
            },
          ] as unknown as T[],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        };
      }

      return {
        rows: [] as T[],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      };
    }
  }

  // Mock tenants list query (must come after membership queries)
  if (
    sql.includes("select") &&
    sql.includes("from public.tenants t") &&
    sql.includes("t.name")
  ) {
    if (sql.includes("where t.id !=")) {
      return {
        rows: [
          {
            id: "aa0e8400-e29b-41d4-a716-446655440000",
          },
        ] as unknown as T[],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      };
    }

    return {
      rows: [
        {
          id: TEST_TENANT_ID,
          name: "Test Tenant",
          slug: "test-tenant",
          type: "CHAIN", // Must match TenantTypeEnum
          status: "ACTIVE", // Must match TenantStatusEnum
          email: "tenant@example.com",
          phone: "+1234567890",
          website: "https://example.com",
          address_line1: "789 Business St",
          address_line2: null,
          city: "Boston",
          state: "MA",
          postal_code: "02101",
          country: "US",
          tax_id: "12-3456789",
          business_license: "BL123456",
          registration_number: "REG123456",
          // Match TenantConfigSchema
          config: {
            features: ["reservations", "payments", "housekeeping"],
            maxUsers: 10,
            maxProperties: 5,
            brandingEnabled: true,
            defaultCurrency: "USD",
            defaultLanguage: "en",
            defaultTimezone: "UTC",
            enableMultiProperty: true,
            enableChannelManager: false,
            enableLoyaltyProgram: false,
            enableAdvancedReporting: false,
            enablePaymentProcessing: true,
          },
          // Match TenantSubscriptionSchema
          subscription: {
            plan: "ENTERPRISE",
            amount: 999,
            currency: "USD",
            billingCycle: "MONTHLY",
            startDate: new Date("2024-01-01"),
          },
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
          created_by: null,
          updated_by: null,
          deleted_at: null,
          version: BigInt(1),
          property_count: 1,
          user_count: 5,
          active_properties: 1,
        },
      ] as unknown as T[],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    };
  }

  if (sql.includes("from public.user_tenant_associations uta") && sql.includes("distinct uta.user_id")) {
    if (sql.includes("uta.role = 'staff'")) {
      return {
        rows: [
          {
            user_id: STAFF_USER_ID,
            tenant_id: TEST_TENANT_ID,
          },
        ] as unknown as T[],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      };
    }

    if (sql.includes("uta.role = 'manager'")) {
      return {
        rows: [
          {
            user_id: MANAGER_USER_ID,
            tenant_id: TEST_TENANT_ID,
          },
        ] as unknown as T[],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      };
    }

    if (sql.includes("uta.role = 'viewer'")) {
      return {
        rows: [
          {
            user_id: VIEWER_USER_ID,
          },
        ] as unknown as T[],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      };
    }
  }


  if (
    sql.includes("from public.user_tenant_associations uta") &&
    sql.includes("coalesce(uta.is_deleted, false) = false") &&
    sql.includes("limit $5")
  ) {
    const tenantId = params?.[0];
    const userId = params?.[1];
    if (tenantId === TEST_TENANT_ID && userId === TEST_USER_ID) {
      return {
        rows: [
          {
            id: "ba0e8400-e29b-41d4-a716-446655440010",
            user_id: TEST_USER_ID,
            tenant_id: TEST_TENANT_ID,
            role: "ADMIN",
            is_active: true,
            permissions: {},
            valid_from: new Date(),
            valid_until: null,
            metadata: {},
            created_at: new Date(),
            updated_at: new Date(),
            created_by: null,
            updated_by: null,
            deleted_at: null,
            version: BigInt(1),
            user_username: "testuser",
            user_email: "user@example.com",
            user_first_name: "Test",
            user_last_name: "User",
            tenant_name: "Test Tenant",
            tenant_slug: "test-tenant",
            tenant_status: "ACTIVE",
          },
        ] as unknown as T[],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      };
    }
  }

  // Mock user-tenant associations list query
  if (sql.includes("user_tenant_associations") && sql.includes("select")) {
    const userId = params?.[0];
    if (userId === TEST_USER_ID) {
      return {
        rows: [
          {
            tenant_id: TEST_TENANT_ID,
            role: "ADMIN",
            is_active: true,
            permissions: {},
            tenant_name: "Test Tenant",
            user_id: TEST_USER_ID,
          },
        ] as unknown as T[],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      };
    }
  }

  // Mock guests query
  if (sql.includes("from public.guests")) {
    return {
      rows: [
        {
          id: TEST_GUEST_ID,
          tenant_id: TEST_TENANT_ID,
          first_name: "John",
          last_name: "Doe",
          middle_name: null,
          title: "Mr",
          date_of_birth: new Date("1990-01-01"),
          gender: "Male",
          nationality: "US",
          email: "john.doe@example.com",
          phone: "+1234567890",
          secondary_phone: null,
          address: { street: "123 Main St", city: "New York", state: "NY", postalCode: "10001", country: "USA" },
          id_type: "passport",
          id_number: "AB123456",
          passport_number: "AB123456",
          passport_expiry: new Date("2030-01-01"),
          company_name: null,
          company_tax_id: null,
          loyalty_tier: "Gold",
          loyalty_points: 1000,
          vip_status: false,
          preferences: { smoking: false, language: "en", dietaryRestrictions: [], specialRequests: [] },
          marketing_consent: true,
          communication_preferences: { email: true, sms: false, phone: true, post: false },
          total_bookings: 5,
          total_nights: 15,
          total_revenue: "5000.00",
          last_stay_date: new Date("2024-01-01"),
          is_blacklisted: false,
          blacklist_reason: null,
          notes: null,
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
          created_by: null,
          updated_by: null,
          deleted_at: null,
          version: BigInt(1),
        },
      ] as unknown as T[],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    };
  }

  // Mock properties query
  if (sql.includes("from public.properties")) {
    return {
      rows: [
        {
          id: TEST_PROPERTY_ID,
          tenant_id: TEST_TENANT_ID,
          property_code: "PROP001",
          property_name: "Test Property",
          property_type: "hotel",
          description: "A test property",
          address: { street: "456 Hotel Ave", city: "Miami", state: "FL", postalCode: "33101", country: "US" },
          timezone: "America/New_York",
          currency_code: "USD",
          phone: "+1234567890",
          email: "property@example.com",
          website: "https://example.com",
          total_rooms: 100,
          occupied_rooms: 50,
          available_rooms: 50,
          total_revenue: "100000.00",
          average_daily_rate: "150.00",
          occupancy_rate: "50.00",
          config: { defaultCurrency: "USD", allowOnlineBooking: true },
          integrations: { channelManager: { enabled: false } },
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
          created_by: null,
          updated_by: null,
          deleted_at: null,
          version: BigInt(1),
        },
      ] as unknown as T[],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    };
  }

  // Authentication user lookup
  if (sql.includes("password_hash") && sql.includes("from public.users")) {
    return {
      rows: [
        {
          id: TEST_USER_ID,
          username: TEST_USER_USERNAME,
          email: "test@example.com",
          first_name: "Test",
          last_name: "User",
          password_hash: currentTestUserPasswordHash,
          is_active: true,
        },
      ] as unknown as T[],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    };
  }

  if (sql.startsWith("update public.users set password_hash")) {
    currentTestUserPasswordHash = params?.[0] as string;
    return {
      rows: [] as T[],
      rowCount: 1,
      command: "UPDATE",
      oid: 0,
      fields: [],
    };
  }

  // Mock users query
  if (sql.includes("from public.users") || sql.includes("from users")) {
    return {
      rows: [
        {
          id: TEST_USER_ID,
          username: TEST_USER_USERNAME,
          email: "test@example.com",
          first_name: "Test",
          last_name: "User",
          phone: "+1234567890",
          avatar_url: null,
          is_active: true,
          is_verified: true,
          email_verified_at: new Date(),
          last_login_at: new Date(),
          preferences: {},
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
          created_by: null,
          updated_by: null,
          version: BigInt(1),
          tenants: [
            {
              tenant_id: TEST_TENANT_ID,
              tenant_name: "Test Tenant",
              role: "ADMIN",
              is_active: true,
            },
          ],
        },
      ] as unknown as T[],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    };
  }

  // Default empty result
  return {
    rows: [] as T[],
    rowCount: 0,
    command: "SELECT",
    oid: 0,
    fields: [],
  };
});

// Mock pool
export const pool = {
  query,
  connect: vi.fn(),
  end: vi.fn(),
  on: vi.fn(),
} as unknown as pg.Pool;
