import type { RawCategory } from "../catalog-types.js";

export const REPORTING_ANALYTICS_NIGHT_AUDIT: RawCategory = {
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
};
