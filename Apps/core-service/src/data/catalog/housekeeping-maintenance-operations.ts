import type { RawCategory } from "../catalog-types.js";

export const HOUSEKEEPING_MAINTENANCE_OPERATIONS: RawCategory = {
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
};
