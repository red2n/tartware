import {
  DEFAULT_RATE_APPROVAL_POLICY,
  DEFAULT_WRITE_OFF_APPROVAL_POLICY,
  RATE_APPROVAL_SETTING,
  WRITE_OFF_APPROVAL_SETTING,
} from "@tartware/schemas";

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
          code: RATE_APPROVAL_SETTING,
          name: "Rate & Discount Approval Policy",
          description:
            "Escalation thresholds for rate overrides and discounts. Enforced on " +
            "reservation.rate_override: a discount at or above a rung needs the role that " +
            "rung names, checked against the role on the command.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          // TENANT, not PROPERTY. The server-side resolver reads tenant scope,
          // and a policy stored at a scope nothing reads is how these numbers
          // sat unenforced in the first place. Widening the resolver to
          // property precedence is a separate change; declaring a scope it does
          // not support would re-create the gap in a new place.
          defaultScope: "TENANT",
          allowedScopes: ["TENANT"],
          // The one copy lives in `schema/src/api/override-thresholds.ts`,
          // where the handler reads it too — a screen and a control that state
          // the same policy separately will eventually state it differently.
          defaultValue: DEFAULT_RATE_APPROVAL_POLICY,
          tags: ["revenue", "workflow"],
          moduleDependencies: ["revenue-management"],
          referenceDocs: ["https://docs.tartware.com/settings/workflows/rate-approvals"],
        },
        {
          code: WRITE_OFF_APPROVAL_SETTING,
          name: "Write-Off Approval Policy",
          description:
            "Amount thresholds for writing a balance off. Enforced on the city-ledger " +
            "write-off: the rungs mirror the seeded WRITE_OFF reason codes, so the ladder " +
            "and the code an operator picks cannot disagree.",
          controlType: "JSON_EDITOR",
          dataType: "JSON",
          defaultScope: "TENANT",
          allowedScopes: ["TENANT"],
          defaultValue: DEFAULT_WRITE_OFF_APPROVAL_POLICY,
          tags: ["finance", "workflow"],
          moduleDependencies: ["finance-automation"],
          referenceDocs: ["https://docs.tartware.com/settings/workflows/write-off-approvals"],
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
