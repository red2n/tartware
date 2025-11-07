import { vi } from "vitest";
import type pg from "pg";

// Test data - realistic UUIDs and data
export const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
export const TEST_TENANT_ID = "660e8400-e29b-41d4-a716-446655440000";
export const TEST_GUEST_ID = "770e8400-e29b-41d4-a716-446655440000";
export const TEST_PROPERTY_ID = "880e8400-e29b-41d4-a716-446655440000";

// Role-specific test users for negative testing
export const MANAGER_USER_ID = "550e8400-e29b-41d4-a716-446655440001";
export const STAFF_USER_ID = "550e8400-e29b-41d4-a716-446655440002";
export const VIEWER_USER_ID = "550e8400-e29b-41d4-a716-446655440003";

// Mock query function
export const query = vi.fn(async <T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> => {
  const sql = text.trim().toLowerCase();

  // Mock tenants list query (must come before user-tenant-associations)
  if (sql.includes("from public.tenants t") || (sql.includes("select") && sql.includes("t.name") && sql.includes("t.slug"))) {
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
            features: ['reservations', 'payments', 'housekeeping'],
            maxUsers: 10,
            maxProperties: 5,
            brandingEnabled: true,
            defaultCurrency: 'USD',
            defaultLanguage: 'en',
            defaultTimezone: 'UTC',
            enableMultiProperty: true,
            enableChannelManager: false,
            enableLoyaltyProgram: false,
            enableAdvancedReporting: false,
            enablePaymentProcessing: true,
          },
          // Match TenantSubscriptionSchema
          subscription: {
            plan: 'ENTERPRISE',
            amount: 999,
            currency: 'USD',
            billingCycle: 'MONTHLY',
            startDate: new Date('2024-01-01'),
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

  // Mock active memberships query (used by auth plugin)
  if (sql.includes("user_tenant_associations") && sql.includes("where uta.user_id")) {
    const userId = params?.[0];

    // Return role based on user ID
    if (userId === TEST_USER_ID) {
      return {
        rows: [
          {
            tenant_id: TEST_TENANT_ID,
            role: "ADMIN",
            is_active: true,
            permissions: {},
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
          nationality: "USA",
          email: "john.doe@example.com",
          phone: "+1234567890",
          secondary_phone: null,
          address: { street: "123 Main St", city: "New York", state: "NY", postalCode: "10001", country: "USA" },
          id_type: "PASSPORT",
          id_number: "AB123456",
          passport_number: "AB123456",
          passport_expiry: new Date("2030-01-01"),
          company_name: null,
          company_tax_id: null,
          loyalty_tier: "GOLD",
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
          property_type: "HOTEL",
          description: "A test property",
          address: { street: "456 Hotel Ave", city: "Miami", state: "FL", postalCode: "33101", country: "USA" },
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

  // Mock users query
  if (sql.includes("from public.users") || sql.includes("from users")) {
    return {
      rows: [
        {
          id: TEST_USER_ID,
          username: "testuser",
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
          tenants: [],
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
