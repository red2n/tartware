import type { RawCategory } from "../catalog-types.js";

export const APPROVAL_WORKFLOWS: RawCategory = {
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
      description: "History logs; pending dashboards; notifications; deadlines; escalation rules.",
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
};
