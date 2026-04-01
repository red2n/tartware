import type { RawCategory } from "../catalog-types.js";

export const SECURITY_COMPLIANCE_BACKUP: RawCategory = {
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
          description: "Defines backup cadence, retention, recovery objectives, and drill cadence.",
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
};
