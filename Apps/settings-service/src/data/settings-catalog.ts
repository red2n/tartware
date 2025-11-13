import { createHash } from "node:crypto";

import type {
  SettingsCategory,
  SettingsDefinition,
  SettingsOption,
  SettingsScope,
  SettingsSection,
} from "@tartware/schemas";
import {
  SettingsControlTypeEnum,
  SettingsDataTypeEnum,
  SettingsScopeEnum,
  SettingsSensitivityEnum,
} from "@tartware/schemas";

const BASE_TIMESTAMP = new Date("2025-11-12T00:00:00Z");
const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";
const UUID_NAMESPACE = "4f19b8a1-1132-4ffc-8a10-b5f51a9f90d1";

type RawDefinition = {
  code: string;
  name: string;
  description: string;
  controlType: keyof typeof SettingsControlTypeEnum.enum;
  dataType: keyof typeof SettingsDataTypeEnum.enum;
  defaultScope: keyof typeof SettingsScopeEnum.enum;
  allowedScopes: Array<keyof typeof SettingsScopeEnum.enum>;
  overrideScopes?: Array<keyof typeof SettingsScopeEnum.enum>;
  defaultValue?: unknown;
  valueConstraints?: Record<string, unknown>;
  formSchema?: Record<string, unknown>;
  tags?: string[];
  moduleDependencies?: string[];
  referenceDocs?: string[];
  sensitivity?: keyof typeof SettingsSensitivityEnum.enum;
  options?: Array<{
    value: string;
    label: string;
    description?: string;
    icon?: string;
    color?: string;
    isDefault?: boolean;
  }>;
};

type RawSection = {
  code: string;
  name: string;
  description: string;
  icon?: string;
  tags?: string[];
  definitions: RawDefinition[];
};

type RawCategory = {
  code: string;
  name: string;
  description: string;
  icon: string;
  color?: string;
  tags?: string[];
  sections: RawSection[];
};

const rawCatalog: RawCategory[] = [
  {
    code: "ADMIN_USER_MANAGEMENT",
    name: "Admin & User Management",
    description: "Consolidated RBAC, permissions, multi-tenant governance, and audit controls.",
    icon: "admin_panel_settings",
    color: "indigo",
    tags: ["security", "governance"],
    sections: [
      {
        code: "ROLE_BASED_ACCESS_CONTROL",
        name: "Role-Based Access Control (RBAC)",
        description:
          "Define roles (e.g., Super Admin, Property Manager, Front Desk, Maintenance, Auditors); custom role creation with granular permissions (CRUD operations, module access).",
        icon: "security",
        tags: ["security", "rbac"],
        definitions: [
          {
            code: "ADMIN.RBAC.MATRIX",
            name: "Role Catalog & Permission Matrix",
            description:
              "Configures the global role catalog, inheritance, and permission bundles available to a tenant.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT", "TENANT_TEMPLATE"],
            overrideScopes: ["PROPERTY"],
            defaultValue: {
              roles: [
                {
                  id: "SUPER_ADMIN",
                  name: "Super Admin",
                  inherits: [],
                  permissions: ["*"],
                },
                {
                  id: "PROPERTY_MANAGER",
                  name: "Property Manager",
                  inherits: ["BASE_STAFF"],
                  permissions: [
                    "properties.manage",
                    "reservations.manage",
                    "rates.publish",
                    "housekeeping.dispatch",
                  ],
                },
                {
                  id: "FRONT_DESK",
                  name: "Front Desk",
                  inherits: ["BASE_STAFF"],
                  permissions: ["reservations.create", "reservations.check_in", "payments.collect"],
                },
                {
                  id: "MAINTENANCE",
                  name: "Maintenance",
                  inherits: ["BASE_STAFF"],
                  permissions: ["workorders.view", "workorders.update_status", "inventory.read"],
                },
              ],
              permissionNamespaces: [
                "reservations",
                "rates",
                "housekeeping",
                "reporting",
                "configuration",
              ],
              allowCustomRoles: true,
              requireApprovalsForCriticalChanges: true,
            },
            valueConstraints: {
              minRoles: 1,
              maxRoles: 64,
              permissionPattern: "^[a-z_.]+$",
            },
            formSchema: {
              type: "rbacMatrix",
              fields: [
                {
                  key: "roles",
                  type: "roleRepeater",
                  label: "Roles",
                  minItems: 1,
                },
              ],
              allowCustomInheritance: true,
            },
            tags: ["security", "rbac"],
            moduleDependencies: ["core-platform"],
            referenceDocs: ["https://docs.tartware.com/settings/admin/rbac"],
            sensitivity: "INTERNAL",
          },
        ],
      },
      {
        code: "USER_PERMISSION_GRANULARITY",
        name: "User Permission Granularity",
        description:
          "Module/feature/data-level restrictions; financial thresholds; MFA enforcement; password policies (complexity, expiration); session timeouts; IP whitelisting; login lockouts.",
        icon: "fingerprint",
        tags: ["security", "compliance-gdpr"],
        definitions: [
          {
            code: "ADMIN.PERMISSIONS.POLICIES",
            name: "User Security & Permission Policies",
            description:
              "Controls per-user security requirements, access thresholds, and contextual restrictions.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT", "USER"],
            overrideScopes: ["USER"],
            defaultValue: {
              passwordPolicy: {
                minLength: 12,
                requireUppercase: true,
                requireLowercase: true,
                requireNumber: true,
                requireSymbol: true,
                expirationDays: 90,
              },
              mfa: {
                requiredRoles: ["SUPER_ADMIN", "PROPERTY_MANAGER"],
                optionalRoles: ["FRONT_DESK"],
                enforceDeviceBinding: true,
              },
              sessionTimeoutMinutes: 30,
              ipRestrictions: {
                enabled: false,
                permittedRanges: [],
              },
              financialThresholds: {
                approvalRequiredAbove: 1000,
                overrideLimit: 2500,
              },
            },
            valueConstraints: {
              passwordMinLength: 8,
              passwordMaxLength: 128,
              maxSessionTimeoutMinutes: 480,
            },
            formSchema: {
              type: "securityPolicies",
              sections: [
                {
                  key: "passwordPolicy",
                  label: "Password Policy",
                  fields: [
                    { key: "minLength", type: "number", min: 8, max: 128 },
                    { key: "requireUppercase", type: "toggle" },
                    { key: "requireNumber", type: "toggle" },
                    { key: "requireSymbol", type: "toggle" },
                    { key: "expirationDays", type: "number", min: 0, max: 365 },
                  ],
                },
                {
                  key: "mfa",
                  label: "Multi-factor Authentication",
                  fields: [
                    { key: "requiredRoles", type: "chips" },
                    { key: "enforceDeviceBinding", type: "toggle" },
                  ],
                },
              ],
            },
            tags: ["security", "compliance-gdpr", "compliance-pcidss"],
            moduleDependencies: ["core-platform"],
            referenceDocs: ["https://docs.tartware.com/settings/admin/security"],
            sensitivity: "SENSITIVE",
          },
        ],
      },
      {
        code: "MULTI_TENANT_ARCHITECTURE",
        name: "Multi-Tenant Architecture",
        description:
          "Tenant isolation; cross-tenant sharing; branding customization; property hierarchies; centralized vs. decentralized modes.",
        icon: "hub",
        tags: ["architecture", "multi-tenant"],
        definitions: [
          {
            code: "ADMIN.MULTI_TENANT.MODE",
            name: "Tenant Operating Model",
            description:
              "Defines the tenant's operating model, branding strategy, and property hierarchy behavior.",
            controlType: "MULTI_SELECT",
            dataType: "MULTI_ENUM",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT"],
            defaultValue: ["CENTRALIZED_DASHBOARD", "TENANT_ISOLATION"],
            valueConstraints: {
              minSelected: 1,
              maxSelected: 3,
            },
            formSchema: {
              type: "choiceList",
              selectionMode: "multiple",
              groupBy: "category",
            },
            options: [
              {
                value: "CENTRALIZED_DASHBOARD",
                label: "Centralized Dashboard",
                description: "Operate all properties from a unified control plane.",
                icon: "dashboard",
                isDefault: true,
              },
              {
                value: "DECENTRALIZED_MODE",
                label: "Decentralized Mode",
                description: "Allow properties to operate with localized autonomy.",
                icon: "domain",
              },
              {
                value: "BRANDING_VARIATIONS",
                label: "Branding Variations",
                description: "Support property-level branding overrides.",
                icon: "palette",
              },
              {
                value: "CROSS_TENANT_SHARING",
                label: "Cross-tenant Sharing",
                description: "Enable data and asset sharing across affiliated tenants.",
                icon: "sync_alt",
              },
            ],
            tags: ["architecture", "branding"],
            moduleDependencies: ["core-platform"],
            referenceDocs: ["https://docs.tartware.com/settings/admin/multi-tenant"],
            sensitivity: "INTERNAL",
          },
        ],
      },
      {
        code: "AUDIT_AND_MONITORING",
        name: "Audit and Monitoring",
        description: "Activity logs; change trails; real-time threat detection; anomaly alerts.",
        icon: "history",
        tags: ["security", "observability"],
        definitions: [
          {
            code: "ADMIN.AUDIT.POLICY",
            name: "Audit Trail & Monitoring Policy",
            description:
              "Controls audit log retention, anomaly detection thresholds, and notification routing.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT"],
            defaultValue: {
              retentionDays: 365,
              exportSchedule: "WEEKLY",
              anomalyDetection: {
                enabled: true,
                threshold: 5,
                alertChannels: ["EMAIL", "WEBHOOK"],
              },
              monitoredEvents: [
                "LOGIN_FAILURE",
                "PERMISSION_CHANGE",
                "RATE_OVERRIDE",
                "PAYMENT_REFUND",
              ],
            },
            valueConstraints: {
              retentionDays: { min: 30, max: 1825 },
              anomalyThresholdRange: [1, 20],
            },
            formSchema: {
              type: "auditPolicy",
              fields: [
                { key: "retentionDays", type: "number", min: 30, max: 1825 },
                { key: "anomalyDetection.enabled", type: "toggle" },
                { key: "anomalyDetection.threshold", type: "number", min: 1, max: 20 },
                { key: "monitoredEvents", type: "chips" },
              ],
            },
            tags: ["security", "observability", "compliance-gdpr"],
            moduleDependencies: ["telemetry"],
            referenceDocs: ["https://docs.tartware.com/settings/admin/audit"],
            sensitivity: "SENSITIVE",
          },
        ],
      },
    ],
  },
  {
    code: "PROPERTY_TENANT_PROFILE",
    name: "Property & Tenant Profiles",
    description:
      "Property master data, tenant/guest profiles, personalization, and compliance templates.",
    icon: "apartment",
    color: "teal",
    tags: ["profiles", "personalization"],
    sections: [
      {
        code: "PROPERTY_PROFILE",
        name: "Property Profile",
        description:
          "Name, code, type (hotel, residential, resort); address, geolocation; contact info; star rating; room count; check-in/out times; time zone; legal/tax IDs; operating hours.",
        icon: "location_city",
        definitions: [
          {
            code: "PROFILE.PROPERTY.MASTER",
            name: "Property Master Profile Template",
            description:
              "Defines the canonical property profile structure and mandatory attributes.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "PROPERTY",
            allowedScopes: ["TENANT", "PROPERTY"],
            defaultValue: {
              requiredFields: [
                "property_name",
                "property_code",
                "property_type",
                "time_zone",
                "check_in_time",
                "check_out_time",
              ],
              optionalFields: ["star_rating", "branding_theme", "social_media_links"],
              geo: { lat: null, lng: null },
              taxIdentification: {
                required: true,
                fields: ["registration_number", "tax_id"],
              },
            },
            tags: ["profiles", "operations"],
            moduleDependencies: ["core-platform"],
            referenceDocs: ["https://docs.tartware.com/settings/property/profile"],
          },
        ],
      },
      {
        code: "TENANT_GUEST_PROFILE_FIELDS",
        name: "Tenant/Guest Profile Fields",
        description:
          "Mandatory fields (contact, emergency, ID docs); custom fields (pets, vehicles, nationality); VIP status; history tracking.",
        icon: "contacts",
        definitions: [
          {
            code: "PROFILE.GUEST.FIELDS",
            name: "Guest Profile Field Catalog",
            description: "Configures base guest fields, custom attributes, and retention behavior.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT", "TENANT_TEMPLATE"],
            overrideScopes: ["USER"],
            defaultValue: {
              baseFields: ["first_name", "last_name", "email", "phone", "nationality"],
              customFields: [
                { key: "pet_preference", type: "select", options: ["NONE", "DOG", "CAT"] },
                { key: "vehicle_plate", type: "text" },
              ],
              retentionPolicyDays: 1095,
              highlightedFlags: ["VIP_STATUS", "LOYALTY_TIER"],
            },
            formSchema: {
              type: "fieldCatalog",
              fieldTypes: ["text", "date", "select", "boolean"],
              allowConditionalLogic: true,
            },
            tags: ["profiles", "personalization"],
            moduleDependencies: ["guest-experience"],
            referenceDocs: ["https://docs.tartware.com/settings/guest/profile-fields"],
          },
        ],
      },
      {
        code: "PREFERENCES_PERSONALIZATION",
        name: "Preferences & Personalization",
        description:
          "Room preferences; dietary/allergies; communication channels; special occasions; loyalty status.",
        icon: "favorite",
        definitions: [
          {
            code: "PROFILE.GUEST.PREFERENCES",
            name: "Guest Preference Library",
            description: "Stores available preference categories and personalization tokens.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT"],
            defaultValue: {
              categories: [
                {
                  key: "ROOM",
                  options: ["HIGH_FLOOR", "SEA_VIEW", "QUIET_WING", "ADJOINING"],
                },
                {
                  key: "DIET",
                  options: ["VEGAN", "GLUTEN_FREE", "HALAL", "KOSHER"],
                },
                {
                  key: "COMMUNICATION",
                  options: ["EMAIL", "SMS", "WHATSAPP", "PUSH"],
                },
              ],
              personalNotesLimit: 1000,
            },
            tags: ["personalization", "guest-experience"],
            moduleDependencies: ["guest-experience"],
            referenceDocs: ["https://docs.tartware.com/settings/guest/preferences"],
          },
        ],
      },
      {
        code: "COMPLIANCE_RULES",
        name: "Compliance Rules",
        description:
          "Fair housing; eviction notices; GDPR consents; data retention; tax exemptions by nationality/guest type.",
        icon: "gavel",
        definitions: [
          {
            code: "PROFILE.COMPLIANCE.RULES",
            name: "Profile Compliance & Retention",
            description:
              "Defines regulatory policies for data retention, consent capture, and disclosure workflows.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT"],
            defaultValue: {
              gdpr: {
                consentTypes: ["MARKETING", "THIRD_PARTY_SHARING"],
                autoExpireDays: 730,
              },
              fairHousing: {
                requireDisclosure: true,
                documentTemplates: ["notice_of_entry", "eviction_notice"],
              },
              retention: {
                activeTenantDays: 1825,
                inactiveTenantDays: 1095,
              },
            },
            tags: ["compliance-gdpr", "legal"],
            moduleDependencies: ["core-platform"],
            referenceDocs: ["https://docs.tartware.com/settings/compliance/profile"],
            sensitivity: "CONFIDENTIAL",
          },
        ],
      },
    ],
  },
  {
    code: "ROOM_UNIT_INVENTORY",
    name: "Room, Unit & Inventory",
    description:
      "Room types, unit features, availability controls, and turnover workflows for hospitality operations.",
    icon: "meeting_room",
    color: "cyan",
    tags: ["inventory", "rooms"],
    sections: [
      {
        code: "ROOM_TYPE_CONFIGURATION",
        name: "Room Type Configuration",
        description:
          "Codes/names (Deluxe, Suite); descriptions; occupancy max; base pricing; size; bed configs; groupings; virtual types.",
        icon: "layers",
        definitions: [
          {
            code: "INVENTORY.ROOM_TYPE.CATALOG",
            name: "Room Type Catalog Template",
            description:
              "Defines the master room type structure, occupancy thresholds, and derived type rules.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "PROPERTY",
            allowedScopes: ["TENANT", "PROPERTY"],
            defaultValue: {
              baseTypes: [
                {
                  code: "DLX",
                  name: "Deluxe Room",
                  maxOccupancy: 3,
                  bedConfigurations: ["KING", "TWIN"],
                  amenities: ["WIFI", "SMART_TV", "DESK"],
                  virtual: false,
                },
                {
                  code: "STE",
                  name: "Suite",
                  maxOccupancy: 4,
                  bedConfigurations: ["KING", "SOFABED"],
                  amenities: ["WIFI", "SMART_TV", "MINIBAR", "LOUNGE_ACCESS"],
                  virtual: false,
                },
                {
                  code: "STE-CLUB",
                  name: "Suite - Club Access",
                  parentCode: "STE",
                  virtual: true,
                  differentiators: ["CLUB_ACCESS"],
                },
              ],
              sizeUnits: "SQM",
              defaultAmenities: ["WIFI", "CLIMATE_CONTROL"],
            },
            tags: ["inventory", "rooms"],
            moduleDependencies: ["inventory-management"],
            referenceDocs: ["https://docs.tartware.com/settings/inventory/room-types"],
          },
        ],
      },
      {
        code: "INDIVIDUAL_ROOM_UNIT_MANAGEMENT",
        name: "Individual Room/Unit Management",
        description:
          "Numbers; floor; status (Clean, Dirty, OOO, Occupied); features (ADA, pet-friendly, connecting); amenities; maintenance history.",
        icon: "key",
        definitions: [
          {
            code: "INVENTORY.UNIT.PROFILE",
            name: "Unit Profile Configuration",
            description:
              "Defines the per-unit attribute schema, status transitions, and inspection requirements.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "UNIT",
            allowedScopes: ["PROPERTY", "UNIT"],
            defaultValue: {
              attributes: [
                { key: "floor", type: "number" },
                { key: "wing", type: "text" },
                { key: "ada_compliant", type: "boolean" },
                { key: "connecting_units", type: "multi-select" },
                { key: "view_type", type: "select", options: ["CITY", "SEA", "GARDEN"] },
              ],
              statusWorkflow: ["DIRTY", "IN_PROGRESS", "CLEAN", "INSPECTED", "READY"],
              inspectionChecklistTemplate: ["SMOKE_DETECTOR", "MINIBAR", "LINEN"],
            },
            tags: ["operations", "housekeeping"],
            moduleDependencies: ["operations"],
            referenceDocs: ["https://docs.tartware.com/settings/inventory/unit-management"],
          },
        ],
      },
      {
        code: "INVENTORY_AND_AVAILABILITY",
        name: "Inventory and Availability",
        description:
          "Allotments by type; overbooking limits; stop-sales; min/max LOS; CTA/CTD; upgrade allowances.",
        icon: "event_available",
        definitions: [
          {
            code: "INVENTORY.AVAILABILITY.RULES",
            name: "Inventory Availability Rules",
            description:
              "Controls allotments, overbooking policies, and availability restrictions per property.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "PROPERTY",
            allowedScopes: ["PROPERTY"],
            defaultValue: {
              defaultRestrictions: {
                minLengthOfStay: 1,
                maxLengthOfStay: 14,
                closeToArrival: [],
                closeToDeparture: [],
              },
              overbookingPolicy: {
                allowOverbooking: true,
                maxOverbookPercent: 5,
                autoReleaseHoursBeforeArrival: 24,
              },
              upgradePaths: [{ from: "DLX", to: "STE", conditions: ["OCCUPANCY_BELOW_70"] }],
            },
            tags: ["inventory", "yield"],
            moduleDependencies: ["distribution"],
            referenceDocs: ["https://docs.tartware.com/settings/inventory/availability"],
          },
        ],
      },
      {
        code: "TURNOVER_AND_FEATURES",
        name: "Turnover and Features",
        description:
          "Checklists for move-in/out; utility allocations; historical occupancy; custom tags.",
        icon: "playlist_add_check",
        definitions: [
          {
            code: "INVENTORY.TURNOVER.CHECKLISTS",
            name: "Turnover Checklist Templates",
            description:
              "Configures move-in/out checklists, utility handoffs, and tagging conventions.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "UNIT",
            allowedScopes: ["PROPERTY", "UNIT"],
            defaultValue: {
              moveIn: ["INSPECT_SMOKE_ALARMS", "CAPTURE_METER_READING", "PHOTOS"],
              moveOut: ["RETRIEVE_KEYS", "INSPECT_DAMAGE", "FINAL_METER_READ"],
              customTags: ["PET_FRIENDLY", "VIP_UNIT", "ACCESSIBLE"],
            },
            tags: ["operations", "turnover"],
            moduleDependencies: ["operations"],
            referenceDocs: ["https://docs.tartware.com/settings/inventory/turnover"],
          },
        ],
      },
    ],
  },
  {
    code: "RATE_PRICING_FINANCIAL",
    name: "Rate, Pricing & Financial",
    description:
      "Dynamic pricing strategies, restrictions, taxation, billing, and payment gateway configuration.",
    icon: "request_quote",
    color: "amber",
    tags: ["revenue", "finance"],
    sections: [
      {
        code: "RATE_PLANS_STRUCTURE",
        name: "Rate Plans Structure",
        description:
          "Base/BAR; seasonal; packages; negotiated/corporate; dynamic adjustments (demand/occupancy-based); derived rates.",
        icon: "price_change",
        definitions: [
          {
            code: "FINANCE.RATES.PLAN_MATRIX",
            name: "Rate Plan Matrix",
            description:
              "Configures base rates, derived rate formulas, and seasonal strategy bundles.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "PROPERTY",
            allowedScopes: ["TENANT", "PROPERTY"],
            defaultValue: {
              basePlans: [
                { code: "BAR", type: "DYNAMIC", strategy: "DEMAND_BASED" },
                { code: "CORP", type: "NEGOTIATED", strategy: "CONTRACTED" },
              ],
              derivedPlans: [
                { code: "ADV7", base: "BAR", adjustment: "-10%", conditions: ["BOOKING_LEAD>=7"] },
              ],
              seasonalRamps: [
                { season: "PEAK", upliftPercent: 20 },
                { season: "LOW", decreasePercent: 15 },
              ],
            },
            tags: ["revenue"],
            moduleDependencies: ["revenue-management"],
            referenceDocs: ["https://docs.tartware.com/settings/rates/structure"],
          },
        ],
      },
      {
        code: "RATE_RESTRICTIONS_MEALS",
        name: "Rate Restrictions & Meals",
        description:
          "Min/max stay; advance booking; extra charges; blackout dates; meal plans; child surcharges.",
        icon: "restaurant_menu",
        definitions: [
          {
            code: "FINANCE.RATES.RESTRICTIONS",
            name: "Rate Restrictions Configuration",
            description:
              "Controls stay restrictions, meal plan inclusions, and surcharge calculations.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "PROPERTY",
            allowedScopes: ["PROPERTY"],
            defaultValue: {
              minStay: 1,
              maxStay: 21,
              advanceBookingDays: { min: 0, max: 365 },
              mealPlans: [
                { code: "RO", label: "Room Only", included: [] },
                { code: "BB", label: "Bed & Breakfast", included: ["BREAKFAST"] },
                { code: "AI", label: "All Inclusive", included: ["BREAKFAST", "LUNCH", "DINNER"] },
              ],
              childPolicy: {
                allowed: true,
                ageBands: [
                  { maxAge: 5, chargeType: "FREE" },
                  { maxAge: 12, chargeType: "PERCENT", value: 50 },
                ],
              },
            },
            tags: ["revenue", "guest-experience"],
            moduleDependencies: ["revenue-management"],
            referenceDocs: ["https://docs.tartware.com/settings/rates/restrictions"],
          },
        ],
      },
      {
        code: "TAX_CONFIGURATION",
        name: "Tax Configuration",
        description:
          "Types (VAT, occupancy); calculation methods (inclusive/exclusive); exemptions; application rules; reporting.",
        icon: "receipt_long",
        definitions: [
          {
            code: "FINANCE.TAX.MATRIX",
            name: "Tax Configuration Matrix",
            description:
              "Defines tax types, jurisdictions, and application logic for folios and invoices.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT"],
            defaultValue: {
              taxes: [
                { code: "VAT", type: "PERCENT", value: 18, inclusive: false },
                { code: "OCCUPANCY", type: "FIXED", value: 5, inclusive: false },
              ],
              exemptions: [{ nationality: "US", taxCodes: ["VAT"], requiresDocument: true }],
              rounding: { mode: "HALF_UP", decimals: 2 },
            },
            tags: ["finance", "compliance"],
            moduleDependencies: ["finance"],
            referenceDocs: ["https://docs.tartware.com/settings/finance/taxes"],
            sensitivity: "SENSITIVE",
          },
        ],
      },
      {
        code: "INVOICE_AND_BILLING",
        name: "Invoice & Billing",
        description:
          "Numbering; generation timing; layouts; folio splitting; multi-currency; credit notes.",
        icon: "article",
        definitions: [
          {
            code: "FINANCE.BILLING.POLICY",
            name: "Invoice & Billing Policy",
            description:
              "Controls invoice numbering schemes, folio behaviors, and document delivery.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT"],
            defaultValue: {
              numbering: { prefix: "INV-", sequenceLength: 6, reset: "ANNUAL" },
              folio: { allowSplit: true, maxSplits: 4 },
              currency: { primary: "USD", allowMultiCurrency: true },
              delivery: { email: true, portal: true },
            },
            tags: ["finance"],
            moduleDependencies: ["finance"],
            referenceDocs: ["https://docs.tartware.com/settings/finance/billing"],
          },
        ],
      },
      {
        code: "PAYMENT_GATEWAY",
        name: "Payment Gateway",
        description:
          "Processor integration; tokenization; 3D Secure; pre-auth; retries; refund rules; methods.",
        icon: "payments",
        definitions: [
          {
            code: "FINANCE.PAYMENTS.GATEWAY_PROFILE",
            name: "Payment Gateway Profile",
            description:
              "Configures payment processor credentials, tokenization policies, and retry strategies.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT"],
            defaultValue: {
              provider: "STRIPE",
              currency: "USD",
              tokenization: { enabled: true, provider: "STRIPE" },
              threeDSecure: { enabled: true, enforceOnHighRisk: true },
              retryPolicy: { attempts: 3, intervalMinutes: 15 },
              allowedMethods: ["CREDIT_CARD", "APPLE_PAY", "BANK_TRANSFER"],
            },
            tags: ["payments", "compliance-pcidss"],
            moduleDependencies: ["finance"],
            referenceDocs: ["https://docs.tartware.com/settings/finance/payment-gateway"],
            sensitivity: "CONFIDENTIAL",
          },
        ],
      },
    ],
  },
  {
    code: "APPROVAL_WORKFLOWS",
    name: "Approval Workflows",
    description:
      "Workflow definitions, revenue approvals, operational approvals, and audit tracking for escalations.",
    icon: "approval",
    color: "orange",
    tags: ["workflow", "governance"],
    sections: [
      {
        code: "WORKFLOW_DEFINITION",
        name: "Workflow Definition",
        description:
          "Sequential/parallel; multi-level chains; conditional routing; department-based; auto-approval thresholds.",
        icon: "schema",
        definitions: [
          {
            code: "WORKFLOW.DEFINITIONS.CATALOG",
            name: "Workflow Blueprint Catalog",
            description: "Defines reusable approval workflow templates with conditional routing.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT"],
            defaultValue: {
              templates: [
                {
                  code: "RATE_CHANGE",
                  type: "SEQUENTIAL",
                  levels: [
                    { role: "REVENUE_MANAGER", threshold: 0 },
                    { role: "DIRECTOR_OF_SALES", threshold: 10 },
                  ],
                },
                {
                  code: "CAPEX_APPROVAL",
                  type: "PARALLEL",
                  levels: [
                    { role: "FINANCE", threshold: 0 },
                    { role: "GENERAL_MANAGER", threshold: 0 },
                  ],
                },
              ],
              autoApproveBelow: 250,
            },
            tags: ["workflow"],
            moduleDependencies: ["operations"],
            referenceDocs: ["https://docs.tartware.com/settings/workflows/definition"],
          },
        ],
      },
      {
        code: "RATE_AND_DISCOUNT_APPROVALS",
        name: "Rate & Discount Approvals",
        description:
          "Variance thresholds (>15% discount); overrides for sold-out; cancellations; refunds; comp rooms.",
        icon: "percent",
        definitions: [
          {
            code: "WORKFLOW.RATES.APPROVALS",
            name: "Rate & Discount Approval Policy",
            description: "Controls escalation thresholds for rate overrides, discounts, and comps.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "PROPERTY",
            allowedScopes: ["PROPERTY"],
            defaultValue: {
              discountApprovalThresholds: [
                { percent: 10, approverRole: "REVENUE_MANAGER" },
                { percent: 20, approverRole: "GENERAL_MANAGER" },
              ],
              compNightsLimit: 2,
              refundPolicy: { requireApprovalAbove: 500, autoFlagReasons: ["FRAUD", "VIP"] },
            },
            tags: ["revenue", "workflow"],
            moduleDependencies: ["revenue-management"],
            referenceDocs: ["https://docs.tartware.com/settings/workflows/rate-approvals"],
          },
        ],
      },
      {
        code: "OPERATIONAL_APPROVALS",
        name: "Operational Approvals",
        description: "Work orders; purchases; expenses; budget variances; emergency overrides.",
        icon: "build",
        definitions: [
          {
            code: "WORKFLOW.OPERATIONS.APPROVALS",
            name: "Operational Approval Policy",
            description:
              "Defines approval cadence for work orders, purchasing, and emergency overrides.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "PROPERTY",
            allowedScopes: ["PROPERTY"],
            defaultValue: {
              workOrders: { autoApproveBelow: 200, escalationRole: "ENGINEERING_MANAGER" },
              purchaseOrders: { thresholds: [{ amount: 500, approver: "FINANCE" }] },
              emergencyOverride: { requireDualApproval: true, notifyRoles: ["SECURITY"] },
            },
            tags: ["operations", "workflow"],
            moduleDependencies: ["operations"],
            referenceDocs: ["https://docs.tartware.com/settings/workflows/operational"],
          },
        ],
      },
      {
        code: "TRACKING_AND_AUDIT",
        name: "Tracking & Audit",
        description:
          "History logs; pending dashboards; notifications; deadlines; escalation rules.",
        icon: "notifications_active",
        definitions: [
          {
            code: "WORKFLOW.AUDIT.TRACKING",
            name: "Workflow Tracking & Escalation Policy",
            description:
              "Governance for escalations, SLAs, and communication across approval workflows.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT"],
            defaultValue: {
              defaultSlaHours: 24,
              reminders: { intervalHours: 6, maxReminders: 3 },
              escalation: { afterHours: 48, escalateTo: ["GENERAL_MANAGER"] },
              dashboards: ["PENDING_APPROVALS", "SLA_BREACHES"],
            },
            tags: ["workflow", "observability"],
            moduleDependencies: ["operations"],
            referenceDocs: ["https://docs.tartware.com/settings/workflows/tracking"],
          },
        ],
      },
    ],
  },
  {
    code: "INTEGRATION_CHANNEL_MANAGEMENT",
    name: "Integration & Channel Management",
    description:
      "OTA mapping, API/webhook credentials, and channel prioritization for distribution strategy.",
    icon: "sync_alt",
    color: "blue",
    tags: ["integrations", "distribution"],
    sections: [
      {
        code: "OTA_CHANNEL_MANAGER",
        name: "OTA/Channel Manager",
        description:
          "API keys; mappings (rates, rooms); sync frequency; commissions; inventory allocation; parity; no-show reporting.",
        icon: "public",
        definitions: [
          {
            code: "INTEGRATIONS.OTA.PROFILE",
            name: "OTA Channel Profile",
            description: "Stores OTA credentials, mapping rules, and synchronization cadence.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "PROPERTY",
            allowedScopes: ["PROPERTY"],
            defaultValue: {
              defaultCommissionPercent: 18,
              syncFrequencyMinutes: 15,
              channels: [
                { code: "BOOKING", status: "ACTIVE", overbookingBufferPercent: 5 },
                { code: "EXPEDIA", status: "ACTIVE", overbookingBufferPercent: 3 },
              ],
              noShowPolicy: { autoReportHours: 12 },
            },
            tags: ["integrations", "distribution"],
            moduleDependencies: ["distribution"],
            referenceDocs: ["https://docs.tartware.com/settings/integrations/ota"],
          },
        ],
      },
      {
        code: "API_THIRD_PARTY",
        name: "API & Third-Party",
        description:
          "Endpoints; auth (OAuth); webhooks; intervals; integrations (accounting, CRM, RMS, POS).",
        icon: "cloud",
        definitions: [
          {
            code: "INTEGRATIONS.API.CATALOG",
            name: "Third-Party Integration Catalog",
            description:
              "Registers external integrations, credential storage, and webhook policies.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT"],
            defaultValue: {
              integrations: [
                { name: "NetSuite", type: "ACCOUNTING", auth: "OAUTH2", status: "ACTIVE" },
                { name: "Salesforce", type: "CRM", auth: "OAUTH2", status: "ACTIVE" },
              ],
              webhookDelivery: { retryAttempts: 5, retryIntervalSeconds: 60 },
            },
            tags: ["integrations"],
            moduleDependencies: ["integration-hub"],
            referenceDocs: ["https://docs.tartware.com/settings/integrations/api"],
            sensitivity: "CONFIDENTIAL",
          },
        ],
      },
      {
        code: "CHANNEL_PRIORITY",
        name: "Channel Priority",
        description:
          "Order; auto-stop triggers; overbooking buffers; min rates; blackout per channel.",
        icon: "stacked_bar_chart",
        definitions: [
          {
            code: "INTEGRATIONS.CHANNEL.PRIORITIES",
            name: "Channel Prioritization Matrix",
            description:
              "Controls distribution channel ordering, blackout windows, and guardrails.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "PROPERTY",
            allowedScopes: ["PROPERTY"],
            defaultValue: {
              priority: ["DIRECT", "LOYALTY", "BOOKING", "EXPEDIA"],
              minRateGuardrails: { OTA: 120, DIRECT: 100 },
              stopSellConditions: [{ channel: "BOOKING", occupancyPercent: 95 }],
            },
            tags: ["distribution", "revenue"],
            moduleDependencies: ["distribution"],
            referenceDocs: ["https://docs.tartware.com/settings/integrations/channel-priority"],
          },
        ],
      },
    ],
  },
  {
    code: "BOOKING_ENGINE_GUEST",
    name: "Booking Engine & Guest Management",
    description:
      "Controls for booking engine presentation, booking flow, loyalty program, and guest history tracking.",
    icon: "travel_explore",
    color: "purple",
    tags: ["guest-experience", "distribution"],
    sections: [
      {
        code: "BOOKING_ENGINE_DISPLAY",
        name: "Booking Engine Display",
        description: "Widget types; languages; date/currency formats; branding; search fields.",
        icon: "web_asset",
        definitions: [
          {
            code: "BOOKING.ENGINE.DISPLAY",
            name: "Booking Engine Display Profile",
            description:
              "Defines the look-and-feel, localization, and content blocks for the booking engine.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT", "PROPERTY"],
            defaultValue: {
              theme: "MODERN",
              primaryColor: "#155EEF",
              widgetTypes: ["EMBEDDED", "FLOATING_BUTTON"],
              supportedLanguages: ["en", "es", "fr"],
              showPromoCodeField: true,
            },
            tags: ["guest-experience", "ui"],
            moduleDependencies: ["booking-engine"],
            referenceDocs: ["https://docs.tartware.com/settings/booking/display"],
          },
        ],
      },
      {
        code: "BOOKING_FLOW_RESTRICTIONS",
        name: "Booking Flow & Restrictions",
        description:
          "Steps; guest info requirements; upsells; terms; same-day cutoffs; age limits.",
        icon: "workflow",
        definitions: [
          {
            code: "BOOKING.ENGINE.FLOW",
            name: "Booking Flow Configuration",
            description:
              "Controls booking steps, required guest information, and upsell presentation.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "PROPERTY",
            allowedScopes: ["PROPERTY"],
            defaultValue: {
              steps: ["SEARCH", "ROOM_SELECTION", "ADD_ONS", "PAYMENT", "CONFIRMATION"],
              requiredFields: ["EMAIL", "PHONE", "ARRIVAL_TIME"],
              upsellPanels: ["PARKING", "BREAKFAST", "LATE_CHECKOUT"],
              sameDayCutoffHour: 18,
              minGuestAge: 18,
            },
            tags: ["guest-experience", "compliance"],
            moduleDependencies: ["booking-engine"],
            referenceDocs: ["https://docs.tartware.com/settings/booking/flow"],
          },
        ],
      },
      {
        code: "LOYALTY_PROGRAM",
        name: "Loyalty Program",
        description:
          "Tiers; points rules; redemptions; expirations; benefits; partner integrations.",
        icon: "loyalty",
        definitions: [
          {
            code: "GUEST.LOYALTY.PROGRAM",
            name: "Loyalty Program Configuration",
            description:
              "Govern loyalty tiers, accrual rules, redemption catalog, and partner alignments.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT"],
            defaultValue: {
              tiers: [
                { code: "SILVER", nightsRequired: 5, benefits: ["LATE_CHECKOUT"] },
                { code: "GOLD", nightsRequired: 15, benefits: ["ROOM_UPGRADE", "WELCOME_GIFT"] },
                {
                  code: "PLATINUM",
                  nightsRequired: 30,
                  benefits: ["SUITE_UPGRADE", "DINING_CREDIT"],
                },
              ],
              accrual: { pointsPerDollar: 1.5, bonusForDirect: 25 },
              expirationMonths: 24,
              partners: [{ name: "AirlineOne", type: "AIR", conversionRate: 0.5 }],
            },
            tags: ["loyalty", "guest-experience"],
            moduleDependencies: ["guest-experience"],
            referenceDocs: ["https://docs.tartware.com/settings/guest/loyalty"],
          },
        ],
      },
      {
        code: "GUEST_HISTORY_TRACKING",
        name: "Guest History & Tracking",
        description: "Past records; patterns; feedback; sentiment analysis.",
        icon: "history_edu",
        definitions: [
          {
            code: "GUEST.HISTORY.SETTINGS",
            name: "Guest History Tracking Policy",
            description:
              "Controls data captured for guest history, sentiment, and experience feedback.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT"],
            defaultValue: {
              trackedEvents: ["STAY", "ANCILLARY_PURCHASE", "FEEDBACK", "COMPLAINT"],
              sentimentAnalysis: { enabled: true, provider: "TART_AI" },
              feedbackSurveys: { postStayDelayHours: 12, reminderDays: [3] },
            },
            tags: ["guest-experience", "analytics"],
            moduleDependencies: ["guest-experience"],
            referenceDocs: ["https://docs.tartware.com/settings/guest/history"],
            sensitivity: "SENSITIVE",
          },
        ],
      },
    ],
  },
  {
    code: "HOUSEKEEPING_MAINTENANCE_OPERATIONS",
    name: "Housekeeping, Maintenance & Operations",
    description:
      "Operational task automation, maintenance scheduling, and real-time status updates for units.",
    icon: "cleaning_services",
    color: "green",
    tags: ["operations"],
    sections: [
      {
        code: "HOUSEKEEPING_TASKS",
        name: "Housekeeping Tasks",
        description:
          "Auto-generation; priorities; workflows (Dirty → Ready); assignments; time standards; reports.",
        icon: "cleaning_services",
        definitions: [
          {
            code: "OPERATIONS.HK.TASK_ENGINE",
            name: "Housekeeping Task Engine",
            description:
              "Configures housekeeping task automation, priorities, and productivity metrics.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "PROPERTY",
            allowedScopes: ["PROPERTY"],
            defaultValue: {
              defaultPriority: "MEDIUM",
              timeStandardsMinutes: {
                REGULAR_CLEAN: 30,
                STAYOVER: 20,
                CHECKOUT: 45,
              },
              assignmentStrategy: "LOAD_BALANCED",
              autoGenerate: { onCheckOut: true, onReservationChange: true },
            },
            tags: ["housekeeping", "operations"],
            moduleDependencies: ["operations"],
            referenceDocs: ["https://docs.tartware.com/settings/operations/housekeeping"],
          },
        ],
      },
      {
        code: "STATUS_UPDATES",
        name: "Status Updates",
        description: "Real-time sync; check-in blocks; inspections; lost/found.",
        icon: "sync",
        definitions: [
          {
            code: "OPERATIONS.STATUS.SYNC",
            name: "Operational Status Sync",
            description:
              "Controls how housekeeping, maintenance, and front desk status updates synchronize.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "UNIT",
            allowedScopes: ["PROPERTY", "UNIT"],
            defaultValue: {
              syncIntervals: { housekeepingMinutes: 5, maintenanceMinutes: 10 },
              blockingRules: { preventCheckInIf: ["DIRTY", "OUT_OF_ORDER"] },
              inspection: { requiredStatuses: ["CLEAN"], autoNotify: ["FRONT_DESK"] },
              lostAndFound: { retentionDays: 90, escalationRole: "SECURITY" },
            },
            tags: ["operations", "housekeeping"],
            moduleDependencies: ["operations"],
            referenceDocs: ["https://docs.tartware.com/settings/operations/status"],
          },
        ],
      },
      {
        code: "MAINTENANCE_CONFIGURATION",
        name: "Maintenance Configuration",
        description:
          "Types (preventive, reactive); schedules; work orders; approvals; asset inventory; costs.",
        icon: "build_circle",
        definitions: [
          {
            code: "OPERATIONS.MAINTENANCE.SETTINGS",
            name: "Maintenance Program Configuration",
            description:
              "Defines preventive schedules, asset coverage, and escalation in maintenance workflows.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "PROPERTY",
            allowedScopes: ["PROPERTY"],
            defaultValue: {
              programs: [
                { code: "HVAC_QTR", type: "PREVENTIVE", frequencyDays: 90 },
                { code: "ELEVATOR_MONTHLY", type: "PREVENTIVE", frequencyDays: 30 },
              ],
              responseTargets: { priorityHighHours: 2, priorityMediumHours: 8 },
              vendorPool: ["ACME_MECHANICAL", "CLEARVIEW_ELEVATOR"],
            },
            tags: ["maintenance", "operations"],
            moduleDependencies: ["operations"],
            referenceDocs: ["https://docs.tartware.com/settings/operations/maintenance"],
          },
        ],
      },
    ],
  },
  {
    code: "REPORTING_ANALYTICS_NIGHT_AUDIT",
    name: "Reporting, Analytics & Night Audit",
    description:
      "Configuration for reporting catalogs, dashboards, scheduled distribution, and night audit procedures.",
    icon: "analytics",
    color: "deep-purple",
    tags: ["analytics", "finance"],
    sections: [
      {
        code: "REPORT_TYPES",
        name: "Report Types",
        description:
          "Financial (RevPAR, ADR); occupancy; forecasts; cancellations; demographics; custom builder.",
        icon: "insert_chart",
        definitions: [
          {
            code: "ANALYTICS.REPORT.CATALOG",
            name: "Report Catalog Configuration",
            description: "Controls available report templates, metrics, and access permissions.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT"],
            defaultValue: {
              categories: [
                { code: "FINANCIAL", reports: ["ADR", "REVPAR", "GOPPAR"] },
                { code: "OPERATIONS", reports: ["HOUSEKEEPING_PRODUCTIVITY"] },
                { code: "MARKETING", reports: ["CHANNEL_MIX", "LOYALTY_UPTAKE"] },
              ],
              customBuilderEnabled: true,
              exportFormats: ["PDF", "XLSX", "CSV"],
            },
            tags: ["analytics"],
            moduleDependencies: ["analytics"],
            referenceDocs: ["https://docs.tartware.com/settings/analytics/report-catalog"],
          },
        ],
      },
      {
        code: "DASHBOARD_CUSTOMIZATION",
        name: "Dashboard Customization",
        description: "Widgets; real-time refresh; role-based views; drill-downs.",
        icon: "grid_view",
        definitions: [
          {
            code: "ANALYTICS.DASHBOARD.CONFIG",
            name: "Dashboard Experience Settings",
            description:
              "Defines dashboard layout options, refresh cadence, and role-based widget visibility.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "USER",
            allowedScopes: ["TENANT", "USER"],
            defaultValue: {
              defaultLayout: ["OCCUPANCY", "REVPAR", "TASKS"],
              refreshIntervalSeconds: 300,
              roleOverrides: {
                FRONT_DESK: ["ARRIVALS", "DEPARTURES"],
                REVENUE_MANAGER: ["PICKUP", "FORECAST"],
              },
            },
            tags: ["analytics", "ui"],
            moduleDependencies: ["analytics"],
            referenceDocs: ["https://docs.tartware.com/settings/analytics/dashboards"],
          },
        ],
      },
      {
        code: "REPORT_SCHEDULING",
        name: "Report Scheduling",
        description: "Automated generation; distribution; retention.",
        icon: "schedule_send",
        definitions: [
          {
            code: "ANALYTICS.REPORT.SCHEDULING",
            name: "Report Scheduling Policy",
            description:
              "Controls report distribution cadence, channels, and retention for scheduled reports.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT"],
            defaultValue: {
              schedules: [
                { code: "DAILY_NIGHT_AUDIT", frequency: "DAILY", time: "06:00" },
                { code: "WEEKLY_EXECUTIVE", frequency: "WEEKLY", day: "MONDAY", time: "09:00" },
              ],
              delivery: ["EMAIL", "SFTP"],
              retentionDays: 365,
            },
            tags: ["analytics"],
            moduleDependencies: ["analytics"],
            referenceDocs: ["https://docs.tartware.com/settings/analytics/scheduling"],
          },
        ],
      },
      {
        code: "NIGHT_AUDIT",
        name: "Night Audit",
        description: "Timing; procedures (rollover, postings); validations; reports.",
        icon: "bedtime",
        definitions: [
          {
            code: "FINANCE.NIGHT_AUDIT.PROCEDURE",
            name: "Night Audit Procedure",
            description:
              "Configures nightly audit schedule, reconciliation checks, and downstream reports.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "PROPERTY",
            allowedScopes: ["PROPERTY"],
            defaultValue: {
              runTime: "02:00",
              steps: [
                "LOCK_TRANSACTIONS",
                "RECONCILE_PAYMENTS",
                "POST_ROOM_CHARGES",
                "GENERATE_REPORTS",
              ],
              autoReopenUntilMinutesBefore: 120,
              reports: ["NIGHT_AUDIT_SUMMARY", "EXCEPTION_LOG"],
            },
            tags: ["finance", "operations"],
            moduleDependencies: ["finance"],
            referenceDocs: ["https://docs.tartware.com/settings/finance/night-audit"],
          },
        ],
      },
    ],
  },
  {
    code: "COMMUNICATION_NOTIFICATIONS",
    name: "Communication & Notifications",
    description:
      "Guest messaging templates, preferences, and system alert routing for proactive communication.",
    icon: "notifications",
    color: "red",
    tags: ["communication"],
    sections: [
      {
        code: "CHANNELS_AND_WORKFLOWS",
        name: "Channels & Workflows",
        description:
          "Email/SMS/WhatsApp templates; automations (pre-arrival, confirmations, reviews); personalization.",
        icon: "sms",
        definitions: [
          {
            code: "COMMUNICATION.CHANNELS.CATALOG",
            name: "Messaging Channel Catalog",
            description:
              "Defines available communication channels, templates, and automation triggers.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT"],
            defaultValue: {
              channels: ["EMAIL", "SMS", "WHATSAPP"],
              templates: [
                { code: "CONFIRMATION", channels: ["EMAIL", "SMS"], supportsLocalization: true },
                { code: "PRE_ARRIVAL", channels: ["EMAIL"], supportsLocalization: true },
              ],
              automation: {
                preArrivalDays: 2,
                postStayReviewDays: 3,
              },
            },
            tags: ["communication", "guest-experience"],
            moduleDependencies: ["guest-experience"],
            referenceDocs: ["https://docs.tartware.com/settings/communication/channels"],
          },
        ],
      },
      {
        code: "PREFERENCES",
        name: "Preferences",
        description: "Frequency; opt-ins; do-not-disturb; GDPR controls.",
        icon: "toggle_on",
        definitions: [
          {
            code: "COMMUNICATION.PREFERENCES.POLICY",
            name: "Communication Preference Framework",
            description:
              "Controls subscription categories, default frequency, and privacy consent handling.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT", "USER"],
            defaultValue: {
              preferences: [
                { category: "PROMOTIONS", defaultOptIn: false },
                { category: "TRANSACTIONAL", defaultOptIn: true },
                { category: "HOUSEKEEPING_UPDATES", defaultOptIn: true },
              ],
              doNotDisturb: { allowPerChannel: true, quietHours: { start: "22:00", end: "08:00" } },
              dataSubjectRequests: { autoAcknowledgeHours: 24 },
            },
            tags: ["communication", "compliance-gdpr"],
            moduleDependencies: ["core-platform"],
            referenceDocs: ["https://docs.tartware.com/settings/communication/preferences"],
            sensitivity: "SENSITIVE",
          },
        ],
      },
      {
        code: "SYSTEM_ALERTS",
        name: "System Alerts",
        description: "Bookings; payments; inventory; errors; routing by role.",
        icon: "warning",
        definitions: [
          {
            code: "COMMUNICATION.ALERTS.ROUTING",
            name: "System Alert Routing",
            description: "Routes operational and financial alerts to relevant roles and channels.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "PROPERTY",
            allowedScopes: ["PROPERTY", "TENANT"],
            defaultValue: {
              alertCategories: [
                { code: "PAYMENT_FAILURE", severity: "HIGH", notify: ["FINANCE", "FRONT_DESK"] },
                { code: "OVERBOOKING", severity: "CRITICAL", notify: ["REVENUE_MANAGER"] },
                { code: "MAINTENANCE_EMERGENCY", severity: "CRITICAL", notify: ["ENGINEERING"] },
              ],
              deliveryChannels: ["EMAIL", "IN_APP", "SMS"],
            },
            tags: ["communication", "operations"],
            moduleDependencies: ["core-platform"],
            referenceDocs: ["https://docs.tartware.com/settings/communication/alerts"],
          },
        ],
      },
    ],
  },
  {
    code: "SECURITY_COMPLIANCE_BACKUP",
    name: "Security, Compliance & Backup",
    description:
      "Authentication controls, access governance, regulatory compliance, and business continuity planning.",
    icon: "shield",
    color: "grey",
    tags: ["security", "compliance"],
    sections: [
      {
        code: "AUTHENTICATION_ENCRYPTION",
        name: "Authentication & Encryption",
        description: "MFA; SSO; passwords; timeouts; data at rest/transit; tokenization.",
        icon: "lock",
        definitions: [
          {
            code: "SECURITY.AUTH.POLICY",
            name: "Authentication & Encryption Policy",
            description: "Configures SSO providers, MFA enforcement, and encryption requirements.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT"],
            defaultValue: {
              sso: { enabled: true, provider: "OKTA", enforceForRoles: ["SUPER_ADMIN"] },
              mfa: { enforced: true, methods: ["TOTP", "SMS"] },
              sessionTimeoutMinutes: 30,
              encryption: { dataAtRest: "AES256", dataInTransit: "TLS1_3" },
              tokenization: { payment: true, personallyIdentifiable: true },
            },
            tags: ["security", "compliance-pcidss"],
            moduleDependencies: ["core-platform"],
            referenceDocs: ["https://docs.tartware.com/settings/security/authentication"],
            sensitivity: "CONFIDENTIAL",
          },
        ],
      },
      {
        code: "ACCESS_CONTROLS",
        name: "Access Controls",
        description: "RBAC; field-level; API; audit logs.",
        icon: "admin_panel_settings",
        definitions: [
          {
            code: "SECURITY.ACCESS.CONTROLS",
            name: "Access Control Guardrails",
            description:
              "Defines critical data access restrictions, API policies, and audit logging depth.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT"],
            defaultValue: {
              fieldLevelRestrictions: ["PAYMENT_DETAILS", "LOYALTY_POINTS"],
              apiRateLimits: { defaultPerMinute: 120, burst: 240 },
              adminReviewFrequencyDays: 90,
              auditLogScope: ["AUTH", "CONFIG", "FINANCE"],
            },
            tags: ["security"],
            moduleDependencies: ["core-platform"],
            referenceDocs: ["https://docs.tartware.com/settings/security/access"],
          },
        ],
      },
      {
        code: "COMPLIANCE_FEATURES",
        name: "Compliance Features",
        description: "Data extraction; anonymization; consents; breaches; PCI scans.",
        icon: "scale",
        definitions: [
          {
            code: "SECURITY.COMPLIANCE.PROGRAM",
            name: "Compliance Program Settings",
            description:
              "Controls compliance tooling such as anonymization, breach notifications, and audits.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT"],
            defaultValue: {
              dataAnonymization: { enabled: true, schedule: "MONTHLY" },
              breachWorkflow: { notifyWithinHours: 24, authorities: ["LOCAL_REGULATOR"] },
              pciScanning: { cadence: "QUARTERLY", provider: "TRUSTWAVE" },
              requestHandling: { exportFormats: ["CSV", "JSON"] },
            },
            tags: ["compliance", "security"],
            moduleDependencies: ["core-platform"],
            referenceDocs: ["https://docs.tartware.com/settings/security/compliance"],
            sensitivity: "CONFIDENTIAL",
          },
        ],
      },
      {
        code: "BACKUP_AND_RECOVERY",
        name: "Backup & Recovery",
        description: "Schedules; encryption; RTO/RPO; testing; storage optimization.",
        icon: "backup",
        definitions: [
          {
            code: "SECURITY.BACKUP.RECOVERY",
            name: "Business Continuity Plan",
            description:
              "Defines backup cadence, retention, recovery objectives, and drill cadence.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT"],
            defaultValue: {
              backupSchedule: { full: "DAILY", differential: "HOURLY" },
              retentionDays: 30,
              rtoMinutes: 60,
              rpoMinutes: 15,
              drillsPerYear: 2,
            },
            tags: ["security", "resilience"],
            moduleDependencies: ["core-platform"],
            referenceDocs: ["https://docs.tartware.com/settings/security/continuity"],
          },
        ],
      },
    ],
  },
  {
    code: "UI_LOCALIZATION_CUSTOM",
    name: "UI, Localization & Custom Settings",
    description:
      "Controls for UI theming, mobile capabilities, localization formats, and custom fields.",
    icon: "palette",
    color: "pink",
    tags: ["ui", "customization"],
    sections: [
      {
        code: "UI_CUSTOMIZATION",
        name: "UI Customization",
        description: "Themes; logos; dashboards; menus; views (list/card); shortcuts.",
        icon: "palette",
        definitions: [
          {
            code: "UI.CUSTOMIZATION.WORKSPACE",
            name: "Workspace Theme & Layout",
            description: "Controls global theming, navigation layout, and quick access shortcuts.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "USER",
            allowedScopes: ["TENANT", "USER"],
            defaultValue: {
              theme: "LIGHT",
              customLogo: null,
              layout: "SIDEBAR_LEFT",
              defaultViewMode: "CARD",
              shortcuts: ["RESERVATIONS", "SETTINGS", "REPORTS"],
            },
            tags: ["ui"],
            moduleDependencies: ["ui-shell"],
            referenceDocs: ["https://docs.tartware.com/settings/ui/customization"],
          },
        ],
      },
      {
        code: "MOBILE_APP_FEATURES",
        name: "Mobile App Features",
        description: "Reservations; housekeeping; payments; notifications; offline sync.",
        icon: "smartphone",
        definitions: [
          {
            code: "UI.MOBILE.FEATURE_FLAGS",
            name: "Mobile Feature Flags",
            description:
              "Enables mobile modules, offline synchronization, and push notification behaviors.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT"],
            defaultValue: {
              enabledModules: ["RESERVATIONS", "HOUSEKEEPING", "MAINTENANCE"],
              pushNotifications: { enabled: true, quietHours: { start: "22:00", end: "07:00" } },
              offlineSync: { enabled: true, maxCacheHours: 24 },
            },
            tags: ["mobile"],
            moduleDependencies: ["mobile-apps"],
            referenceDocs: ["https://docs.tartware.com/settings/ui/mobile"],
          },
        ],
      },
      {
        code: "LANGUAGE_LOCALIZATION",
        name: "Language & Localization",
        description: "Languages; formats (date/time/number); translations (UI/templates).",
        icon: "translate",
        definitions: [
          {
            code: "UI.LOCALIZATION.SETTINGS",
            name: "Localization & Formatting",
            description: "Configures language packs, fallback behavior, and formatting standards.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT"],
            defaultValue: {
              defaultLanguage: "en",
              supportedLanguages: ["en", "fr", "es", "de"],
              numberFormat: { style: "decimal", minimumFractionDigits: 2 },
              dateFormat: "YYYY-MM-DD",
              timeFormat: "24H",
            },
            tags: ["localization"],
            moduleDependencies: ["ui-shell"],
            referenceDocs: ["https://docs.tartware.com/settings/ui/localization"],
          },
        ],
      },
      {
        code: "CUSTOM_FIELDS",
        name: "Custom Fields",
        description: "Types (text, dropdown); validations; permissions; dependencies.",
        icon: "category",
        definitions: [
          {
            code: "UI.CUSTOM_FIELDS.BUILDER",
            name: "Custom Field Builder",
            description:
              "Allows administrators to define custom fields with validation and permission logic.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT"],
            defaultValue: {
              entities: [
                {
                  target: "RESERVATION",
                  fields: [
                    { key: "ARRIVAL_FLIGHT", type: "text", required: false },
                    { key: "TRANSPORTATION", type: "select", options: ["NONE", "TAXI", "LIMO"] },
                  ],
                },
              ],
              validationLibrary: ["required", "minLength", "maxLength", "regex"],
              permissions: { visibilityRoles: ["SUPER_ADMIN", "PROPERTY_MANAGER"] },
            },
            tags: ["customization"],
            moduleDependencies: ["ui-shell"],
            referenceDocs: ["https://docs.tartware.com/settings/ui/custom-fields"],
            sensitivity: "INTERNAL",
          },
        ],
      },
    ],
  },
  {
    code: "ADVANCED_TRENDING",
    name: "Advanced & Trending",
    description:
      "Emerging capabilities including AI automation, sustainability monitoring, and digital guest journey.",
    icon: "rocket_launch",
    color: "lime",
    tags: ["innovation"],
    sections: [
      {
        code: "AI_AND_AUTOMATION",
        name: "AI & Automation",
        description: "Price optimization; forecasting; chatbots; upselling triggers.",
        icon: "smart_toy",
        definitions: [
          {
            code: "INNOVATION.AI.ORCHESTRATION",
            name: "AI Automation Orchestration",
            description: "Configures AI-driven pricing, forecasting, and conversational flows.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "TENANT",
            allowedScopes: ["TENANT"],
            defaultValue: {
              priceOptimization: { enabled: true, provider: "TART_AI", guardRailPercent: 15 },
              forecasting: { horizonDays: 120, refreshCadenceHours: 6 },
              upsellEngine: { enabled: true, triggers: ["PRE_ARRIVAL", "IN_STAY"] },
              chatbot: { enabled: true, escalationRoles: ["FRONT_DESK"], languages: ["en"] },
            },
            tags: ["ai", "revenue"],
            moduleDependencies: ["ai-platform"],
            referenceDocs: ["https://docs.tartware.com/settings/innovation/ai"],
          },
        ],
      },
      {
        code: "SUSTAINABILITY",
        name: "Sustainability",
        description: "Energy/water tracking; carbon calc; green opts; reporting.",
        icon: "energy_savings_leaf",
        definitions: [
          {
            code: "INNOVATION.SUSTAINABILITY.PROGRAM",
            name: "Sustainability Program Settings",
            description:
              "Captures sustainability metrics, guest opt-in programs, and reporting cadence.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "PROPERTY",
            allowedScopes: ["PROPERTY"],
            defaultValue: {
              metrics: ["ENERGY_KWH", "WATER_LITERS", "CARBON_KG"],
              guestOptIn: { linenReuse: true, digitalReceipts: true },
              reporting: { frequency: "MONTHLY", shareWithGuests: true },
              offsetPrograms: ["CARBON_NEUTRAL_STAYS"],
            },
            tags: ["sustainability"],
            moduleDependencies: ["sustainability"],
            referenceDocs: ["https://docs.tartware.com/settings/innovation/sustainability"],
          },
        ],
      },
      {
        code: "DIGITAL_GUEST_JOURNEY",
        name: "Digital Guest Journey",
        description: "Online check-in; digital keys; contactless payments; virtual concierge.",
        icon: "phone_iphone",
        definitions: [
          {
            code: "INNOVATION.DIGITAL_JOURNEY",
            name: "Digital Guest Journey Experience",
            description:
              "Enables digital guest touchpoints such as check-in, mobile keys, and concierge.",
            controlType: "JSON_EDITOR",
            dataType: "JSON",
            defaultScope: "PROPERTY",
            allowedScopes: ["PROPERTY", "TENANT"],
            defaultValue: {
              onlineCheckIn: { enabled: true, earliestHoursBeforeArrival: 24 },
              mobileKey: { enabled: true, provider: "KEYLESS_CO" },
              contactlessPayments: { enabled: true, supportedMethods: ["APPLE_PAY", "GOOGLE_PAY"] },
              virtualConcierge: { enabled: true, knowledgeBase: "DEFAULT" },
            },
            tags: ["guest-experience", "mobile"],
            moduleDependencies: ["guest-experience"],
            referenceDocs: ["https://docs.tartware.com/settings/innovation/digital-journey"],
          },
        ],
      },
    ],
  },
];

function deterministicUuid(name: string): string {
  const namespaceBytes = Buffer.from(UUID_NAMESPACE.replace(/-/g, ""), "hex");
  const nameBytes = Buffer.from(name);

  const hash = createHash("sha1");
  hash.update(namespaceBytes);
  hash.update(nameBytes);
  const digest = hash.digest();

  const sixth = digest[6] ?? 0;
  const eighth = digest[8] ?? 0;
  digest[6] = (sixth & 0x0f) | 0x50;
  digest[8] = (eighth & 0x3f) | 0x80;

  const hex = digest.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(
    20,
    32,
  )}`;
}

const mapScopes = (scopes: Array<keyof typeof SettingsScopeEnum.enum>): SettingsScope[] =>
  scopes.map((scope) => SettingsScopeEnum.enum[scope] as SettingsScope);

const categories: SettingsCategory[] = rawCatalog.map((category, index) => ({
  id: deterministicUuid(`CATEGORY:${category.code}`),
  code: category.code,
  name: category.name,
  description: category.description,
  icon: category.icon,
  color: category.color,
  sort_order: index,
  is_active: true,
  tags: category.tags,
  metadata: {},
  created_at: BASE_TIMESTAMP,
  updated_at: BASE_TIMESTAMP,
  created_by: SYSTEM_USER_ID,
  updated_by: SYSTEM_USER_ID,
}));

const sections: SettingsSection[] = rawCatalog.flatMap((category) =>
  category.sections.map((section, sectionIndex) => ({
    id: deterministicUuid(`SECTION:${category.code}:${section.code}`),
    category_id: deterministicUuid(`CATEGORY:${category.code}`),
    code: section.code,
    name: section.name,
    description: section.description,
    icon: section.icon,
    sort_order: sectionIndex,
    is_active: true,
    tags: section.tags,
    metadata: {},
    created_at: BASE_TIMESTAMP,
    updated_at: BASE_TIMESTAMP,
    created_by: SYSTEM_USER_ID,
    updated_by: SYSTEM_USER_ID,
  })),
);

const definitions = rawCatalog.flatMap((category) =>
  category.sections.flatMap((section) =>
    section.definitions.map((definition, definitionIndex) => ({
      id: deterministicUuid(`SETTING:${category.code}:${section.code}:${definition.code}`),
      category_id: deterministicUuid(`CATEGORY:${category.code}`),
      section_id: deterministicUuid(`SECTION:${category.code}:${section.code}`),
      code: definition.code,
      name: definition.name,
      description: definition.description,
      help_text: undefined,
      placeholder: undefined,
      tooltip: undefined,
      data_type: SettingsDataTypeEnum.enum[definition.dataType],
      control_type: SettingsControlTypeEnum.enum[definition.controlType],
      default_value: definition.defaultValue,
      value_constraints: definition.valueConstraints ?? {},
      allowed_scopes: mapScopes(definition.allowedScopes),
      default_scope: SettingsScopeEnum.enum[definition.defaultScope] as SettingsScope,
      override_scopes: definition.overrideScopes ? mapScopes(definition.overrideScopes) : undefined,
      is_required: true,
      is_advanced: definition.tags?.includes("advanced") ?? false,
      is_readonly: false,
      is_deprecated: false,
      sensitivity: definition.sensitivity
        ? SettingsSensitivityEnum.enum[definition.sensitivity]
        : SettingsSensitivityEnum.enum.INTERNAL,
      module_dependencies: definition.moduleDependencies,
      feature_flag: undefined,
      compliance_tags: definition.tags?.filter((tag) => tag.startsWith("compliance")),
      related_settings: undefined,
      labels: undefined,
      tags: definition.tags,
      sort_order: definitionIndex,
      version: "1.0.0",
      reference_docs: definition.referenceDocs,
      form_schema: definition.formSchema ?? {},
      metadata: {},
      created_at: BASE_TIMESTAMP,
      updated_at: BASE_TIMESTAMP,
      created_by: SYSTEM_USER_ID,
      updated_by: SYSTEM_USER_ID,
    })),
  ),
) as SettingsDefinition[];

const options: SettingsOption[] = rawCatalog.flatMap((category) =>
  category.sections.flatMap((section) =>
    section.definitions.flatMap((definition) =>
      (definition.options ?? []).map((option, optionIndex) => ({
        id: deterministicUuid(
          `OPTION:${category.code}:${section.code}:${definition.code}:${option.value}`,
        ),
        setting_id: deterministicUuid(
          `SETTING:${category.code}:${section.code}:${definition.code}`,
        ),
        value: option.value,
        label: option.label,
        description: option.description,
        icon: option.icon,
        color: option.color,
        sort_order: optionIndex,
        is_default: option.isDefault ?? false,
        is_active: true,
        metadata: {},
        created_at: BASE_TIMESTAMP,
        updated_at: BASE_TIMESTAMP,
        created_by: SYSTEM_USER_ID,
        updated_by: SYSTEM_USER_ID,
      })),
    ),
  ),
);

export const settingsCatalogData = {
  categories,
  sections,
  definitions,
  options,
};

export { deterministicUuid as generateDeterministicUuid };
