import type { RawCategory } from "../catalog-types.js";

export const ADMIN_USER_MANAGEMENT: RawCategory = {
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
};
